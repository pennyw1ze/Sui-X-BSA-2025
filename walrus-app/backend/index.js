const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const fs = require('fs/promises');
const path = require('path');

const { runLeakInsights } = require('./agents/runLeakInsights');
const logger = require('./logger');

dotenv.config();

if (!process.env.OPENROUTER_API_KEY) {
  dotenv.config({
    path: path.resolve(__dirname, '..', '..', '.env'),
  });
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      route: req.originalUrl,
      method: req.method,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      user_agent: req.headers['user-agent'],
      ip: req.ip,
    }, 'http_request_completed');
  });
  next();
});

const upload = multer();

const leakDataPath = path.join(__dirname, 'data', 'leaks.json');

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'from', 'that', 'this', 'into', 'using', 'notes', 'draft', 'leak', 'report',
  'proposal', 'integration', 'early', 'look', 'bridge', 'across', 'across', 'sui', 'walrus', 'for', 'into',
]);

const deriveFallbackTags = (entry) => {
  const source = `${entry.title || ''} ${entry.description || ''}`.toLowerCase();
  const candidates = source.match(/[a-z0-9-]{4,}/g) || [];
  const tags = [];

  candidates.forEach((word) => {
    const clean = word.replace(/[^a-z0-9-]/g, '');
    if (clean && !STOP_WORDS.has(clean) && !tags.includes(clean)) {
      tags.push(clean);
    }
  });

  if (entry.status && !tags.includes(entry.status.toLowerCase())) {
    tags.push(entry.status.toLowerCase().replace(/\s+/g, '-'));
  }

  if (!tags.length) {
    tags.push('leak');
  }

  return tags.slice(0, 6);
};

const buildFallbackInsight = (entry) => {
  if (entry.description) {
    return entry.description.slice(0, 150) + (entry.description.length > 150 ? '…' : '');
  }
  return 'Community submission awaiting anonymised analysis.';
};

const applyFallbackEnrichment = (entry) => ({
  ...entry,
  tags: deriveFallbackTags(entry),
  insight: buildFallbackInsight(entry),
  risk: entry.risk || 'Unknown',
});

const sanitizeEntry = (rawEntry, baseEntry) => {
  const tags = Array.isArray(rawEntry.tags)
    ? rawEntry.tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean)
        .map((tag) => tag.replace(/\s+/g, '-'))
    : [];

  const insight = typeof rawEntry.insight === 'string' && rawEntry.insight.trim()
    ? rawEntry.insight.trim()
    : null;

  const risk = typeof rawEntry.risk === 'string' && rawEntry.risk.trim()
    ? rawEntry.risk.trim()
    : 'Unknown';

  return {
    ...baseEntry,
    ...rawEntry,
    tags: tags.length ? tags.slice(0, 6) : deriveFallbackTags(baseEntry),
    insight: insight || buildFallbackInsight(baseEntry),
    risk,
  };
};

const loadLeakEntries = async () => {
  try {
    const raw = await fs.readFile(leakDataPath, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data;
    }
  } catch (error) {
    logger.warn({ err: error }, 'unable_to_read_leak_data_file');
  }
  return [];
};

app.get('/', (req, res) => {
  logger.debug('healthcheck');
  res.json({ message: 'Backend running' });
});

app.get('/leaks', async (req, res) => {
  logger.debug({ ip: req.ip }, 'leaks_request_received');
  const entries = await loadLeakEntries();
  const baseResponse = entries.length ? entries : [];

  if (!entries.length) {
    logger.info('no_leak_entries_available');
    return res.json({ leaks: [], llm: { enabled: false, reason: 'No leak entries found.' } });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    logger.warn('openrouter_api_key_missing');
    const enriched = baseResponse.map(applyFallbackEnrichment);
    return res.json({ leaks: enriched, llm: { enabled: false, reason: 'OpenRouter API key not configured.' } });
  }

  try {
    const result = await runLeakInsights(entries);
    logger.info({
      total_entries: entries.length,
      enriched_entries: Array.isArray(result?.entries) ? result.entries.length : 0,
    }, 'llm_enrichment_success');
    const enrichedEntries = Array.isArray(result?.entries) && result.entries.length
      ? result.entries.map((item, index) => sanitizeEntry(item, entries[index] || {}))
      : [];

    if (!enrichedEntries.length) {
      logger.warn('llm_enrichment_empty_result');
      const enriched = baseResponse.map(applyFallbackEnrichment);
      return res.json({
        leaks: enriched,
        llm: { enabled: false, reason: 'LLM enrichment did not return usable data.' },
      });
    }

    return res.json({ leaks: enrichedEntries, llm: { enabled: true } });
  } catch (error) {
    logger.error({ err: error }, 'llm_enrichment_failure');
    const enriched = baseResponse.map(applyFallbackEnrichment);
    return res.json({ leaks: enriched, llm: { enabled: false, reason: error.message } });
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    logger.warn({ route: req.originalUrl }, 'upload_missing_file');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  logger.info({ filename: req.file.originalname, size: req.file.size }, 'upload_received');
  res.json({ filename: req.file.originalname, size: req.file.size });
});

app.listen(port, () => {
  logger.info({ port }, 'server_started');
});

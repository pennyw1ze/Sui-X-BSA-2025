const { spawn } = require('child_process');
const path = require('path');
const logger = require('../logger');

const PYTHON_BIN = process.env.PYTHON_BIN || process.env.PYTHON || 'python';

const runLeakInsights = (entries) => new Promise((resolve, reject) => {
  const scriptPath = path.join(__dirname, 'generate_leak_insights.py');
  const payload = JSON.stringify({ entries });
  logger.debug({ scriptPath, python: PYTHON_BIN, entries: entries.length }, 'spawn_python_enrichment');
  const child = spawn(PYTHON_BIN, [scriptPath], {
    cwd: path.join(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
    },
  });

  let stdout = '';
  let stderr = '';

  child.stdin.write(payload);
  child.stdin.end();

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    logger.debug({ chunk: chunk.toString() }, 'python_stderr');
  });

  child.on('error', (error) => {
    logger.error({ err: error }, 'python_spawn_error');
    reject(error);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      const error = stderr || `Python enrichment exited with code ${code}`;
      logger.error({ code, stderr }, 'python_process_failed');
      return reject(new Error(error.trim()));
    }

    try {
      const parsed = JSON.parse(stdout);
      if (parsed.error) {
        logger.error({ python_error: parsed.error }, 'python_returned_error');
        return reject(new Error(parsed.error));
      }
      logger.debug('python_enrichment_parsed');
      resolve(parsed);
    } catch (error) {
      logger.error({ err: error, stdout }, 'python_parse_failure');
      reject(new Error(`Failed to parse enrichment output: ${error.message}`));
    }
  });
});

module.exports = {
  runLeakInsights,
};

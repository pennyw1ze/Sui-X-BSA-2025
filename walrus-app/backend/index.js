// index.js
// Minimal Express server + Walrus API

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());

// Serve frontend static files
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

// Multer in-memory; we write to a temp file before calling walrus CLI
const upload = multer();

// ----- Walrus config -----
const WALRUS_BIN =
  process.env.WALRUS_BIN ||
  (process.platform === "win32"
    ? path.join(process.env.USERPROFILE || "", "bin", "walrus.exe")
    : "walrus");

const WALRUS_CONFIG = process.env.WALRUS_CONFIG || ""; // e.g. C:\Users\<you>\.walrus\client_config.yaml
const WALRUS_WALLET = process.env.WALRUS_WALLET || ""; // e.g. C:\Users\<you>\.sui\sui_config\client.yaml

// Add default store expiry/epochs (can be overridden via env)
const WALRUS_STORE_EPOCHS = process.env.WALRUS_STORE_EPOCHS || "1";

function walrusArgs(extra) {
  const out = [...extra];
  if (WALRUS_CONFIG) out.push("--config", WALRUS_CONFIG);
  if (WALRUS_WALLET) out.push("--wallet", WALRUS_WALLET);
  return out;
}

function runWalrus(args) {
  return new Promise((resolve) => {
    const p = spawn(WALRUS_BIN, walrusArgs(args), { windowsHide: true });
    let stdout = "",
      stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

// New helper: try different expiry flag names for store
async function tryStoreWithExpiry(filePath) {
  const attempts = [
    ["store", "--json", "--epochs", String(WALRUS_STORE_EPOCHS), filePath],
    ["store", "--json", "--earliest-expiry-time", String(WALRUS_STORE_EPOCHS), filePath],
    ["store", "--json", "--end-epoch", String(WALRUS_STORE_EPOCHS), filePath],
    // fallback: store without explicit expiry (last resort)
    ["store", "--json", filePath],
  ];

  for (const args of attempts) {
    const r = await runWalrus(args);
    if (r.code === 0) return r;
    // small heuristic: if stderr doesn't complain about missing expiry flag, accept the result (likely different error)
    const stderr = (r.stderr || "").toLowerCase();
    if (!stderr.includes("required arguments") && !stderr.includes("the following required arguments were not provided")) {
      return r;
    }
    // otherwise continue trying next flag form
  }
  // return last attempt result if none succeeded
  return await runWalrus(attempts[attempts.length - 1]);
}

// Small helper: write an in-memory upload to a temporary file
async function writeTempFile(buffer, originalName = "upload.bin") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "walrus-"));
  const filePath = path.join(dir, originalName.replace(/[^\w.\-]/g, "_"));
  await fs.promises.writeFile(filePath, buffer);
  return { dir, filePath };
}

// Root -> serve frontend index.html
app.get("/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// Your preview endpoint (fixed syntax + JSON)
app.get("/api/walrus", (_req, res) => {
  res.json({
    app: "walrus",
    version: "1.33.2",
    message: "Walrus runs (hopefully) /RE",
    data: [
      { id: 1, name: "Walrus 1" },
      { id: 2, name: "Walrus 2" },
    ],
  });
});

// ---- Walrus: info (network/system info) ----
app.get("/api/walrus/info", async (_req, res) => {
  const r = await runWalrus(["info"]);
  if (r.code !== 0) return res.status(500).json({ error: "walrus info failed", ...r });
  res.type("text/plain").send(r.stdout || r.stderr);
});

// ---- Walrus: list blobs for current wallet ----
app.get("/api/walrus/list-blobs", async (_req, res) => {
  const r = await runWalrus(["list-blobs", "--json"]);
  if (r.code !== 0) return res.status(500).json({ error: "walrus list-blobs failed", ...r });
  try {
    return res.json(JSON.parse(r.stdout));
  } catch {
    return res.type("text/plain").send(r.stdout);
  }
});

// ---- Walrus: blob status ----
app.get("/api/walrus/blob-status/:id", async (req, res) => {
  const id = req.params.id;
  const r = await runWalrus(["blob-status", "--blob-id", id, "--json"]);
  if (r.code !== 0) return res.status(500).json({ error: "walrus blob-status failed", ...r });
  try {
    return res.json(JSON.parse(r.stdout));
  } catch {
    return res.type("text/plain").send(r.stdout);
  }
});

// ---- Walrus: store (upload) ----
// Form field name must be "file"
app.post("/api/walrus/store", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Accept optional wallet metadata from the frontend
    const walletAddress = req.body?.walletAddress || null;
    const signature = req.body?.signature || null;

    // If you want client-side encryption, do it in the frontend, then upload ciphertext here.
    const { dir, filePath } = await writeTempFile(req.file.buffer, req.file.originalname || "upload.bin");

    // Use helper that tries multiple expiry flag variants
    const r = await tryStoreWithExpiry(filePath);

    // Cleanup
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch {}

    if (r.code !== 0) {
      // Return full stderr to help debugging clients
      return res.status(500).json({ error: "walrus store failed", walletAddress, signature, ...r });
    }

    // Parse JSON if available, otherwise regex fallback
    try {
      const j = JSON.parse(r.stdout);
      const blobId = j.blob_id || j.blobId || j.id;
      if (blobId) return res.json({ blobId, raw: j, meta: { walletAddress, signature } });
    } catch {
      const m = (r.stdout || "").match(/blob id:\s*([^\s]+)/i) || (r.stdout || "").match(/([A-Za
      await fs.promises.rm(outDir, { recursive: true, force: true });
    } catch {}
  });
  stream.pipe(res);
});

// ---- Plain upload (your original endpoint, untouched) ----
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ filename: req.file.originalname, size: req.file.size });
});

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
  console.log(`Using walrus binary: ${WALRUS_BIN}`);
});

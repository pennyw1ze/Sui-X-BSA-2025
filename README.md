# Sui-X-BSA-2025

Members:


Technical University of Munich, TUM Blockchain Club : Sparsh, Rami

Sapienza Università di Roma : Leo, Riccardo

Tor Vergata University : Eva

## Live leak enrichment service

The Express backend now exposes `GET /leaks`, returning community leak metadata enriched with AI generated tags and insights. Fallback heuristics ensure the endpoint still responds if OpenRouter is unavailable.

### Configuration

Set the following environment variables before starting the backend:

- `OPENROUTER_API_KEY` – required to call OpenRouter.
- `OPENROUTER_MODEL` (optional) – defaults to `x-ai/grok-4-fast:free`.
- `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` (optional but recommended for OpenRouter rate limits).
- `PYTHON_BIN` (optional) – path to the Python binary if `python` is not on your `PATH`.

Install the Python dependencies for the enrichment agent:

```powershell
cd walrus-app/backend
python -m pip install -r requirements.txt
```

### Usage

Start the backend server to expose the new leaks endpoint:

```powershell
cd walrus-app/backend
npm install
npm start
```

The frontend automatically queries `GET http://localhost:3001/leaks` (override with `VITE_BACKEND_URL`). The "Watch current leaks" carousel will display up to three cards at a time with animated transitions and AI derived tags.

### Logging

The backend now uses [Pino](https://github.com/pinojs/pino) for structured logging. Logs are prettified locally and emit JSON in production. Control verbosity with `LOG_LEVEL=debug` and override the transport completely by editing `backend/logger.js`.
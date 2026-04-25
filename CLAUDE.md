# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A mobile-first barcode/QR scanner for physical inventory counting. The frontend runs in the browser (bundled by Vite into a single HTML file), the backend is a **Google Apps Script (GAS)** project hosted on a Google Sheets document, and a local Express server mocks the GAS environment during development.

## Commands

```bash
npm run dev            # Vite dev server + mock Express server (hot reload)
npm run build          # Production build → dist/
npm run preview        # Staging build + local preview
npm run deploy:homolog # Deploy to GAS staging environment
npm run deploy         # Deploy to GAS production
npm run lint           # ESLint validation
npm run mock_server    # Run mock server alone (HTTPS port 3000)
```

**First-time setup:**
```bash
npm install
clasp login            # authenticate with Google account
cp .env.example .env   # fill in credentials
```

## Architecture

### Three layers

```
Browser (Vite bundle)
    ↓ fetch / GAS.withSuccessHandler
Google Apps Script (backend/)
    ↓ SpreadsheetApp
Google Sheets (inventario, leituras, observacoes, app_config tabs)
```

During local development the GAS layer is replaced by `local_server/server.js` (Express), which uses a service account in `local_server/credentials.json` to hit the real spreadsheet via the Sheets API.

### Frontend data flow

```
Input (scanner / keyboard)
  → processBarcode.js   (validation pipeline)
  → assetRepository.js  (LocalStorage, debounced 400ms)
  → assetSyncManager.js (batch queue, retry, exponential backoff)
  → backendService.js   (fetch wrapper, timeout, retry)
  → GAS / Express endpoint
```

`remoteInventoryRegistry.js` caches the global scan state (what others have scanned) and refreshes every 30 s to prevent duplicate registrations across users.

`inventoryBaseline.js` holds the master inventory loaded at startup (either static JSON embedded at build time via `__INVENTORY_DATA__`, or fetched from GAS).

### Build-time flags (set by vite.config.js)

| Flag | Meaning |
|---|---|
| `__IS_DEV__` | local dev mode |
| `__IS_HOMOLOG__` | staging GAS deployment |
| `__IS_PROD__` | production GAS deployment |
| `__BUILD_VERSION__` | auto-incremented `YYYY.MM.DD-NNN` |
| `__HAS_INVENTORY_DATA__` | true when `inventario.json` is bundled |

### Backend (backend/)

`Código.js` — `doGet()` serves the compiled HTML template.
`main.js` — all data functions: `getInventoryData`, `getAppSettings`, `saveCodeBatch`, `saveMessage`, `getNotFoundItens`, `getInventorySummary`.

### Google Sheets tabs

| Tab | Purpose |
|---|---|
| `inventario` | Master inventory (read-only by app) |
| `leituras` | Written by `saveCodeBatch()` |
| `observacoes` | Written by `saveMessage()` |
| `app_config` | Key-value settings; `inventory_open: false` closes scanning |

## Key constraints

- **No optional chaining (`?.`) or nullish coalescing (`??`)** — ESLint enforces ES2015 compatibility. Use explicit `null` checks.
- **Never edit code directly in the Apps Script Editor** — always deploy via `npm run deploy` or `npm run deploy:homolog`.
- The Vite build produces a single bundled HTML file (via `viteSingleFile`). All assets must be inlineable.
- GAS runs on the V8 runtime; the frontend targets ES2015 for broad browser compatibility.

## Environment variables (.env)

See `.env.example` for the full list. The critical ones:

| Variable | Purpose |
|---|---|
| `CLASP_SCRIPT_ID` | GAS project ID |
| `DEPLOYMENT_ID` | GAS versioned deployment ID |
| `MOCK_SPREADSHEET_ID` | Spreadsheet used by the mock server |
| `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Service account for local dev |

`local_server/credentials.json` (git-ignored) holds the same service account keys in JSON format as an alternative to env vars.

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

## GAS Template Safety (CRITICAL)

The production GAS endpoint serves HTML via `HtmlService.createHtmlOutputFromFile('index')` (see `backend/Código.js:14`). This method does **not** activate the GAS template parser. However, the template-based alternative (`createTemplateFromFile('index').evaluate()`) is preserved in comments (lines 9–12) and could be re-enabled. When the template parser is active, the GAS server scans **all** content — including inline `<script>` tags and JavaScript strings — for scriptlet tags. A false positive match crashes the deployment with a syntax error.

### Rules for ALL JavaScript that could end up in the served HTML

1. **NEVER write `<?`, `<?=`, or `<?!=` as a contiguous sequence** in any JavaScript string, expression, regex, or comment. The GAS regex engine will try to execute these server-side. If a value must contain these characters, split them: `"<" + "?="` or `"<" + "?!= "`.

2. **Avoid `!?` and `?!` directly adjacent** in client-side JavaScript. The GAS parser frequently confuses these as malformed scriptlet openings when the `?` touches the `<` of a neighboring tag or when the `!` precedes a `?` that looks like a tag boundary. Use explicit spacing: `!a ? b : c` not `!a? b : c`, and prefer `if (!x) { ... }` over `!x ? ...`.

3. **Keep syntax V8-compatible** (the GAS runtime), but never rely on the V8 parser to "protect" you from the GAS template scanner — the template scan happens **before** any JavaScript execution, as a raw text pass over the entire HTML output.

4. **Always review minified output** after build. Vite/esbuild minification can create `<?` sequences from adjacent tokens that were safe in source. Before deploying, run:
   ```
   grep -rE '<\?[!=]?' dist/
   ```
   If any match is found in `dist/index.html` (not in backend `.js` files where scriptlets are intentional), fix the source and rebuild.

### Current project status

- **Active mode**: `createHtmlOutputFromFile` — no template parsing. `<?` in frontend JS is tolerated today but must still be avoided per these rules.
- **Commented-out mode**: `createTemplateFromFile` + `.evaluate()` — template parsing ACTIVE. Re-enabling this requires `minify: false` in `vite.config.js` (minified output contains raw `?` characters that form `<?` with neighboring `<`).
- **Frontend code** (audited 2026-07-22): ZERO `<?` patterns found in `frontend/src/**/*.js`. The only `<?!=` occurrences are in `backend/Código.js` where they are intentional GAS scriptlets.

## Key constraints

- **No optional chaining (`?.`) or nullish coalescing (`??`)** — ESLint enforces ES2015 compatibility. Use explicit `null` checks.
- **Never edit code directly in the Apps Script Editor** — always deploy via `npm run deploy` or `npm run deploy:homolog`.
- The Vite build produces a single bundled HTML file (via `viteSingleFile`). All assets must be inlineable.
- GAS runs on the V8 runtime; the frontend targets ES2015 for broad browser compatibility.

## Frontend code patterns

The codebase uses constructor functions with prototype methods (ES5-style), **not** ES6 classes. Vite's esbuild config has `supported: { class: false }` which downlevels classes automatically, but the existing source code consistently uses this pattern:

```js
// Constructor function
function MyModule() {
  this.property = null;
  this.method = this.method.bind(this);
}

// Prototype methods
MyModule.prototype.method = function() { ... };

// Singleton export
export const myModule = new MyModule();
```

Some modules use object literals with methods (`AppModal`, `inputArea`), and a few use bare `export function`. When adding new code, **match the style of the module you're editing**. For new modules, prefer the constructor+prototype pattern — it's the most common in this codebase.

All user-facing text must be in **Portuguese (pt-BR)**. Comments and JSDoc are in Portuguese as well. Variable names are in English (e.g., `selectedLocation`, `pendingBatch`).

### Module responsibilities (key files)

| Module | Role |
|---|---|
| `main.js` | App init, event wiring, module imports |
| `processBarcode.js` | Validation pipeline for every scan |
| `assetRepository.js` | LocalStorage CRUD, debounced persistence |
| `assetSyncManager.js` | Batch sync queue with retry/backoff |
| `backendService.js` | GAS `google.script.run` wrapper with retry |
| `inventoryBaseline.js` | Master inventory lookup & verification |
| `remoteInventoryRegistry.js` | Cross-user scan cache (30s polling) |
| `barcodeTable.js` | Paginated table of scanned items |
| `statsManager.js` | Statistics dashboard |
| `locationSelector.js` | Dropdown of inventory locations |
| `editAssetModal.js` | Modal for editing asset state/IPVU/notes |
| `assetsNotFound.js` | Modal showing items missing from current location |
| `messageSendModal.js` | Modal for sending observations to backend |
| `inputArea.js` | Manual barcode input + "bypass location" checkbox |
| `userWarnings.js` | Toast-style warning messages |
| `connectivityManager.js` | Online/offline detection and banner |
| `audioManager.js` | Audio feedback for scan events |

## Environment variables (.env)

See `.env.example` for the full list. The critical ones:

| Variable | Purpose |
|---|---|
| `CLASP_SCRIPT_ID` | GAS project ID |
| `DEPLOYMENT_ID` | GAS versioned deployment ID |
| `MOCK_SPREADSHEET_ID` | Spreadsheet used by the mock server |
| `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Service account for local dev |

`local_server/credentials.json` (git-ignored) holds the same service account keys in JSON format as an alternative to env vars.

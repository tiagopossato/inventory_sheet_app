# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A mobile-first barcode/QR scanner for physical inventory counting. The frontend runs in the browser (bundled by Vite into a single HTML file), the backend is a **Google Apps Script (GAS)** project hosted on a Google Sheets document.

## Project files

- **TODO.md** — prioritized backlog of pending improvements, bugs, and risks. **Only open items live here.**
- **CHANGELOG.md** — completed work history. **When an item from TODO.md is fully resolved, move it to CHANGELOG.md and remove it from TODO.md.** Never leave resolved items in TODO.md.
- **PRODUCT.md** — product spec: users, purpose, capabilities, constraints, principles.
- **README.md** — public-facing README in Portuguese (pt-BR) with setup and deploy instructions.

## Commands

```bash
npm run dev            # Vite dev server (hot reload)
npm run build          # Production build → dist/
npm run preview        # Staging build + local preview
npm run deploy:homolog # Deploy to GAS staging environment
npm run deploy         # Deploy to GAS production
npm run lint           # ESLint validation
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
    ↓ google.script.run
Google Apps Script (backend/)
    ↓ SpreadsheetApp
Google Sheets (inventario, leituras, localidades, nao_encontrados_geral,
               observacoes, app_config, usuarios_autorizados tabs)
```

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

`public.js` — thin I/O adapter. Contains `doGet()` (HTTP entry point that serves the compiled HTML), plus all data functions exposed via `google.script.run`: `getInventoryData`, `getAppSettings`, `saveCodeBatch`, `saveMessage`, `getNotFoundItens`, `getInventorySummary`. Delegates business logic to `inventory-logic.js`.
`inventory-logic.js` — pure business logic functions, single source of truth for data transforms. ES module syntax (`export`) is stripped by `deploy.js` for GAS compatibility.
`auth.js` — authorization (checks `usuarios_autorizados` sheet) and user identity: `authenticateRequest_()`, `checkAuthorization_()`, `getUserName_()`.
`common.js` — shared utilities: `include_()` for GAS HTML templates, `jsonSuccess_()` / `jsonError_()` response helpers.
`appsscript.json` — GAS project manifest: timezone, V8 runtime, OAuth scopes.

### Google Sheets tabs

| Tab | Purpose |
|---|---|
| `inventario` | Master inventory (read-only by app) |
| `leituras` | Written by `saveCodeBatch()` — scan log with upsert by UID |
| `localidades` | Location list used by `getInventorySummary()` |
| `nao_encontrados_geral` | Items not found per location, read by `getNotFoundItens()` |
| `observacoes` | Written by `saveMessage()` — user-submitted notes |
| `app_config` | Key-value settings; `inventory_open: false` closes scanning |
| `usuarios_autorizados` | Authorized users list checked by `auth.js` |

## GAS Template Safety (CRITICAL)

The production GAS endpoint serves HTML via `HtmlService.createHtmlOutputFromFile('index')` (see `backend/public.js:62–74`). This method does **not** activate the GAS template parser. However, the template-based alternative (`createTemplateFromFile('index').evaluate()`) is preserved in comments (lines 67–70) and could be re-enabled. When the template parser is active, the GAS server scans **all** content — including inline `<script>` tags and JavaScript strings — for scriptlet tags. A false positive match crashes the deployment with a syntax error.

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
- **Frontend code** (audited 2026-07-22): ZERO `<?` patterns found in `frontend/src/**/*.js`. The only `<?!=` occurrences are in `backend/public.js` where they are intentional GAS scriptlets.

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
| `barcodeScanner.js` | Keyboard-emulated barcode scanner (OTG/Bluetooth) via keystroke timing |
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
| `loadingModal.js` | Loading overlay shown during data fetch/init |
| `appModal.js` | Base modal component (constructor+prototype) used by other modals |
| `debug.js` | On-screen console overlay for mobile debugging (dev/homolog only) |
| `mockGAS.js` | Local mock of `google.script.run` for development |

## Environment variables (.env)

See `.env.example` for the full list. The critical ones:

| Variable | Purpose |
|---|---|
| `CLASP_SCRIPT_ID` | GAS project ID |
| `DEPLOYMENT_ID` | GAS versioned deployment ID |
| `MOCK_SPREADSHEET_ID` | Spreadsheet used by the mock server |
| `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` | Service account for local dev |

`local_server/credentials.json` (git-ignored) holds the service account keys in JSON format for local development (if a mock server is configured).

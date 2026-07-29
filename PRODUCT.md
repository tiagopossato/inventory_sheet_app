# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

IFC (Instituto Federal Catarinense) staff conducting the annual physical inventory count. They walk through classrooms, offices, and labs scanning barcodes on institutional assets using their personal smartphones. Five to twenty people scan simultaneously during peak periods, covering tens of thousands of patrimonial assets across multiple buildings. Technical skill level varies; the app must be usable by non-technical staff with minimal training.

## Product Purpose

A mobile-first barcode and QR code scanner that validates every scanned asset against the master inventory in real time: it confirms the asset belongs in that room, flags items found in the wrong location, tracks items not found, and syncs every reading to Google Sheets. Success is a complete, accurate annual inventory count — no lost data, no duplicate work, and a clean audit trail in the spreadsheet.

## Positioning

Tight Google Sheets integration is the mechanism a neighboring product cannot truthfully copy. The spreadsheet is simultaneously the database, the admin console (with kill-switch, configuration, and reporting), and the master-inventory editor — all directly editable by non-technical staff without a separate admin interface. A free software model with zero server infrastructure (GAS + Sheets handles hosting, storage, and auth) removes the procurement barrier that would otherwise block adoption in a public institution.

## Operating Context

Staff move through institutional buildings scanning patrimonial assets — equipment, furniture, and fixtures — each tagged with a barcode or QR code. They use their personal Android or iOS phones via the mobile browser. Wi-Fi connectivity varies across buildings (some rooms have dead zones); the app works offline and queues readings in LocalStorage for later sync. Ambient conditions include variable lighting from bright classrooms to dim storage rooms. The inventory event runs intensively for days or weeks, then the app goes dormant until the next cycle.

The Google Sheets document backing the app has seven tabs: `inventario` (master inventory, read-only), `leituras` (scan log, written by `saveCodeBatch` with UID-based upsert), `localidades` (location list), `nao_encontrados_geral` (items not found per location), `observacoes` (user-submitted notes, written by `saveMessage`), `app_config` (key-value settings including the `inventory_open` kill switch), and `usuarios_autorizados` (authorized users whitelist). Non-technical staff can edit any of these directly — the spreadsheet is the admin interface.

## Capabilities and Constraints

**Capabilities:**
- Camera-based barcode/QR scanning plus keyboard-emulated scanner support (OTG/Bluetooth) and manual keyboard input (with optional "bypass location" for unrestricted scans)
- Location-aware validation: each scan checks whether the asset is expected in the selected room
- Offline-first operation: LocalStorage queue with debounced writes, batch sync to GAS, and exponential backoff retry
- Multi-user duplicate prevention via a remote inventory registry (30-second polling interval)
- Paginated table of scanned items with per-item conservation state and IPVU (estimated useful life index) editing
- Modal for viewing and acting on items missing from the current location
- Asset observation/notes submitted to the `observacoes` sheet via a dedicated message modal
- Statistics dashboard showing found, not-found, and pending-sync counts per location
- Audio feedback for scan events (success, duplicate, error) to support eyes-free operation
- Online/offline detection with a visual connectivity banner
- Toast-style user warnings for transient errors and status changes
- Remote kill switch (`inventory_open: false`) to close scanning from the spreadsheet

**Constraints:**
- ES2015 compatibility required — no optional chaining (`?.`), no nullish coalescing (`??`)
- Constructor function + prototype pattern (ES5-style) preferred over ES6 classes; code must remain readable after Vite downleveling
- Single HTML file build output via `viteSingleFile`; all assets must be inlineable
- Backend runs on Google Apps Script V8 runtime with Google Sheets as persistent storage
- **GAS Template Safety (critical):** The GAS template parser scans all served HTML for `<?`, `<?=`, and `<?!=` scriptlet tags before any JavaScript executes. No JavaScript in the frontend may contain these character sequences — including inside strings, regex, or comments. Vite/esbuild minification can create `<?` from adjacent safe tokens, so every production build must be verified with `grep -rE '<\?[!=]?' dist/`. The current deployment uses `HtmlService.createHtmlOutputFromFile` (no template parsing), but the codebase must remain safe for the alternative `createTemplateFromFile` path preserved in comments.
- Portuguese (pt-BR) is the only supported language; all user-facing text must be in Portuguese
- No CI/CD pipeline, no automated tests
- Build flags (`__IS_DEV__`, `__IS_HOMOLOG__`, `__IS_PROD__`, `__HAS_INVENTORY_DATA__`) control environment behavior at compile time
- Deployment to GAS is via `clasp` CLI; never edit code directly in the Apps Script Editor

**Undecided:**
- None currently — all major architectural decisions are settled

## Brand Commitments

- Name: IFC (Instituto Federal Catarinense) — a Brazilian federal educational institution
- Interface language: Portuguese (pt-BR)
- No explicit visual brand guidelines or design system currently enforced

## Evidence on Hand

- Working production code deployed on Google Apps Script, with real usage during inventory cycles
- Comprehensive `CLAUDE.md` documenting the full architecture: three-layer design (Browser → GAS → Sheets), 22-module frontend inventory with responsibilities, data flow pipeline, and development workflow
- Detailed `TODO.md` with prioritized risk analysis including a pré-mortem: silent LocalStorage data loss on overflow (mitigated with smart eviction), cross-user duplicate detection window (partial), Google Sheets API quota exhaustion under concurrent load (partial — `uidToRow` cache and `getAppSettings` cache implemented), and missing input sanitization on the GAS backend
- Git history shows continuous development by a single author (Tiago Possato)
- `version.json` uses calendar-based versioning (`YYYY.MM.DD-NNN`)

**Absences that future work must not fabricate:**
- No real user testimonials or satisfaction data
- No benchmark or performance data under production load
- No documented accessibility compliance
- No automated test suite

## Product Principles

1. **The spreadsheet is the source of truth.** Every reading must eventually land in Sheets. LocalStorage is a temporary buffer, never a permanent store.

2. **Reliability over features.** Offline support, retry logic, and data integrity come before new capabilities. The worst outcome is lost or duplicated readings.

3. **Operator time is valuable.** Scanning must be fast and frictionless. The app should minimize taps, confirmations, and distractions during the physical scanning workflow. Audio feedback supports eyes-free operation so staff can keep their attention on the physical environment.

4. **Simple deployment model.** Google Sheets + GAS means no servers, no infrastructure, no procurement. An inventory tool for a public institution must stay free to operate.

5. **Design for the real environment.** Variable lighting, spotty Wi-Fi, personal phones with different screen sizes and camera quality — the app works in the conditions staff actually face, not ideal lab conditions.

## Accessibility & Inclusion

No product-specific accessibility requirements were established. The codebase uses semantic HTML with ARIA roles and `aria-live` regions, suggesting general awareness. Portuguese (pt-BR) as the sole language is the primary inclusion consideration — all UI text must remain in Portuguese. Audio feedback (success/error/duplicate tones) supports users who cannot constantly look at the screen while scanning.

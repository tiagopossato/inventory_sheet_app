# Graph Report - .  (2026-08-02)

## Corpus Check
- 61 files · ~56,488 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 545 nodes · 885 edges · 35 communities (20 shown, 15 thin omitted)
- Extraction: 93% EXTRACTED · 6% INFERRED · 1% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.87)
- Token cost: 26,000 input · 21,000 output

## Community Hubs (Navigation)
- Documentação do Produto e Design
- Documentação Técnica (Backend, Android, Infra)
- Módulos do Frontend Core
- Servidor Local Mock GAS
- Dependências NPM (package.json)
- Configuração do Projeto (JS/TS)
- Ferramentas de Build e Dev
- Scripts Legados de Scanner (old_scripts)
- Lógica de Inventário (Backend + Testes)
- InputArea Legado (Detalhado)
- AssetRepository (Detalhado)
- InventoryService Mock Local (Detalhado)
- Scanner e Input Manual (Frontend Atual)
- BackendService (Detalhado)
- Código da Planilha Cliente (planilha_cliente)
- Registro Remoto de Inventário (Detalhado)
- Manifest GAS (appsscript.json Raiz)
- Modal de Envio de Observações
- Modal de Itens Não Encontrados
- Manifest GAS (Backend)
- Gerenciador de Áudio
- Modal de Edição de Item
- Tabela de Códigos de Barras
- Gerenciador de Sincronização
- Console de Debug
- Mock GAS Frontend (mockGAS.js)
- Painel de Estatísticas
- Autenticação (auth.js)
- Script de Deploy (deploy.js)
- Testes de API

## God Nodes (most connected - your core abstractions)
1. `AssetRepository()` - 25 edges
2. `megaprompt-android-app.md — especificação do app Android nativo` - 22 edges
3. `BackendService()` - 20 edges
4. `InputArea()` - 19 edges
5. `InventoryService` - 19 edges
6. `Changelog (histórico de alterações concluídas)` - 15 edges
7. `InventoryBaseline()` - 14 edges
8. `inventory-logic.js (funções puras, fonte única das regras)` - 14 edges
9. `LocationSelector()` - 13 edges
10. `DATA_FLOW.md — fluxo de dados completo (6 fases)` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Evicção inteligente no _handleStorageFull (SYNCED primeiro)` --semantically_similar_to--> `Entidades Room (Asset, RegistryEntry, PendingMessage, InventoryLocation, InventoryAsset)`  [INFERRED] [semantically similar]
  CHANGELOG.md → megaprompt-android-app.md
- `Entidades Room (Asset, RegistryEntry, PendingMessage, InventoryLocation, InventoryAsset)` --semantically_similar_to--> `Máquina de estados do item (PENDING/IN_FLIGHT/SYNCED/FAILED)`  [INFERRED] [semantically similar]
  megaprompt-android-app.md → DATA_FLOW.md
- `SyncForegroundService (loop contínuo a cada 2s)` --semantically_similar_to--> `Loop de sincronização (lote de 10, intervalo de 2s)`  [INFERRED] [semantically similar]
  megaprompt-android-app.md → DATA_FLOW.md
- `Endpoints REST do mock (8 rotas, validação Joi)` --semantically_similar_to--> `saveCodeBatch(items) — upsert por UID com LockService`  [INFERRED] [semantically similar]
  local_server/README.md → backend/README.md
- `Reativação do barcodeScanner.js (OTG/Bluetooth)` --semantically_similar_to--> `Scanner OTG/Bluetooth via dispatchKeyEvent (keyboard wedge, 50ms)`  [INFERRED] [semantically similar]
  CHANGELOG.md → megaprompt-android-app.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **API Surface do GAS (6 endpoints via google.script.run)** — backend_readme_getinventorydata, backend_readme_getinventorysummary, backend_readme_getnotfounditens, backend_readme_getappsettings, backend_readme_savecodebatch, backend_readme_savemessage [EXTRACTED 1.00]
- **Fluxo de dados offline-first (6 fases: scan → planilha)** — data_flow_offline_first, data_flow_validation_pipeline, data_flow_item_state_machine, data_flow_sync_loop, data_flow_retry_backoff [EXTRACTED 1.00]
- **Arquitetura de sincronização Android (ForegroundService + reativação)** — megaprompt_android_app_sync_foreground_service, megaprompt_android_app_connectivity_receiver, megaprompt_android_app_workmanager_reactivation, megaprompt_android_app_health_check_layers [EXTRACTED 1.00]

## Communities (35 total, 15 thin omitted)

### Community 0 - "Documentação do Produto e Design"
Cohesion: 0.05
Nodes (66): Cache getAppSettings com TTL 60s, Changelog (histórico de alterações concluídas), checkConnectivity() corrigido para getAppSettings, Debounce de 3s no input manual (_recentCodes), doGet() movido e unificado em public.js, Evicção inteligente no _handleStorageFull (SYNCED primeiro), Health check getAppSettings() antes de cada batch, Cache uidToRow incremental no saveCodeBatch (+58 more)

### Community 1 - "Documentação Técnica (Backend, Android, Infra)"
Cohesion: 0.06
Nodes (54): auth.js (autorização em usuarios_autorizados + identidade), backend/README.md — documentação do backend GAS, common.js (include_, jsonSuccess_, jsonError_), Pipeline de deploy (deploy.js: versão, vite build, clasp push), getAppSettings(params) — endpoint GAS com cache 60s, getInventoryData(add_spec) — endpoint GAS, getInventorySummary(targetLocation) — endpoint GAS, getNotFoundItens(targetLocation) — endpoint GAS (+46 more)

### Community 2 - "Módulos do Frontend Core"
Cohesion: 0.10
Nodes (8): AppModal, AssetStatus, ConnectivityManager(), InventoryBaseline(), LoadingModal(), LocationSelector(), processBarcode(), UserWarnings()

### Community 3 - "Servidor Local Mock GAS"
Cohesion: 0.08
Nodes (19): Config, configInstance, __dirname, __filename, GoogleSheetsService, app, createServer(), __dirname (+11 more)

### Community 4 - "Dependências NPM (package.json)"
Cohesion: 0.06
Nodes (32): connect-timeout, cors, express, express-rate-limit, googleapis, joi, morgan, dependencies (+24 more)

### Community 5 - "Configuração do Projeto (JS/TS)"
Cohesion: 0.07
Nodes (27): compilerOptions, allowSyntheticDefaultImports, checkJs, lib, module, moduleResolution, target, types (+19 more)

### Community 6 - "Ferramentas de Build e Dev"
Cohesion: 0.08
Nodes (25): concurrently, eslint, globals, @google/clasp, html5-qrcode, https, devDependencies, concurrently (+17 more)

### Community 7 - "Scripts Legados de Scanner (old_scripts)"
Cohesion: 0.11
Nodes (3): ScannerType, InputFromHtml5Qrcode(), InputFromQuagga2()

### Community 8 - "Lógica de Inventário (Backend + Testes)"
Cohesion: 0.22
Nodes (16): buildAppSettings_(), buildAssetsFinded_(), buildInventoryData_(), buildInventorySummary_(), buildLocationSummaries_(), COL_INV_ASSET, COL_INV_LOCATION, COL_INV_SPECNAME (+8 more)

### Community 12 - "Scanner e Input Manual (Frontend Atual)"
Cohesion: 0.19
Nodes (3): BarcodeScanner(), InputArea(), TODO: Ao reativar esse trecho, criar um método para recuperar o estado do…

### Community 16 - "Manifest GAS (appsscript.json Raiz)"
Cohesion: 0.20
Nodes (9): dependencies, exceptionLogging, runtimeVersion, sheets, macros, timeZone, webapp, access (+1 more)

### Community 20 - "Manifest GAS (Backend)"
Cohesion: 0.29
Nodes (6): dependencies, exceptionLogging, runtimeVersion, sheets, macros, timeZone

### Community 25 - "Console de Debug"
Cohesion: 0.60
Nodes (3): clearDebug(), downloadDebugLog(), setupDebug()

### Community 26 - "Mock GAS Frontend (mockGAS.js)"
Cohesion: 0.60
Nodes (4): createGoogleScriptRun(), initMockGAS(), run(), setMockServerHost()

### Community 30 - "Script de Deploy (deploy.js)"
Cohesion: 0.83
Nodes (3): askConfirmation(), deploy(), setupClaspJson()

## Ambiguous Edges - Review These
- `doGet() movido e unificado em public.js` → `DATA_FLOW.md — fluxo de dados completo (6 fases)`  [AMBIGUOUS]
  DATA_FLOW.md · relation: conceptually_related_to
- `Evicção inteligente no _handleStorageFull (SYNCED primeiro)` → `Máquina de estados do item (PENDING/IN_FLIGHT/SYNCED/FAILED)`  [AMBIGUOUS]
  DATA_FLOW.md · relation: conceptually_related_to
- `checkConnectivity() corrigido para getAppSettings` → `Armadilha: checkConnectivity() chama getInventoryDataJSON inexistente`  [AMBIGUOUS]
  DATA_FLOW.md · relation: conceptually_related_to
- `Remoção de Menu.js e Código.js do backend` → `backend/README.md — documentação do backend GAS`  [AMBIGUOUS]
  backend/README.md · relation: conceptually_related_to
- `Remoção de Menu.js e Código.js do backend` → `Funções do menu da planilha (onOpen, openReader, mostrarPromptDownload)`  [AMBIGUOUS]
  planilha_cliente/README.md · relation: conceptually_related_to

## Knowledge Gaps
- **86 isolated node(s):** `timeZone`, `dependencies`, `executeAs`, `access`, `exceptionLogging` (+81 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `doGet() movido e unificado em public.js` and `DATA_FLOW.md — fluxo de dados completo (6 fases)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Evicção inteligente no _handleStorageFull (SYNCED primeiro)` and `Máquina de estados do item (PENDING/IN_FLIGHT/SYNCED/FAILED)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `checkConnectivity() corrigido para getAppSettings` and `Armadilha: checkConnectivity() chama getInventoryDataJSON inexistente`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Remoção de Menu.js e Código.js do backend` and `backend/README.md — documentação do backend GAS`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Remoção de Menu.js e Código.js do backend` and `Funções do menu da planilha (onOpen, openReader, mostrarPromptDownload)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `AssetRepository()` connect `AssetRepository (Detalhado)` to `Módulos do Frontend Core`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `BackendService()` connect `BackendService (Detalhado)` to `Módulos do Frontend Core`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
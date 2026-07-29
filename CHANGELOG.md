# Changelog

Histórico de alterações concluídas. Entradas são movidas do [TODO.md](./TODO.md) quando finalizadas.

---

## 2026-07-29 — Infraestrutura e otimizações

- **`barcodeScanner.js` reativado** (`main.js`): módulo de scanner via teclado (OTG/Bluetooth) agora é importado e usado. Scanner inicia/pausa conforme seleção de localização.
- **Cache `getAppSettings` com TTL 60s** (`backend/public.js`): `_appSettingsCache` + `_appSettingsCacheTime` evita leitura da planilha a cada chamada. Parâmetro `_forceRefresh` permite bypass do cache.
- **Cache `uidToRow` no `saveCodeBatch`** (`backend/public.js`): `_uidIndexCache` incremental — lê a planilha só no cold start, atualiza incrementalmente nos inserts. Validação anti-stale em cada upsert.
- **`doGet()` movido para `public.js`**: entry point HTTP unificado com as funções de dados. Arquivos `Código.js` e `Menu.js` removidos.
- **Documentação revisada**: CLAUDE.md, PRODUCT.md, README.md, e TODO.md atualizados para refletir o estado real do código (7 abas da planilha, 22 módulos frontend, backend com 4 arquivos `.js` + `appsscript.json`).
- **ESLint ecmaVersion vs target esclarecido**: `ecmaVersion: 2017` no ESLint e `target: "es2015"` no Vite são compatíveis — o ESLint valida o código fonte (ES2017), o esbuild downlevela para ES2015. O GAS V8 suporta ES2017+, então `async/await` e `String.padStart` funcionam em produção sem polyfill.

---

## 2026-07-22 — Rodada 3: 7 problemas de fluxo de dados

- **P1 — `_handleStorageFull` com warning e evicção inteligente** (`assetRepository.js` + `main.js`): SYNCED removidos primeiro, PENDING/FAILED preservados. Evento `storageEmergency` dispara warning "X leituras NÃO SALVAS foram perdidas!".
- **P2 — Health check no `assetSyncManager`** (`assetSyncManager.js`): `getAppSettings()` antes de cada batch. Se inacessível, pula ciclo sem marcar FAILED. Complementa `navigator.onLine`.
- **P3 — Warning de registry offline** (`processBarcode.js`): se `!remoteInventoryRegistry.ready`, avisa "Verificação remota indisponível. Item salvo localmente."
- **P4 — `beforeunload` condicional** (`main.js`): só bloqueia se `stats.pending > 0`. Removeu chamada inútil a `userWarnings.printUserWarning`.
- **P5 — Ícone de sync distingue ocioso** (`statsManager.js`): listener `syncCompleted` mostra ⏸️ quando `total===0 && pending===0`.
- **P6 — `checkConnectivity()` corrigido** (`backendService.js`): `getInventoryDataJSON` → `getAppSettings`.
- **P7 — `async` removido de `hasItem()` e `addItem()`** (`assetRepository.js` + `processBarcode.js`): funções 100% síncronas, `async`/`await` desnecessários removidos.
- **Debug: log de localização** (`locationSelector.js`): `console.log` a cada seleção de local.

---

## 2026-07-22 — Rodada 2: Documentação

- **DESIGN.md gerado** via `/impeccable document`: 27 tokens de cor, 5 escalas tipográficas, 7 variantes de componente, 10 componentes renderizáveis no sidecar.
- **PRODUCT.md atualizado** com base no novo CLAUDE.md: GAS template safety, capabilities expandidas, 7 abas da planilha documentadas.
- **DATA_FLOW.md criado**: fluxo completo de dados em 6 fases, máquina de estados, pontos de atenção.
- **LOCAL_SERVER_TODO.md**: itens do servidor local extraídos para arquivo separado.

---

## 2026-07-22 — Rodada 1: Critique P0 + P1 visuais

- **P0 — Save silencioso no modal de edição** (`editAssetModal.js`): `updateItem()` retorna `false` e o modal fechava como sucesso. Corrigido: warning visível + modal mantém dados abertos para retry.
- **P0 — Double-fire de scanner sem debounce** (`inputArea.js`): mesmo código disparado 2x em <3s era processado em duplicata. Corrigido: cache `_recentCodes` com janela de 3s bloqueia reenvios.
- **P1 — Cabeçalho "Stat" em inglês** (`barcodeTable.js`): trocado para "Status".
- **P1 — Grid de stats com label órfã** (`statsManager.js` + `style.css`): dois containers separados unificados em grid único com `.stats-section-label`.
- **P1 — Emoji noise na tabela de contexto** (`statsManager.js`): removido 📦 redundante; mantidos ✅❌ (suporte a daltonismo) e 🔍 (ícone de ação).

# Changelog

Histórico de alterações concluídas. Entradas são movidas do [TODO.md](./TODO.md) quando finalizadas.

---

## 2026-08-05 — Acesso HTTPS unificado + Correção de modais em telas pequenas + Bloqueio do scanner

### Refatoração do bloqueio do scanner de código de barras

- **Placeholder do input alterado** (`inputArea.js`): "Código (10 dig)" → "Tombamento".
- **Bloqueio automático do scanner ao focar o input manual** (`inputArea.js`): evento `focus` pausa o `barcodeScanner`, evento `blur` reativa (se `inputArea` não estiver bloqueado externamente). Evita que o scanner físico e o input manual compitam pela mesma digitação.
- **`barcodeScanner.start()` removido do `inputArea.unlock()`** (`inputArea.js`): reativação agora é gerenciada exclusivamente pelo evento `blur`, evitando condição de corrida com `setFocus()`.
- **Logs de ativação/desativação do scanner** (`barcodeScanner.js`): `console.log` ao iniciar/parar escuta do leitor em segundo plano.
- **Reestruturação da verificação de localização divergente** (`processBarcode.js`): `bypassCheckLocation` agora é tratado como branch dentro de `retorno.status === 'check'` em vez de dois condicionais separados. Confirmação manual do usuário marca origem com `+userOverrideLocation`; bypass automático marca `+bypassLocationCheck`.
- **Comentário corrigido** (`main.js`): "Força bypass" → "Força verificação para input manual".

### Proxy Vite e unificação HTTPS

- **Proxy Vite para API local** (`vite.config.js`): adicionado `server.proxy` que encaminha `/api/*` para `https://localhost:3000` com `secure: false`. O navegador agora só precisa confiar no certificado da porta 5173 — chega de aceitar dois avisos de segurança.
- **URLs relativas no dev server** (`mockGAS.js`): detecta porta 5173 (`IS_VITE_DEV`) e usa URLs relativas (`/api/...`) em vez de absolutas (`https://host:3000/api/...`), aproveitando o proxy do Vite. Preview e produção não são afetados.
- **Startup do mock server atualizada** (`local_server/server.js`): mensagens agora indicam que a interface é acessada via porta 5173 com proxy.

### Correção de modais em telas pequenas

- **Botões dos modais ocultos em telas pequenas — correção** (`editAssetModal.js`, `messageSendModal.js`): modais abriam com `.is-visible` (`display: block !important`), matando o layout flex column. Trocado para `.is-visible-flex` (`display: flex !important`), igual ao `assetsNotFound.js` que já funcionava. Campos rolam, botões ficam fixos no rodapé.
- **AppModal com scroll interno** (`style.css`): `.app-modal-box` agora é flex column com `max-height: 85vh`; `.app-modal-body` ganhou `overflow-y: auto`; `.app-modal-actions` fixo no fundo com separador. Mensagens longas de confirmação não empurram mais os botões para fora da tela.
- **Safe area para modal footer** (`style.css`): `padding-bottom` e `margin-bottom` de `.modal-body` e `.modal-footer-btns` incluem `env(safe-area-inset-bottom)`, evitando que botões fiquem atrás do gesto de home em iPhones com notch.
- **Media query para telas ≤700px de altura** (`style.css`): padding, gap e margin dos modais reduzidos para caber em viewports pequenas (ex: Samsung A05).

---

## 2026-08-02 — Redesign CSS: Minimalista Linear + Centralização de estilos

- **CSS inline eliminado** (41 ocorrências em 9 arquivos JS): todos os `.style.display`, `.style.zIndex`, `.style.cursor`, e atributos `style="..."` substituídos por `classList.add/remove()` e classes CSS utilitárias (`.is-visible`, `.is-visible-flex`, `.body-no-scroll`, `.is-loading`).
- **`style.css` reescrito** (~1600 linhas, 20 seções): design minimalista tipo Linear, tipografia como protagonista, paleta de cores refinada (primary `#0066CC`, success `#0F7943`, danger `#D11A2A`), sistema de 3 níveis de elevação sutil, tabelas sem bordas verticais com zebra striping, select customizado com seta SVG inline.
- **Tokens tipográficos expandidos**: `--text-2xs` (0.65rem), `--text-sm` (0.8125rem), `--text-4xl` (3rem), `--font-mono` atualizado para SF Mono/Cascadia Code/Consolas.
- **Design tokens atualizados**: gray-50 (`#fafafa`), gray-200 (`#ebebeb`), gray-800 (`#1a1a1a`), bg (`#fafafa`), overlay (0.5), overlay-light (0.35), modal-header (`#f5f5f5`).
- **Modal header**: fundo `#f5f5f5` substitui o `#88b6c2` datado.
- **Warning area**: removido `position: fixed`, agora no fluxo normal da página acima da tabela, sem sombra elevada.
- **Offline banner**: animação `slideDown` (translateY) ao aparecer.
- **Tabela de leituras**: `table-layout: fixed` + colunas percentuais (não ultrapassa a viewport), padding reduzido (4px), coluna Local centralizada.
- **Campos readonly padronizados**: `tombamentoField` alterado de `<input readonly>` para `<div>` (igual `specField` e `locationField`), resolvendo inconsistência semântica (TODO 3.4).
- **Botão Editar**: com borda visível, padding e fonte reduzidos para caber na coluna Ação.
- **`impeccable`**: 6 valores de design ignorados como intencionais (debug console, noscript fallback, focus-visible radius).

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

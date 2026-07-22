# Sugestões de Ajustes e Análise do Projeto

---

## ✅ Concluído (2026-07-22)

### Rodada 1 — Critique P0 + P1 visuais
- [x] **P0 — Save silencioso no modal de edição** (`editAssetModal.js`): `updateItem()` retorna `false` e o modal fechava como sucesso. Corrigido: warning visível + modal mantém dados abertos para retry.
- [x] **P0 — Double-fire de scanner sem debounce** (`inputArea.js`): mesmo código disparado 2x em <3s era processado em duplicata. Corrigido: cache `_recentCodes` com janela de 3s bloqueia reenvios.
- [x] **P1 — Cabeçalho "Stat" em inglês** (`barcodeTable.js`): trocado para "Status".
- [x] **P1 — Grid de stats com label órfã** (`statsManager.js` + `style.css`): dois containers separados unificados em grid único com `.stats-section-label`.
- [x] **P1 — Emoji noise na tabela de contexto** (`statsManager.js`): removido 📦 redundante; mantidos ✅❌ (suporte a daltonismo) e 🔍 (ícone de ação).

### Rodada 2 — Documentação
- [x] **DESIGN.md gerado** via `/impeccable document` — 27 tokens de cor, 5 escalas tipográficas, 7 variantes de componente, 10 componentes renderizáveis no sidecar.
- [x] **PRODUCT.md atualizado** com base no novo CLAUDE.md — GAS template safety, capabilities expandidas, 4 abas da planilha documentadas.
- [x] **DATA_FLOW.md criado** — fluxo completo de dados em 6 fases, máquina de estados, pontos de atenção.
- [x] **LOCAL_SERVER_TODO.md** — itens do servidor local extraídos para arquivo separado.

### Rodada 3 — 7 problemas de fluxo de dados
- [x] **P1 — `_handleStorageFull` com warning e evicção inteligente** (`assetRepository.js` + `main.js`): SYNCED removidos primeiro, PENDING/FAILED preservados. Evento `storageEmergency` dispara warning "X leituras NÃO SALVAS foram perdidas!".
- [x] **P2 — Health check no `assetSyncManager`** (`assetSyncManager.js`): `getAppSettings()` antes de cada batch. Se inacessível, pula ciclo sem marcar FAILED. Complementa `navigator.onLine`.
- [x] **P3 — Warning de registry offline** (`processBarcode.js`): se `!remoteInventoryRegistry.ready`, avisa "Verificação remota indisponível. Item salvo localmente."
- [x] **P4 — `beforeunload` condicional** (`main.js`): só bloqueia se `stats.pending > 0`. Removeu chamada inútil a `userWarnings.printUserWarning`.
- [x] **P5 — Ícone de sync distingue ocioso** (`statsManager.js`): listener `syncCompleted` mostra ⏸️ quando `total===0 && pending===0`.
- [x] **P6 — `checkConnectivity()` corrigido** (`backendService.js`): `getInventoryDataJSON` → `getAppSettings`.
- [x] **P7 — `async` removido de `hasItem()` e `addItem()`** (`assetRepository.js` + `processBarcode.js`): funções 100% síncronas, `async`/`await` desnecessários removidos.
- [x] **Debug: log de localização** (`locationSelector.js`): `console.log` a cada seleção de local.

---

## 1. Crítico — Risco de Perda de Dados

### 1.2 Sem migração de schema do LocalStorage
A chave `BARCODE_APP_DATA_V1` é fixa. Se a estrutura do item mudar, `JSON.parse` no `_load()` pode criar objetos inconsistentes.

**Sugestão:** Adicionar campo `schemaVersion` e função `_migrate()`.

---

## 2. Alto — Integridade e Confiabilidade

### 2.1 `remoteInventoryRegistry` com cache de 30s permite duplicação entre usuários (PARCIAL)
Dois usuários escaneando o mesmo item em intervalo <30s não veem a leitura um do outro. ✅ Já feito: warning quando registry está offline (`!remoteInventoryRegistry.ready`). ❌ Pendente: reduzir intervalo para 10-15s, tentative lock local, deduplicação por código no backend.

**Sugestão:** Reduzir intervalo para 10-15s. Adicionar "tentative lock" local — quando um item é escaneado, registrá-lo imediatamente no cache como provisório. Backend deve ter deduplicação por código de barras, não só por UID.

### 2.2 Erros silenciosos no catch do `processBarcode`
O catch (linhas 166-178) engole qualquer erro e mostra mensagem genérica. Se `assetRepository.addItem` lançar exceção inesperada, o operador não sabe o que aconteceu.

**Sugestão:** Diferenciar tipos de erro (rede, validação, storage cheio) com mensagens específicas.

### 2.3 Quota da Google Sheets API sob carga concorrente
20 usuários escaneando simultaneamente. Cada `saveCodeBatch` faz leitura completa da aba `leituras` (para `uidToRow`) + escritas. Chamadas podem falhar com `ScriptError` por cota.

**Sugestão:** Aumentar `BATCH_SIZE` nos horários de pico, consolidar batches pendentes, usar `CacheService` para o mapa `uidToRow`.

---

## 3. Acessibilidade e UX (achados do critique)

### 3.1 Modals sem atributos ARIA de diálogo
`assetDetailsModal` (editAssetModal.js), `assetNotFoundModal` (assetsNotFound.js), e `modalObs` (messageSendModal.js) não têm `role="dialog"`, `aria-modal="true"`, ou `aria-labelledby`. Screen readers não anunciam abertura de diálogo.

**Sugestão:** Adicionar `role="dialog" aria-modal="true" aria-labelledby="<id-do-h2>"` nos 3 modals.

### 3.2 Sections com `aria-labelledby` órfãos
`index.html` tem 6 `<section>` com `aria-labelledby` referenciando IDs que não existem no DOM (`location-heading`, `scanner-heading`, `warnings-heading`, `not-found-heading`, `table-heading`, `stats-heading`).

**Sugestão:** Ou criar elementos `<h2>` ocultos (sr-only) com esses IDs, ou remover os `aria-labelledby` e usar `aria-label` diretamente.

### 3.3 Touch targets abaixo de 44px
`.clickable-location` (padding vertical 2px), `.cell-link` (sem min-height), `.stat-metrics` (fonte 12px com gap 6px) criam áreas de toque abaixo do mínimo WCAG para mobile.

**Sugestão:** `.clickable-location`: padding vertical mínimo 10px. `.cell-link`: min-height 44px no `<td>` pai. `.stat-metrics`: aumentar fonte para 14px e gap para 8px.

### 3.4 Inconsistência semântica em campos readonly
`tombamentoField` é `<input readonly>` mas `specField` e `locationField` são `<div class="input-modal-readonly">` — mesma função visual, elementos HTML diferentes.

**Sugestão:** Padronizar como `<div>` (não são editáveis, não precisam ser inputs).

### 3.5 Zero onboarding para primeiro acesso
Operador novo vê select, input, checkbox "Ignorar verificação de localização?", stats zerados, tabela vazia. Nenhuma orientação.

**Sugestão:** Overlay de primeiro acesso (3 passos, uma vez, localStorage): (1) Selecione local, (2) Scaneie/digite código, (3) Verifique resultado. Tooltip (i) no checkbox de bypass explicando consequência.

### 3.6 Toast de undo para ações destrutivas
Nenhuma ação de modificação (editar asset, enviar observação, scan com bypass) pode ser desfeita.

**Sugestão:** Toast de 5s "Alterações salvas. Desfazer?" armazenando estado anterior em memória.

### 3.7 Sem atalhos para power users
Sem atalho de teclado para focar input, sem batch edit, sem toggle de densidade de tabela, sem navegação direta para página N.

**Sugestão:** Pelo menos: `/` ou `Ctrl+K` → foco no input de código. Opção de 25/50 itens por página.

---

## 4. Segurança

### 4.1 Backend GAS não sanitiza entradas
`backend/main.js` não aplica sanitização nas strings recebidas. O servidor local tem Joi + validator, mas o GAS real não.

**Sugestão:** Adicionar validação básica no `saveCodeBatch` e `saveMessage` do GAS (tamanho máximo, caracteres permitidos).

---

## 5. Performance

### 5.1 `getAppSettings` sem cache no GAS
Lê a aba `app_config` inteira a cada chamada. Pelo menos uma vez por inicialização de cada cliente.

**Sugestão:** Cache em memória com TTL de 60s via `CacheService.getScriptCache()`.

### 5.2 `remoteInventoryRegistry` faz sync completo em cada `locationChanged`
Mudar de localização dispara sincronização completa. Várias trocas seguidas = N chamadas.

**Sugestão:** Debounce de 2s no handler de `locationChanged`.

### 5.3 `assetRepository._save()` serializa array inteiro a cada 400ms
Para 1000+ itens, `JSON.stringify` + `localStorage.setItem` síncrono pode causar jank.

**Sugestão:** Aumentar debounce para 1000ms, ou limpar itens SYNCED do storage local periodicamente.

---

## 6. Qualidade de Código

### 6.1 Módulos sem padrão consistente
- `AppModal` → objeto literal com métodos
- `AssetRepository` → constructor function + prototype
- `InputArea` → constructor function com `export function`
- `BackendService`, `InventoryBaseline` → constructor function + prototype
- `ProcessBarcode` → `export async function`

**Sugestão:** Documentar convenção no CLAUDE.md (já feito). Migrar `InputArea` e `processBarcode` para constructor+prototype quando conveniente.

### 6.2 `barcodeScanner.js` existe mas não é usado
Módulo implementado e funcional, mas importação comentada em `main.js`.

**Sugestão:** Reativar (necessário para dispositivos sem câmera) ou remover o arquivo.

### 6.3 `state` e `ipvu` como magic numbers
Valores 0-4 para estado e 0-10 para IPVU sem constantes definidas.

**Sugestão:** Criar enum `ConservationState` e `EstimatedLifespan` similar ao `AssetStatus`.

### 6.4 `innerHTML +=` para injeção de botões
`openMessageModalBtn` e `notFoundBtn` injetados via `innerHTML +=` — força reparse completo do container.

**Sugestão:** Usar `insertAdjacentHTML('beforeend', ...)` ou `createElement` + `appendChild`.

### 6.5 ESLint ecmaVersion discorda do target de build
`vite.config.js` define `target: "es2015"` mas `eslint.config.js` usa `ecmaVersion: 2017`. `String.padStart` e `async/await` passam no linter mas precisam de polyfill para ES2015.

**Sugestão:** Alinhar — ou target sobe para ES2017 (GAS V8 suporta) ou ecmaVersion desce para 2015.

---

## 7. Funcionalidades Faltantes

### 7.1 Zero testes automatizados
Nenhum arquivo de teste. Funções como `processBarcode`, `inventoryBaseline.verifyItem` e `assetRepository` são facilmente testáveis.

**Sugestão:** Adicionar testes unitários com Vitest para validação de regex, detecção de duplicidade, verifyItem (encontrado/não-encontrado/divergente), e CRUD do assetRepository.

### 7.2 Sem CI/CD
Deploy manual via `npm run deploy`.

**Sugestão:** GitHub Action que rode lint + testes em PRs para `main`.

### 7.3 Sem log de erros no backend de produção
Erros no GAS só são visíveis no editor do Apps Script. Em produção, ninguém monitora.

**Sugestão:** Adicionar aba `logs` na planilha para registrar erros críticos com timestamp.

---

## 8. Pré-Mortem: Cenários de falha

| # | Cenário | Gatilho | Dano | Mitigação |
|---|---------|---------|------|-----------|
| 1 | LocalStorage overflow | 2000+ itens escaneados | Perda de leituras PENDING com warning ativo | ✅ SYNCED primeiro, evento `storageEmergency` com warning |
| 2 | Duplicação por cache staleness | 2 usuários, mesmo item, <30s | Duplicata na planilha | ⚠️ Parcial: warning offline adicionado. Pendente: intervalo menor + deduplicação |
| 3 | Quota Sheets API estourada | 50 usuários simultâneos | Chamadas falham, fila PENDING cresce | CacheService, batch maior, consolidar batches |
| 4 | Erro de build flag em produção | `__IS_DEV__` mal avaliado | Mock GAS carregado em prod, chamadas para localhost | Smoke test pós-build |
| 5 | Wi-Fi sem internet | `navigator.onLine === true` mas sem rota | Ciclo de sync pula com health check, itens não punidos | ✅ Health check `getAppSettings()` antes de cada batch |

---

## Resumo de Prioridades (atualizado 2026-07-22)

| Prio | Item | Impacto |
|------|------|---------|
| **P0** | 1.2 — Migração de schema do LocalStorage | Perda de dados |
| **Alta** | 2.1 — Duplicação entre usuários (cache 30s) — parcial: warning adicionado | Integridade |
| **Alta** | 2.3 — Quota da Sheets API | App inoperante |
| **Alta** | 3.1 — Modals sem ARIA dialog | Acessibilidade |
| **Alta** | 3.2 — Sections com aria-labelledby órfãos | Acessibilidade |
| **Alta** | 3.5 — Zero onboarding | Experiência |
| **Média** | 3.3 — Touch targets <44px | Acessibilidade |
| **Média** | 3.6 — Sem undo | Experiência |
| **Média** | 4.1 — Sanitização no backend GAS | Segurança |
| **Média** | 5.1 — Cache `getAppSettings` | Performance |
| **Média** | 7.1 — Sem testes | Regressões |
| **Baixa** | 2.2 — Erros silenciosos no catch do `processBarcode` | UX |
| **Baixa** | 3.4 — Inconsistência readonly fields | Qualidade |
| **Baixa** | 3.7 — Sem atalhos power user | UX |
| **Baixa** | 6.2 — `barcodeScanner.js` órfão | Manutenção |
| **Baixa** | 6.4 — `innerHTML +=` | Performance |

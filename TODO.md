# Sugestões de Ajustes e Análise do Projeto

> **Regra:** Itens concluídos são movidos para [CHANGELOG.md](./CHANGELOG.md), não permanecem aqui.

---

## 1. Crítico — Risco de Perda de Dados

### 1.1 Sem migração de schema do LocalStorage
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

### 2.3 Quota da Google Sheets API sob carga concorrente (PARCIAL)
20 usuários escaneando simultaneamente. Cada `saveCodeBatch` faz leitura completa da aba `leituras` (para `uidToRow`) + escritas. Chamadas podem falhar com `ScriptError` por cota.

✅ **Feito:** Cache `_uidIndexCache` incremental no `saveCodeBatch` — planilha lida só no cold start, atualizada incrementalmente nos inserts. Cache `_appSettingsCache` com TTL de 60s no `getAppSettings`.
❌ **Pendente:** `CacheService.getScriptCache()` para cache entre chamadas (o cache atual é em memória, perdido entre requests). Aumentar `BATCH_SIZE` em horários de pico. Consolidar batches pendentes.

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
`backend/public.js` (`saveCodeBatch` e `saveMessage`) não aplica sanitização nas strings recebidas. O servidor local tem Joi + validator, mas o GAS real não.

**Sugestão:** Adicionar validação básica no `saveCodeBatch` e `saveMessage` do GAS (tamanho máximo, caracteres permitidos).

---

## 5. Performance

### 5.1 `remoteInventoryRegistry` faz sync completo em cada `locationChanged`
Mudar de localização dispara sincronização completa. Várias trocas seguidas = N chamadas.

**Sugestão:** Debounce de 2s no handler de `locationChanged`.

### 5.2 `assetRepository._save()` serializa array inteiro a cada 400ms
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

### 6.2 `state` e `ipvu` como magic numbers
Valores 0-4 para estado e 0-10 para IPVU sem constantes definidas.

**Sugestão:** Criar enum `ConservationState` e `EstimatedLifespan` similar ao `AssetStatus`.

### 6.3 `innerHTML +=` para injeção de botões
`openMessageModalBtn` e `notFoundBtn` injetados via `innerHTML +=` — força reparse completo do container.

**Sugestão:** Usar `insertAdjacentHTML('beforeend', ...)` ou `createElement` + `appendChild`.

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
| 3 | Quota Sheets API estourada | 50 usuários simultâneos | Chamadas falham, fila PENDING cresce | ⚠️ Parcial: `_uidIndexCache` + `_appSettingsCache`. Pendente: CacheService, batch maior |
| 4 | Erro de build flag em produção | `__IS_DEV__` mal avaliado | Mock GAS carregado em prod, chamadas para localhost | Smoke test pós-build |
| 5 | Wi-Fi sem internet | `navigator.onLine === true` mas sem rota | Ciclo de sync pula com health check, itens não punidos | ✅ Health check `getAppSettings()` antes de cada batch |

---

## Resumo de Prioridades (atualizado 2026-07-29)

| Prio | Item | Impacto |
|------|------|---------|
| **P0** | 1.1 — Migração de schema do LocalStorage | Perda de dados |
| **Alta** | 2.1 — Duplicação entre usuários (cache 30s) — parcial: warning adicionado | Integridade |
| **Alta** | 2.3 — Quota da Sheets API — parcial: cache uidToRow + getAppSettings | App inoperante |
| **Alta** | 3.1 — Modals sem ARIA dialog | Acessibilidade |
| **Alta** | 3.2 — Sections com aria-labelledby órfãos | Acessibilidade |
| **Alta** | 3.5 — Zero onboarding | Experiência |
| **Média** | 3.3 — Touch targets <44px | Acessibilidade |
| **Média** | 3.6 — Sem undo | Experiência |
| **Média** | 4.1 — Sanitização no backend GAS (`public.js`) | Segurança |
| **Média** | 7.1 — Sem testes | Regressões |
| **Baixa** | 2.2 — Erros silenciosos no catch do `processBarcode` | UX |
| **Baixa** | 3.4 — Inconsistência readonly fields | Qualidade |
| **Baixa** | 3.7 — Sem atalhos power user | UX |
| **Baixa** | 6.3 — `innerHTML +=` | Performance |

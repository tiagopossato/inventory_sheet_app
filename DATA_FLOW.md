# Fluxo de Dados — App Inventário IFC

> Documento de referência para o caminho completo dos dados: do scan até a planilha.
> Atualizado: 2026-07-22

---

## Diagrama de Camadas

```
┌─────────────────────────────────────────────────────────────┐
│                     OPERADOR (Browser Mobile)               │
│                                                             │
│  SCAN ──→ VALIDAÇÃO ──→ LOCAL STORAGE ──→ FILA SYNC ──→ GAS ──→ SHEETS
│   │           │               │                │            │        │
│   │           │               │                │            │        │
│   ▼           ▼               ▼                ▼            ▼        ▼
│ inputArea  processBarcode  assetRepository  assetSync    backend   Google
│  .js         .js             .js            Manager.js   Service   Sheets
│                                                          .js
│                                                             │
│  [offline ✓]  [offline ✓]    [offline ✓]    [offline ✗]  [offline ✗]
└─────────────────────────────────────────────────────────────┘
```

O app é **offline-first**: o scan e a persistência local funcionam sem rede. A sincronização com a planilha é assíncrona e tolerante a falhas.

---

## FASE 1: Captura do Código

**Arquivo:** `frontend/src/inputArea.js`  
**Trigger:** Evento `input` no campo `#manualBarcode`  
**Dependência de rede:** Nenhuma

```
Usuário digita ou scanner dispara caracteres no campo de texto
  │
  ├─ input event dispara a cada caractere
  │   └─ length < 10 → aguarda próximo caractere
  │
  └─ length >= 10 → GATILHO:
      │
      ├─ 1. Limpa o campo imediatamente (antes de processar)
      │      self.manualBarcodeInput.value = ""
      │
      ├─ 2. Verifica debounce (adicionado 2026-07-22):
      │      Se mesmo código nos últimos 3s → IGNORA
      │      Cache: this._recentCodes[codigo] = Date.now()
      │
      └─ 3. Dispara evento assíncrono:
             window.dispatchEvent(new CustomEvent('codeScanned', {
               detail: { code: "2024000123", source: "manual_input" }
             }))
```

**Propriedades do input:**
- `inputmode="numeric"` — teclado numérico no mobile
- `pattern="[0-9]*"` — apenas dígitos
- `autocomplete="nope"` + `data-lpignore="true"` — bloqueia autocomplete e password managers
- `data-form-type="other"` — evita que o browser trate como formulário

**Observações:**
- O campo é limpo **antes** do dispatch. Se `processBarcode` lançar exceção, o campo já está vazio — sem risco de processar o mesmo código 2x.
- O dispatch usa `setTimeout(..., 0)` para não travar a UI.
- O botão "Limpar" (`.btn-danger`) reseta o campo e refoca.

---

## FASE 2: Validação e Processamento

**Arquivo:** `frontend/src/processBarcode.js`  
**Trigger:** Evento `codeScanned` (capturado em `main.js`)  
**Dependência de rede:** Parcial (passo 6 apenas)

```
main.js ouve 'codeScanned'
  │
  ├─ Guarda: if (!codigo || isProcessing) return
  │   isProcessing = true (trava processamento concorrente)
  │
  └─ processBarcode(codigo, selectedLocation, source, bypassCheckLocation)
      │
      ├─ PASSO 1: Local selecionado?
      │   └─ Não → userWarnings + return false
      │
      ├─ PASSO 2: Regex de formato
      │   Regex: /^(199[0-9]|20[0-2][0-9]|2030)\d{6}$/
      │   Formato: YYYYxxxxxx (ano entre 1990-2030 + 6 dígitos)
      │   └─ Inválido → audioManager.playError() + warning + return false
      │
      ├─ PASSO 3: Duplicata local?
      │   └─ assetRepository.hasItem(code, location) → true
      │       └─ audioManager.playWarning() + warning + return false
      │
      ├─ PASSO 4: Existe no inventário mestre?
      │   └─ inventoryBaseline.verifyItem(code, location)
      │       ├─ status: false → não encontrado na base → erro + return false
      │       ├─ status: 'check' → localização divergente → PASSO 5
      │       └─ status: true → OK, prossegue
      │
      ├─ PASSO 5: Localização divergente (se bypassCheckLocation = false)
      │   └─ inputArea.lock() → AppModal.confirm("⚠️ LOCALIZAÇÃO DIVERGENTE")
      │       ├─ Confirmado → prossegue
      │       └─ Cancelado → warning + return false
      │       └─ finally: inputArea.unlock()
      │
      ├─ PASSO 6: Conflito com outro usuário? (REQUER REDE)
      │   └─ remoteInventoryRegistry.checkAssetLocation(code)
      │       ├─ Encontrado em outro local → AppModal.confirm("⚠️ CONFLITO")
      │       │   ├─ Confirmado → prossegue
      │       │   └─ Cancelado → return false
      │       └─ Não encontrado → prossegue
      │
      └─ PASSO 7: Salvar no repositório local
          └─ assetRepository.addItem(code, location, source)
              ├─ Sucesso → audioManager.playSuccess() + renderTable + clearWarning
              └─ Falha → return false
```

**Estados de áudio:**
| Evento | Som |
|--------|-----|
| Scan válido | `playSuccess()` |
| Duplicata / Local divergente / Conflito | `playWarning()` |
| Formato inválido / Não encontrado / Erro | `playError()` |

**Controle de fluxo:**
- `isProcessing` no `main.js` previne processamento concorrente
- `inputArea.lock()` / `inputArea.unlock()` bloqueia novos scans durante modais de confirmação
- `finally` garante desbloqueio mesmo se o modal lançar exceção

---

## FASE 3: Persistência Local (LocalStorage)

**Arquivo:** `frontend/src/assetRepository.js`  
**Dependência de rede:** Nenhuma  
**Storage key:** `BARCODE_APP_DATA_V1`

### Estrutura do Item

```javascript
{
  uid:        "m5k2x8a1b2c3",     // Date.now().toString(36) + random
  code:       2024000123,          // número do tombamento (int)
  location:   "SALA-101",          // localização selecionada
  source:     "manual_input",      // origem (truncado em 24 chars)
  state:      3,                   // estado de conservação (0-4, default 3 = Bom)
  ipvu:       8,                   // vida útil estimada em anos (0-10, default 8)
  obs:        "",                  // observações (max 140 chars)
  status:     "pending",           // pending | inFlight | synced | failed
  retryCount: 0,                   // tentativas de sync
  createdAt:  1721664000000,       // timestamp Unix ms
  updatedAt:  1721664000000        // timestamp Unix ms
}
```

### Máquina de Estados

```
                    addItem()
                       │
                       ▼
    ┌────────────── PENDING ──────────────────┐
    │                 │                        │
    │   markBatchInFlight()                    │
    │                 ▼                        │
    │            IN_FLIGHT ─────────────────┐  │
    │                 │                     │  │
    │    ┌────────────┼──────────┐          │  │
    │    │            │          │          │  │
    │    ▼            ▼          ▼          │  │
    │ syncSuccess  retry < 5  retry >= 5    │  │
    │    │            │          │          │  │
    │    ▼            ▼          ▼          │  │
    │  SYNCED      PENDING    FAILED ───────┘  │
    │                 ▲          │   retryFailed()
    │                 │          │
    │                 └──────────┘
    │              (retryCount reset)
    │
    └── updateItem() → status = PENDING, retryCount = 0
```

### Persistência

```
_save(immediate?)
  │
  ├─ immediate = true  → executa agora (addItem, syncSuccess)
  └─ immediate = false → debounce 400ms (updateItem, markBatchInFlight)
      │
      └─ setTimeout → JSON.stringify(this.items) → localStorage.setItem()

Quota excedida (QuotaExceededError):
  → _handleStorageFull()
      ├─ Ordena por createdAt DESC
      ├─ Mantém 100 mais recentes
      ├─ Descarta o resto (PENDING + SYNCED misturados!)
      └─ Se falhar de novo: limpa tudo (items = [], removeItem)
```

### Inicialização (construtor)

```
new AssetRepository()
  │
  ├─ _load() → localStorage.getItem('BARCODE_APP_DATA_V1') → JSON.parse
  │
  └─ Reativa itens interrompidos:
      ├─ IN_FLIGHT → PENDING (sessão anterior morreu durante envio)
      └─ FAILED   → PENDING (tentar de novo na nova sessão)
```

### Status e seus significados

| Status | Significado | Ação do SyncManager |
|--------|-------------|---------------------|
| `PENDING` | Aguardando envio | Inclui no próximo batch |
| `IN_FLIGHT` | Sendo enviado agora | Aguarda resultado |
| `SYNCED` | Salvo na planilha | Ignorado para sempre |
| `FAILED` | 5+ tentativas falharam | Reenfileirado a cada 15 ciclos (~30s) ou no `retryFailed()` |

---

## FASE 4: Sincronização (Local → Remoto)

**Arquivo:** `frontend/src/assetSyncManager.js`  
**Dependência de rede:** Sim (requer `navigator.onLine === true`)

### Constantes

| Constante | Valor | Significado |
|-----------|-------|-------------|
| `BATCH_SIZE` | 10 | Itens enviados por lote |
| `SYNC_INTERVAL_MS` | 2000 | Intervalo entre ciclos de sync |
| `MAX_RETRIES` | 5 | Tentativas antes de marcar FAILED |
| `FAILED_RETRY_CYCLES` | 15 | A cada quantos ciclos itens FAILED são reenfileirados |

### Loop de Sincronização

```
_startSyncLoop()
  │
  ├─ Guarda: if (this.timer) return  // já está rodando
  │
  ├─ dispatchEvent('syncStarted')     // UI: ícone 🔁 girando
  │
  ├─ _processQueue() IMEDIATO         // não espera o primeiro tick
  │
  └─ setInterval(_processQueue, 2000) // tick a cada 2s

_processQueue()
  │
  ├─ GUARDA 1: if (this.isSyncing)      → return (já tem batch em voo)
  ├─ GUARDA 2: if (!navigator.onLine)    → return (offline, tenta próximo tick)
  │
  ├─ Recuperação periódica (a cada 15 ciclos):
  │   └─ this.repo.retryFailed()  // FAILED → PENDING
  │
  ├─ Pega lote: this.repo.getPendingBatch(10)
  │   └─ Se vazio → _stopSyncLoop() + dispatchEvent('syncCompleted')
  │
  ├─ Marca em voo: this.repo.markBatchInFlight(batchUids)
  │
  ├─ ENVIA: backendService.saveCodeBatch(payload)
  │   │
  │   ├─ SUCESSO:
  │   │   ├─ processSyncSuccess(savedUids)    → status = SYNCED
  │   │   ├─ Itens do lote NÃO retornados     → processSyncRetry(..., 5)
  │   │   └─ dispatchEvent('batchSynced')
  │   │
  │   └─ FALHA (exceção):
  │       └─ processSyncRetry(batchUids, 5)   → retryCount++ → PENDING ou FAILED
  │
  └─ finally: this.isSyncing = false

_stopSyncLoop()
  └─ clearInterval(this.timer); this.timer = null
```

### Gatilhos de início/parada

| Evento | Ação |
|--------|------|
| `repositoryChanged` | `_startSyncLoop()` — novo item adicionado |
| `online` | `retryFailed()` + `_startSyncLoop()` — rede voltou |
| `offline` | `_stopSyncLoop()` — rede caiu |
| Construtor | `_startSyncLoop()` — sempre tenta ao carregar a página |

### Comportamento Offline → Online

```
App carrega OFFLINE:
  │
  ├─ assetRepository reativa IN_FLIGHT/FAILED → PENDING
  ├─ assetSyncManager._startSyncLoop() → timer criado
  ├─ _processQueue(): !navigator.onLine → return
  ├─ A cada 2s: _processQueue(): !navigator.onLine → return
  └─ Itens acumulam como PENDING no LocalStorage

REDE VOLTA ('online' event):
  │
  ├─ retryFailed() → FAILED → PENDING
  ├─ _startSyncLoop() → timer já existe → return
  └─ Próximo tick (0-2s): _processQueue() → navigator.onLine = true → PROSSEGUE
      └─ Batches de 10 itens a cada 2s até esvaziar a fila
```

**Observação:** Se o app **carrega** offline, o timer é criado mas fica em loop vazio. Quando a rede volta, o sync retoma em no máximo 2 segundos. Se o app estava online, foi para offline, e voltou: `_stopSyncLoop()` matou o timer, `_startSyncLoop()` cria um novo.

---

## FASE 5: Transporte (GAS)

**Arquivo:** `frontend/src/backendService.js`  
**Dependência de rede:** Sim

### Produção (Google Apps Script)

```
saveCodeBatch(payload)
  │
  └─ _callBackend('saveCodeBatch', payload)
      │
      ├─ Config: timeout 15s, maxRetries 2, baseDelay 2s
      │
      └─ _retryOperation(operation, options)
          │
          └─ Tentativa 0..2:
              │
              └─ google.script.run
                  .withSuccessHandler(result → resolve)
                  .withFailureHandler(error → reject)
                  .saveCodeBatch(params)
                  │
                  ├─ Timeout 15s → reject('Timeout na chamada')
                  │
                  └─ Falha → exponential backoff + jitter:
                      delay = min(2000 × 2^attempt × (0.5 + random), 12000)
                      │
                      ├─ Erro retentável (ScriptError, Rate Limit, Timeout):
                      │   └─ await sleep(delay) → próxima tentativa
                      │
                      └─ Erro não-retentável (Auth, 404):
                          └─ break → throw
```

### Desenvolvimento (Mock Local)

```
__IS_DEV__ → import('./mockGAS.js')
  │
  └─ Substitui google.script.run
      │
      └─ Redireciona chamadas via fetch() para:
          https://localhost:3000/api/<functionName>
          │
          └─ Express server (local_server/server.js)
              │
              └─ Google Sheets API (service account)
                  └─ spreadsheet.values.get() / append()
```

### Configurações por endpoint

| Endpoint | Timeout | Max Retries | Base Delay |
|----------|---------|-------------|------------|
| `saveCodeBatch` | 15s | 2 | 2s |
| `getInventorySummary` | 30s | 3 | 1s |
| `getNotFoundItens` | 25s | 2 | 1.5s |
| `saveMessage` | 10s | 1 | 3s |
| `getInventoryData` | 20s | 3 | 1s |
| `getAppSettings` | 30s (default) | 3 (default) | 2s (default) |

---

## FASE 6: Destino (Google Sheets)

**Arquivo:** `backend/main.js` (GAS) ou `local_server/gas-simulation.js` (dev)  
**Tabelas:**

| Aba | Leitura/Escrita | Função GAS |
|-----|-----------------|------------|
| `inventario` | Leitura | `getInventoryData()` |
| `leituras` | Escrita | `saveCodeBatch(payload)` |
| `observacoes` | Escrita | `saveMessage(payload)` |
| `app_config` | Leitura | `getAppSettings()` |

### saveCodeBatch — Fluxo no Backend

```
GAS recebe POST / saveCodeBatch
  │
  ├─ 1. Lê aba 'leituras' inteira (para construir uidToRow)
  │     └─ spreadsheet.getSheetByName('leituras').getDataRange().getValues()
  │
  ├─ 2. Para cada item no batch:
  │     ├─ Se UID já existe na planilha → ATUALIZA linha existente
  │     └─ Se UID novo → APPEND nova linha
  │         ├─ Coluna A: timestamp
  │         ├─ Coluna B: uid
  │         ├─ Coluna C: código de barras
  │         ├─ Coluna D: localização
  │         ├─ Coluna E: estado
  │         ├─ Coluna F: ipvu
  │         ├─ Coluna G: observações
  │         └─ Coluna H: source
  │
  └─ 3. Retorna array de UIDs salvos com sucesso
```

---

## Resumo: O que funciona offline e o que não funciona

| Operação | Offline? | Mecanismo |
|----------|----------|-----------|
| Digitar/scannear código | ✅ | Evento `input` no DOM |
| Validar formato (regex) | ✅ | Regex em memória |
| Verificar duplicata local | ✅ | `Array.some()` nos items em memória |
| Consultar inventário mestre | ✅ | `inventoryBaseline` carregado em memória no startup |
| Salvar no LocalStorage | ✅ | `localStorage.setItem()` |
| Sincronizar com GAS | ❌ | `google.script.run` requer rede |
| Verificar conflito com outros usuários | ❌ | `remoteInventoryRegistry` consulta GAS |
| Carregar dados do inventário | ❌ | `backendService.getInventoryData()` requer rede |
| Carregar configurações (app_config) | ❌ | `backendService.getAppSettings()` requer rede |

### O que acontece se o app carrega totalmente offline?

1. `getInventoryData()` e `getAppSettings()` falham
2. `inventoryBaseline` fica sem dados → `verifyItem()` retorna `false` para tudo
3. Nenhum scan é aceito porque o passo 4 da validação falha

**Consequência:** O app **precisa carregar online** na inicialização para baixar o inventário mestre e as configurações. Depois de carregado, opera offline indefinidamente. Se o inventário for embutido no build (`__HAS_INVENTORY_DATA__`), o app funciona 100% offline desde o primeiro scan.

---

## Pontos de Atenção no Fluxo

### 1. `navigator.onLine` não é confiável
`navigator.onLine` detecta interface de rede, não acesso à internet. Dispositivo em Wi-Fi sem rota (ex: captive portal de shopping) reporta `true`, sync tenta, falha 5x, itens vão para FAILED. O operador vê ❌ sem saber o motivo real.

### 2. `_handleStorageFull` descarta PENDING
Quando a quota estoura, o método trunca para 100 itens mais recentes. Se houver 50 SYNCED + 60 PENDING, 10 leituras não-sincronizadas são perdidas **sem warning**.

### 3. Corrida na inicialização offline
`assetRepository` reativa itens e dispara `repositoryChanged` → `assetSyncManager._startSyncLoop()` → `_processQueue()` → `!navigator.onLine` → return. Timer fica rodando. Itens ficam PENDING até a rede voltar. Nenhum dado é perdido, mas o operador vê "3 pendentes" sem indicação de que o app está aguardando rede.

### 4. Sem health check real
`backendService.checkConnectivity()` chama `getInventoryDataJSON` que não existe. Ninguém usa essa função no fluxo principal, mas é uma armadilha.

# Documentação do Backend - Google Apps Script

## Estrutura de Arquivos

### `appsscript.json`
Arquivo de configuração do projeto Google Apps Script. Define timezone (`America/Sao_Paulo`), runtime V8, logging Stackdriver, e configuração do webapp (`USER_DEPLOYING` com acesso `ANYONE_ANONYMOUS`).

### `public.js`
Ponto de entrada principal e thin adapter de I/O. Contém:

- **`doGet()`** — Serve o `index.html` da aplicação web.
- **Funções de dados** (expostas ao frontend via `google.script.run`):
  - `getInventoryData(add_spec)` — Lista de locais + inventário agrupado (lê aba `inventario`)
  - `getInventorySummary(targetLocation)` — Resumo de leituras por localidade (lê abas `leituras` + `localidades`)
  - `getNotFoundItens(targetLocation)` — Itens não encontrados num local (lê aba `nao_encontrados_geral`)
  - `getAppSettings(params)` — Configurações chave-valor com cache de 60s (lê aba `app_config`)
  - `saveCodeBatch(items)` — Salva/atualiza lote de leituras com LockService e cache UID (escreve aba `leituras`)
  - `saveMessage(payload)` — Salva observação com dedup por UID (escreve aba `observacoes`)

**Padrão**: Todas as funções de dados autenticam via `authenticateRequest_()` (definida em `auth.js`) e delegam a lógica de transformação para `inventory-logic.js`.

### `inventory-logic.js`
**Módulo canônico de lógica de negócio.** Funções puras de transformação — sem I/O de planilha. Single source of truth para toda regra de negócio.

Usa sintaxe ES modules (`export`) para consumo por Node.js (testes). O `deploy.js` remove `export` para compatibilidade com GAS.

Funções exportadas:
- `buildInventoryData_(invData, addSpec)` — Transforma linhas da aba `inventario` em `{locations, inventory}`
- `buildInventorySummary_(leiturasData, localidadesData, targetLocation)` — Compõe resumo completo
- `groupLeiturasByLocation_(data)` — Agrupa códigos lidos por localidade
- `buildLocationSummaries_(locData, targetLocation)` — Constrói sumário por localidade
- `buildAssetsFinded_(groups)` — Ordena e estrutura ativos encontrados
- `filterNotFoundItems_(data, targetLocation)` — Filtra itens não encontrados por localidade
- `buildAppSettings_(data)` — Converte linhas de config em objeto chave-valor com tipagem automática

Constantes de coluna (índices base 0):
- `COL_INV_LOCATION`, `COL_INV_ASSET`, `COL_INV_SPECNAME` — Aba `inventario`
- `COL_LEITURAS_CODE`, `COL_LEITURAS_LOC` — Aba `leituras`
- `COL_NOTFOUND_LOC`, `COL_NOTFOUND_ASSET` — Aba `nao_encontrados_geral`
- `SPEC_NAME_MAX_LEN` — Limite de 140 caracteres para especificação

### `auth.js`
Autorização e identidade do usuário:

- **`checkAuthorization_(email)`** — Verifica se o email está na aba `usuarios_autorizados` (Col A: email, Col C: ativo)
- **`authenticateRequest_()`** — Valida o usuário da sessão atual; lança erro se não autorizado
- **`getUserName_()`** — Extrai nome do email (parte antes do `@`) ou retorna `'anonimo'`

### `common.js`
Utilitários compartilhados:

- **`include_(filename)`** — Helper para GAS HTML Templates (`<?!= include_('Style'); ?>`)
- **`jsonSuccess_(data)`** — Retorna `{result, success: true}` como JSON (para API REST)
- **`jsonError_(message)`** — Retorna `{error, success: false}` como JSON (para API REST)

### `Menu.js`
Integração com menu do Google Sheets:

- **`onOpen(e)`** — Cria menu "APP Inventário" na planilha
- **`openReader()`** — Exibe modal com QR code para acesso ao app
- **`mostrarPromptDownload()`** — Gera download do JSON de inventário (comentado no menu)

## Arquitetura

```
Browser (google.script.run)
    ↓
public.js (thin I/O adapter + autenticação)
    ↓
inventory-logic.js (funções puras de transformação)
    ↓
Google Sheets (abas: inventario, leituras, localidades,
              nao_encontrados_geral, observacoes,
              app_config, usuarios_autorizados)
```

**Princípio**: `public.js` contém apenas I/O de planilha e autenticação. Toda regra de transformação de dados está em `inventory-logic.js`. Alterou regra de negócio? Mexa **somente** em `inventory-logic.js`.

## Deploy

```bash
npm run deploy:homolog  # Staging
npm run deploy          # Produção
```

O pipeline (`deploy.js`):
1. Incrementa versão em `version.json`
2. `vite build` → `dist/index.html`
3. Copia `backend/*.js`, `*.gs`, `appsscript.json` → `dist/`
4. Remove `export` de `inventory-logic.js` (compatibilidade GAS)
5. `clasp push` → Google Apps Script
6. (Opcional) `clasp update-deployment` → publicação

## Configuração e Permissões

O script requer permissões para:
- Acesso a Google Sheets (`SpreadsheetApp`)
- Execução como usuário autenticado
- Operações de leitura/escrita em planilhas
- `LockService` para controle de concorrência em escritas

## Documentação das Funções

### API Surface (funções expostas ao frontend via `google.script.run`)

#### `getInventoryData(add_spec)`
**Propósito:** Obtém dados consolidados do inventário agrupados por localidade.

**Parâmetros:** `add_spec` (boolean, opcional, default `true`) — Se `true`, inclui `name` em cada asset.

**Retorno:**
```javascript
{
    locations: Array<{name: string, assetsCount: number}>,
    inventory: Array<{location: string, assets: Array<{code: number, name?: string}>}>
}
```

#### `getInventorySummary(targetLocation)`
**Propósito:** Gera resumo do inventário baseado nas leituras realizadas.

**Parâmetros:** `targetLocation` (string, opcional) — Filtra por localidade específica.

**Retorno:**
```javascript
{
    locations: Array<{name: string, totalAssets: number, assetsFindedCount: number, missingAssets: number}>,
    assetsFinded: Array<{location: string, assets: number[]}>
}
```

#### `saveCodeBatch(items)`
**Propósito:** Salva/atualiza lote de leituras na aba `leituras`. Operação idempotente (UID-based upsert) com `LockService` para evitar conflitos.

**Parâmetros:** `items` — Array de `{uid, code, location, state, ipvu, obs, source}`.

**Retorno:** `Array<string>` — UIDs persistidos.

#### `saveMessage(payload)`
**Propósito:** Salva observação na aba `observacoes` com verificação de duplicidade por UID.

**Parâmetros:** `payload` — `{uid, location, message}`.

**Retorno:** `string` — UID da mensagem salva.

#### `getNotFoundItens(targetLocation)`
**Propósito:** Obtém lista de itens não encontrados filtrados por localidade.

**Parâmetros:** `targetLocation` (string, obrigatório) — Nome da localidade.

**Retorno:** `Array<Array<string>>` — Lista de `[Tombamento]`.

#### `getAppSettings(params)`
**Propósito:** Lê configurações da aba `app_config`. Cache de 60 segundos.

**Parâmetros:** `params` — `{_forceRefresh?: boolean}`.

**Retorno:** `Object` — Configurações em formato chave-valor com tipagem automática (Date → ISO string, 'true'/'false' → boolean).

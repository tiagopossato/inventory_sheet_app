/**
 * public.js — THIN ADAPTER Google Apps Script
 * ============================================
 *
 * Camada fina de I/O para o Google Apps Script. Contém `doGet()` (entry point
 * HTTP) e as funções de dados expostas ao frontend via `google.script.run`.
 *
 * **TODA a lógica de transformação** está em `inventory-logic.js`.
 * Este arquivo contém apenas: autenticação, leitura/escrita de planilhas,
 * LockService, e delegação para as funções puras.
 *
 * ## API Surface (funções expostas ao frontend)
 *
 * | Função                  | Aba lida           | Descrição                              |
 * |-------------------------|--------------------|----------------------------------------|
 * | `getInventoryData()`    | `inventario`       | Locais + inventário agrupado           |
 * | `getInventorySummary()` | `leituras` + `localidades` | Resumo de leituras por local   |
 * | `getNotFoundItens()`    | `nao_encontrados_geral` | Itens não encontrados num local   |
 * | `getAppSettings()`      | `app_config`       | Configurações chave-valor (cache 60s)  |
 * | `saveCodeBatch(items)`  | `leituras` (write) | Salva/atualiza lote (upsert por UID)   |
 * | `saveMessage(payload)`  | `observacoes` (write) | Salva observação (com dedup)        |
 *
 * ## Fluxo de uma chamada
 *
 * ```
 * frontend (google.script.run)
 *   → public.js (autentica + lê planilha)
 *     → inventory-logic.js (transforma dados)
 *       → retorna para o frontend
 * ```
 *
 * ## Deploy
 *
 * `npm run deploy` → deploy.js:
 *   1. Vite build → dist/index.html (single file)
 *   2. Copia backend/*.js, *.gs, appsscript.json → dist/
 *   3. Remove "export " de inventory-logic.js (GAS não suporta ES modules)
 *   4. clasp push → GAS project
 *   5. (opcional) clasp update-deployment → publicação
 *
 * No ambiente GAS, inventory-logic.js e public.js compartilham escopo global
 * (após o deploy.js remover `export`).
 *
 * @module public
 * @author Tiago Possato
 */

// ============================================================
// doGet — Entry point HTTP
// ============================================================

/**
 * Entry point HTTP do Google Apps Script.
 * Executada quando o usuário acessa a URL do webapp.
 * Serve o arquivo `index.html` (single-file build do Vite).
 *
 * @param {Object} event - Evento de requisição HTTP do GAS (não utilizado diretamente)
 * @param {string} [title='Aplicativo leitor'] - Título da aba do navegador
 * @param {string} [faviconUrl='https://videira.ifc.edu.br/wp-content/themes/ifc/img/ifc.png'] - URL do favicon
 * @returns {GoogleAppsScript.HTML.HtmlOutput} Página HTML com sandbox IFRAME e viewport meta tag
 */
function doGet(event, title = 'Aplicativo leitor', faviconUrl = 'https://videira.ifc.edu.br/wp-content/themes/ifc/img/ifc.png') {
    authenticateRequest_();
    return HtmlService
        // 1. Cria um template a partir do arquivo 'index.html'.
        // Isso permite que o código Apps Script (como <?!= include_() ?>) seja executado.
        //.createTemplateFromFile('index') // Se usar template, alterar minify para false no arquivo vite.config.js

        // 2. Avalia (processa) o template, executando qualquer código Apps Script embutido.
        //.evaluate()

        .createHtmlOutputFromFile('index')

        // 3. Define o título que aparece na aba do navegador.
        .setTitle(title)

        // 4. Define o ícone de favoritos (favicon) da aplicação.
        .setFaviconUrl(faviconUrl)

        // 5. Configura o modo sandbox de segurança. IFRAME é o modo mais seguro e moderno.
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)

        // 6. Adiciona a meta tag viewport, essencial para garantir que a interface seja
        // responsiva e se adapte corretamente a telas de celular.
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}



// ============================================================
// getInventoryData — Aba "inventario"
// ============================================================

/**
 * Obtém os dados completos do inventário agrupados por localidade.
 * Lê a aba "inventario" (colunas D-L a partir da linha 2) e delega a
 * transformação para `buildInventoryData_()` em `inventory-logic.js`.
 *
 * @param {boolean} [addSpec=true] - Se `true`, inclui `name` (coluna L) em cada asset
 * @returns {{ locations: Array<{name: string, assetsCount: number}>, inventory: Array<{location: string, assets: Array<{code: number, name?: string}>}> }}
 *
 * @example
 * // Retorno com addSpec=true (default)
 * {
 *   locations: [{ name: "Sala 101", assetsCount: 45 }, ...],
 *   inventory: [{ location: "Sala 101", assets: [{ code: 12345, name: "Computador" }, ...] }, ...]
 * }
 */
function getInventoryData(addSpec) {
    // authenticateRequest_();
    if (addSpec === undefined) { addSpec = true; }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetInventario = ss.getSheetByName('inventario');

    if (!sheetInventario) {
        throw new Error("getInventoryData: Aba 'inventario' não encontrada.");
    }

    const lastRowInv = sheetInventario.getLastRow();
    if (lastRowInv < 2) {
        return { locations: [], inventory: [] };
    }

    const numCols = addSpec ? 9 : 3;
    const invData = sheetInventario.getRange(2, 4, lastRowInv - 1, numCols).getValues();

    // Delega para inventory-logic.js
    return buildInventoryData_(invData, addSpec);
}

// ============================================================
// getInventorySummary — Abas "leituras" + "localidades"
// ============================================================

/**
 * @typedef {Object} LocationSummary
 * @property {string} name - Nome da localidade
 * @property {number} totalAssets - Total de bens na localidade
 * @property {number} assetsFindedCount - Quantos foram encontrados na leitura
 * @property {number} missingAssets - Quantos faltam ser lidos
 */

/**
 * @typedef {Object} AssetMapping
 * @property {string} location - Nome da localidade
 * @property {number[]} assets - Códigos dos bens encontrados
 */

/**
 * Gera o resumo do inventário com base nas leituras já realizadas.
 * Lê as abas "leituras" (colunas B-D) e "localidades" (A-D) e delega a
 * transformação para `buildInventorySummary_()` em `inventory-logic.js`.
 *
 * @param {string|null} [targetLocation=null] - Localidade específica para filtrar, ou `null` para todas
 * @returns {{ locations: LocationSummary[], assetsFinded: AssetMapping[] }}
 *
 * @example
 * // Sem filtro
 * getInventorySummary(null)
 * // → { locations: [...], assetsFinded: [{ location: "Sala 101", assets: [12345, 12346] }, ...] }
 *
 * // Com filtro
 * getInventorySummary("Sala 101")
 * // → { locations: [{ name: "Sala 101", ... }], assetsFinded: [{ location: "Sala 101", assets: [...] }] }
 */
function getInventorySummary(targetLocation) {
    // authenticateRequest_();
    if (targetLocation === undefined) { targetLocation = null; }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- Aba "leituras" ---
    const sheetDados = ss.getSheetByName("leituras");
    if (!sheetDados) {
        throw new Error("getInventorySummary: Aba 'leituras' não encontrada.");
    }

    let leiturasData = [];
    const sheetDadosLastRow = sheetDados.getLastRow();
    if (sheetDadosLastRow >= 2) {
        leiturasData = sheetDados.getRange(2, 2, sheetDadosLastRow - 1, 3).getValues();
    }

    // --- Aba "localidades" ---
    const sheetLoc = ss.getSheetByName("localidades");
    if (!sheetLoc) {
        throw new Error("getInventorySummary: Aba 'localidades' não encontrada.");
    }

    let localidadesData = [];
    const sheetLocLastRow = sheetLoc.getLastRow();
    if (sheetLocLastRow >= 2) {
        localidadesData = sheetLoc.getRange('A2:D' + sheetLocLastRow).getValues();
    }

    // Delega para inventory-logic.js
    return buildInventorySummary_(leiturasData, localidadesData, targetLocation);
}


// ============================================================
// saveCodeBatch — Aba "leituras" (escrita com Lock + cache UID)
// ============================================================

/**
 * Cache do índice UID → linha na aba "leituras".
 * Evita ler a planilha inteira a cada chamada de `saveCodeBatch()`.
 * Invalidado e recriado quando um UID não é encontrado na linha esperada.
 * @type {Object<string, number>|null}
 * @private
 */
let _uidIndexCache = null;

/**
 * Última linha conhecida no momento da criação do cache.
 * Usado internamente para detectar stale cache.
 * @type {number}
 * @private
 */
let _uidIndexLastRow = 0;

/**
 * Salva ou atualiza um lote de leituras na aba "leituras".
 *
 * Operação idempotente baseada em UID:
 * - Se o UID já existe na planilha → atualiza a linha existente
 * - Se o UID é novo → faz append no final
 *
 * Usa `LockService` para evitar race conditions em escritas concorrentes
 * e mantém um cache incremental do índice UID→linha para performance.
 *
 * @param {Array<{uid: string, code: (string|number), location: string, state: number, ipvu: number, obs: string, source: string}>} items - Lote de leituras a persistir
 * @returns {string[]} Array de UIDs persistidos com sucesso
 *
 * @throws {Error} Se a aba "leituras" não for encontrada
 * @throws {Error} Se o LockService não puder adquirir o lock em 30s
 */
function saveCodeBatch(items) {
    // authenticateRequest_();
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    /**
     * Constrói o índice UID → linha a partir da coluna A da aba "leituras".
     * Cacheado em `_uidIndexCache` — só lê a planilha no cold start.
     *
     * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Aba "leituras"
     * @returns {Object<string, number>} Mapa UID → número da linha
     * @private
     */
    function getUidIndex(sheet) {
        if (_uidIndexCache) return _uidIndexCache;

        _uidIndexCache = Object.create(null);
        const lastRow = sheet.getLastRow();
        _uidIndexLastRow = lastRow;
        if (lastRow > 1) {
            const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
            for (let i = 0; i < values.length; i++) {
                const uid = values[i][0];
                if (uid) _uidIndexCache[uid] = 2 + i;
            }
        }
        return _uidIndexCache;
    }

    /**
     * Valida que o UID na linha cacheada ainda é o esperado.
     * Lê apenas 1 célula — evita re-leitura completa da planilha.
     *
     * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Aba "leituras"
     * @param {string} uid - UID esperado
     * @param {number} row - Linha onde o UID deveria estar
     * @returns {boolean} `true` se o UID confere
     * @private
     */
    function validateUidAtRow(sheet, uid, row) {
        const actualUid = sheet.getRange(row, 1).getValue();
        return actualUid === uid;
    }

    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
    } catch (e) {
        throw new Error('Servidor ocupado. Tente novamente.');
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName("leituras");
        if (!sheet) {
            throw new Error('Aba "leituras" não encontrada.');
        }

        const HEADER_ROWS = 1;

        const now = new Date();
        const formattedDate = Utilities.formatDate(
            now,
            Session.getScriptTimeZone(),
            'dd/MM/yyyy HH:mm:ss'
        );
        const user = getUserName_();

        // Índice UID→linha com cache (lê planilha só no cold start)
        let uidToRow = getUidIndex(sheet);
        let indexStale = false;

        const rowsToUpdate = [];
        const rowsToAppend = [];
        const persistedUids = [];

        items.forEach(function (item) {
            if (!item || !item.uid) return;

            const rowData = [
                String(item.uid),
                formattedDate,
                String(item.code != null ? item.code : ''),
                String(item.location != null ? item.location : ''),
                user,
                Number(item.state != null ? item.state : ''),
                Number(item.ipvu != null ? item.ipvu : ''),
                String(item.obs != null ? item.obs : ''),
                String(item.source != null ? item.source : '')
            ];

            let existingRow = uidToRow[item.uid];

            // Valida que o UID na linha cacheada ainda é o correto
            if (existingRow && !validateUidAtRow(sheet, item.uid, existingRow)) {
                // Cache stale — invalida e recria
                _uidIndexCache = null;
                uidToRow = getUidIndex(sheet);
                existingRow = uidToRow[item.uid];
                indexStale = true;
            }

            if (existingRow) {
                rowsToUpdate.push({ row: existingRow, data: rowData });
            } else {
                rowsToAppend.push(rowData);
            }

            persistedUids.push(item.uid);
        });

        // Updates
        rowsToUpdate
            .sort(function (a, b) { return a.row - b.row; })
            .forEach(function (update) {
                sheet
                    .getRange(update.row, 1, 1, LAST_COL_LEITURAS)
                    .setValues([update.data]);
            });

        // Appends
        if (rowsToAppend.length > 0) {
            const appendStartRow = sheet.getLastRow() + 1;
            sheet
                .getRange(appendStartRow, 1, rowsToAppend.length, LAST_COL_LEITURAS)
                .setValues(rowsToAppend);

            // Atualiza cache incrementalmente com os novos UIDs
            if (!indexStale && _uidIndexCache) {
                for (let a = 0; a < persistedUids.length; a++) {
                    const appendedUid = persistedUids[a];
                    if (!_uidIndexCache[appendedUid]) {
                        _uidIndexCache[appendedUid] = appendStartRow + a;
                    }
                }
            }
        }

        return persistedUids;

    } catch (err) {
        Logger.log('Erro em saveCodeBatch:', err);
        throw new Error('Falha ao salvar lote: ' + err.message);
    } finally {
        lock.releaseLock();
    }
}

// ============================================================
// saveMessage — Aba "observacoes" (escrita com Lock)
// ============================================================

/**
 * Salva uma observação na aba "observacoes".
 *
 * Verifica duplicidade por UID antes de escrever (idempotente).
 * Usa `LockService` para evitar race conditions.
 *
 * @param {{ uid: string, location: string, message: string }} payload - Dados da observação
 * @returns {string} UID da observação salva (ou já existente)
 *
 * @throws {Error} Se a aba "observacoes" não for encontrada
 * @throws {Error} Se o LockService não puder adquirir o lock em 30s
 *
 * @example
 * saveMessage({ uid: "abc-123", location: "Sala 101", message: "Ar condicionado quebrado" })
 * // → "abc-123"
 */
function saveMessage(payload) {
    // authenticateRequest_();
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
    } catch (e) {
        throw new Error('Servidor ocupado. Tente novamente.');
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName("observacoes");

        if (!sheet) {
            throw new Error("saveMessage: Aba 'observacoes' não encontrada.");
        }

        const uuid = payload.uid;

        // Verificação de duplicidade
        const lastRow = sheet.getLastRow();
        if (lastRow > 0) {
            const uidsExistentes = sheet.getRange(1, 1, lastRow, 1).getValues().flat();
            if (uidsExistentes.includes(uuid)) {
                return uuid;
            }
        }

        const now = new Date();
        const formattedDate = Utilities.formatDate(
            now,
            Session.getScriptTimeZone(),
            'dd/MM/yyyy HH:mm:ss'
        );
        const aferidor = getUserName_();

        sheet.appendRow([
            uuid,
            formattedDate,
            payload.location,
            aferidor,
            payload.message
        ]);

        return uuid;

    } catch (error) {
        Logger.log("Erro ao salvar mensagem:", error);
        throw new Error("Falha ao salvar observação: " + error.message);
    } finally {
        lock.releaseLock();
    }
}

// ============================================================
// getNotFoundItens — Aba "nao_encontrados_geral"
// ============================================================

/**
 * Obtém a lista de bens não encontrados em uma localidade específica.
 * Lê a aba "nao_encontrados_geral" (colunas A-C a partir da linha 3)
 * e delega a filtragem para `filterNotFoundItems_()` em `inventory-logic.js`.
 *
 * @param {string} targetLocation - Nome da localidade (obrigatório)
 * @returns {Array<Array<string>>} Lista de `[Tombamento]` dos bens não encontrados
 *
 * @throws {Error} Se `targetLocation` não for fornecido
 * @throws {Error} Se a aba "nao_encontrados_geral" não for encontrada
 *
 * @example
 * getNotFoundItens("Sala 101")
 * // → [["12345"], ["12346"], ["12347"]]
 */
function getNotFoundItens(targetLocation) {
    // authenticateRequest_();
    if (!targetLocation) {
        throw new Error("getNotFoundItens: targetLocation não fornecido.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('nao_encontrados_geral');

    if (!sheet) {
        throw new Error("getNotFoundItens: aba nao_encontrados_geral não encontrada");
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return [];

    const data = sheet.getRange(3, 1, lastRow - 2, 3).getValues();

    // Delega para inventory-logic.js
    return filterNotFoundItems_(data, targetLocation);
}

// ============================================================
// getAppSettings — Aba "app_config" (com cache de 60s)
// ============================================================

/**
 * Cache em memória das configurações do app.
 * @type {Object|null}
 * @private
 */
let _appSettingsCache = null;

/**
 * Timestamp (Date.now()) da última atualização do cache.
 * @type {number}
 * @private
 */
let _appSettingsCacheTime = 0;

/**
 * Tempo de vida do cache de configurações em milissegundos.
 * @const {number}
 * @private
 */
const APPSETTINGS_CACHE_TTL = 60 * 1000;

/**
 * Lê as configurações do aplicativo na aba "app_config".
 *
 * Converte as linhas (Col A=chave, Col B=valor) em objeto chave-valor
 * com tipagem automática (Date → ISO string, 'true'/'false' → boolean).
 * Delega a transformação para `buildAppSettings_()` em `inventory-logic.js`.
 *
 * Mantém cache em memória por 60 segundos para evitar leituras repetidas.
 *
 * @param {{ _forceRefresh?: boolean }} [params={}] - Opções
 * @param {boolean} [params._forceRefresh=false] - Se `true`, ignora o cache e relê a planilha
 * @returns {Object} Configurações como `{ chave: valor }`
 *
 * @example
 * getAppSettings()
 * // → { inventory_open: true, ... }
 *
 * getAppSettings({ _forceRefresh: true })
 * // → { inventory_open: true, ... }  (ignora cache, relê a planilha)
 */
function getAppSettings(params) {
    // authenticateRequest_();
    const forceRefresh = params && params._forceRefresh;
    const now = Date.now();
    if (!forceRefresh && _appSettingsCache && (now - _appSettingsCacheTime) < APPSETTINGS_CACHE_TTL) {
        return _appSettingsCache;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('app_config');

    if (!sheet) {
        Logger.log("Aba 'app_config' não encontrada.");
        return {};
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 1) return {};

    const data = sheet.getRange(2, 1, lastRow, 2).getValues();

    // Delega para inventory-logic.js
    const settings = buildAppSettings_(data);
    settings.email = Session.getActiveUser().getEmail() || '';
    Logger.log(settings);

    _appSettingsCache = settings;
    _appSettingsCacheTime = now;
    return settings;
}

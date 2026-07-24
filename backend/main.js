/**
 * main.js — THIN ADAPTER Google Apps Script
 * ==========================================
 *
 * Camada fina de I/O: SpreadsheetApp, LockService, Session, Utilities, Logger.
 * TODA a lógica de transformação está em inventory-logic.js (este diretório).
 *
 * ## Modo de uso no GAS
 *
 * Este projeto é implantado como **biblioteca GAS** vinculada a uma planilha.
 * As funções abaixo são os entry points chamados pelo frontend via
 * `google.script.run`. NÃO são chamadas internamente entre si — o frontend
 * chama cada uma diretamente.
 *
 * ## API Surface (funções expostas ao frontend)
 *
 * | Função                  | Modo    | Descrição                              |
 * |-------------------------|---------|----------------------------------------|
 * | `getInventoryData()`    | GET     | Lista de locais + inventário agrupado  |
 * | `getInventorySummary()` | GET     | Resumo de leituras por localidade      |
 * | `getNotFoundItens()`    | GET     | Itens não encontrados num local        |
 * | `getAppSettings()`      | GET     | Configurações chave-valor              |
 * | `saveCodeBatch(items)`  | POST    | Salva/atualiza lote de leituras        |
 * | `saveMessage(payload)`  | POST    | Salva observação (com dedup)           |
 *
 * ## Como o deploy funciona
 *
 * `npm run deploy` → deploy.js:
 *   1. Vite build → dist/index.html (single file)
 *   2. Copia backend/*.js, *.gs, appsscript.json → dist/
 *   3. Remove "export " de inventory-logic.js (GAS não suporta ES modules)
 *   4. clasp push → GAS project
 *   5. (opcional) clasp update-deployment → publicação
 *
 * No ambiente GAS, inventory-logic.gs e main.gs compartilham escopo global.
 * As funções exportadas em inventory-logic.js viram funções globais após o
 * deploy (porque o "export" é removido).
 *
 * @module main
 * @author Tiago Possato
 */

// ============================================================
// getInventoryData — Aba "inventario"
// ============================================================

function getInventoryData(add_spec) {
  if (add_spec === undefined) { add_spec = true; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetInventario = ss.getSheetByName('inventario');

  if (!sheetInventario) {
    throw new Error("getInventoryData: Aba 'inventario' não encontrada.");
  }

  const lastRowInv = sheetInventario.getLastRow();
  if (lastRowInv < 2) {
    return { locations: [], inventory: [] };
  }

  const numCols = add_spec ? 9 : 3;
  const invData = sheetInventario.getRange(2, 4, lastRowInv - 1, numCols).getValues();

  // Delega para inventory-logic.js
  return buildInventoryData(invData, add_spec);
}

// ============================================================
// getInventorySummary — Abas "leituras" + "localidades"
// ============================================================

/**
 * @typedef {Object} LocationSummary
 * @property {string} name
 * @property {number} totalAssets
 * @property {number} assetsFindedCount
 * @property {number} missingAssets
 */

/**
 * @typedef {Object} AssetMapping
 * @property {string} location
 * @property {number[]} assets
 */

/**
 * @typedef {Object} InventoryDataResponse
 * @property {LocationSummary[]} locations
 * @property {AssetMapping[]} assetsFinded
 */

function getInventorySummary(targetLocation) {
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
  return buildInventorySummary(leiturasData, localidadesData, targetLocation);
}

// ============================================================
// getUserName
// ============================================================

function getUserName() {
  const userEmail = Session.getActiveUser().getEmail();
  return userEmail ? userEmail.split('@')[0] : 'anonimo';
}

// ============================================================
// saveCodeBatch — Aba "leituras" (escrita com Lock + cache UID)
// ============================================================

// Cache do índice UID→linha (evita ler planilha inteira a cada chamada)
let _uidIndexCache = null;
let _uidIndexLastRow = 0;

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

// Valida que o UID na linha cacheada ainda é o esperado (1 leitura de 1 célula)
function validateUidAtRow(sheet, uid, row) {
  const actualUid = sheet.getRange(row, 1).getValue();
  return actualUid === uid;
}

function saveCodeBatch(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
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
    const user = getUserName();

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

function saveMessage(payload) {
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
    const aferidor = getUserName();

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

function getNotFoundItens(targetLocation) {
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
  return filterNotFoundItems(data, targetLocation);
}

// ============================================================
// getAppSettings — Aba "app_config" (com cache de 60s)
// ============================================================

let _appSettingsCache = null;
let _appSettingsCacheTime = 0;
const APPSETTINGS_CACHE_TTL = 60 * 1000; // 1 minuto

function getAppSettings(params) {
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
  const settings = buildAppSettings(data);
  Logger.log(settings);

  _appSettingsCache = settings;
  _appSettingsCacheTime = now;
  return settings;
}

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

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetInventario = ss.getSheetByName('inventario');

  if (!sheetInventario) {
    throw new Error("getInventoryData: Aba 'inventario' não encontrada.");
  }

  var lastRowInv = sheetInventario.getLastRow();
  if (lastRowInv < 2) {
    return { locations: [], inventory: [] };
  }

  var numCols = add_spec ? 9 : 3;
  var invData = sheetInventario.getRange(2, 4, lastRowInv - 1, numCols).getValues();

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

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Aba "leituras" ---
  var sheetDados = ss.getSheetByName("leituras");
  if (!sheetDados) {
    throw new Error("getInventorySummary: Aba 'leituras' não encontrada.");
  }

  var leiturasData = [];
  var sheetDadosLastRow = sheetDados.getLastRow();
  if (sheetDadosLastRow >= 2) {
    leiturasData = sheetDados.getRange(2, 2, sheetDadosLastRow - 1, 3).getValues();
  }

  // --- Aba "localidades" ---
  var sheetLoc = ss.getSheetByName("localidades");
  if (!sheetLoc) {
    throw new Error("getInventorySummary: Aba 'localidades' não encontrada.");
  }

  var localidadesData = [];
  var sheetLocLastRow = sheetLoc.getLastRow();
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
  var userEmail = Session.getActiveUser().getEmail();
  return userEmail ? userEmail.split('@')[0] : 'anonimo';
}

// ============================================================
// saveCodeBatch — Aba "leituras" (escrita com Lock)
// ============================================================

function saveCodeBatch(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('Servidor ocupado. Tente novamente.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("leituras");
    if (!sheet) {
      throw new Error('Aba "leituras" não encontrada.');
    }

    var HEADER_ROWS = 1;

    var now = new Date();
    var formattedDate = Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm:ss'
    );
    var user = getUserName();

    var lastRow = sheet.getLastRow();
    var uidToRow = Object.create(null);

    if (lastRow > HEADER_ROWS) {
      var values = sheet
        .getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, LAST_COL_LEITURAS)
        .getValues();

      values.forEach(function (row, index) {
        var uid = row[0];
        if (uid && !uidToRow[uid]) {
          uidToRow[uid] = HEADER_ROWS + 1 + index;
        }
      });
    }

    var rowsToUpdate = [];
    var rowsToAppend = [];
    var persistedUids = [];

    items.forEach(function (item) {
      if (!item || !item.uid) return;

      var rowData = [
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

      var existingRow = uidToRow[item.uid];

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
      var appendStartRow = sheet.getLastRow() + 1;
      sheet
        .getRange(appendStartRow, 1, rowsToAppend.length, LAST_COL_LEITURAS)
        .setValues(rowsToAppend);
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
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('Servidor ocupado. Tente novamente.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("observacoes");

    if (!sheet) {
      throw new Error("saveMessage: Aba 'observacoes' não encontrada.");
    }

    var uuid = payload.uid;

    // Verificação de duplicidade
    var lastRow = sheet.getLastRow();
    if (lastRow > 0) {
      var uidsExistentes = sheet.getRange(1, 1, lastRow, 1).getValues().flat();
      if (uidsExistentes.includes(uuid)) {
        return uuid;
      }
    }

    var now = new Date();
    var formattedDate = Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm:ss'
    );
    var aferidor = getUserName();

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

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('nao_encontrados_geral');

  if (!sheet) {
    throw new Error("getNotFoundItens: aba nao_encontrados_geral não encontrada");
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];

  var data = sheet.getRange(3, 1, lastRow - 2, 3).getValues();

  // Delega para inventory-logic.js
  return filterNotFoundItems(data, targetLocation);
}

// ============================================================
// getAppSettings — Aba "app_config"
// ============================================================

function getAppSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('app_config');

  if (!sheet) {
    Logger.log("Aba 'app_config' não encontrada.");
    return {};
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return {};

  var data = sheet.getRange(2, 1, lastRow, 2).getValues();

  // Delega para inventory-logic.js
  var settings = buildAppSettings(data);
  Logger.log(settings);
  return settings;
}

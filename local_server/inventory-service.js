/**
 * InventoryService — Adaptador de I/O para o ambiente Node.js
 *
 * Camada fina de acesso à Google Sheets API que simula o ambiente GAS.
 * Toda a lógica de transformação de dados é delegada ao módulo canônico
 * shared/inventory-logic.js.
 *
 * Equivale ao que backend/main.js faz no ambiente GAS real.
 *
 * @module inventory-service
 */

import {
  LAST_COL_LEITURAS,
  buildInventoryData,
  buildInventorySummary,
  filterNotFoundItems,
  buildAppSettings
} from '../backend/inventory-logic.js';

// ============================================================
// InventoryService
// ============================================================
export class InventoryService {
  constructor(sheetsService) {
    this.sheetsService = sheetsService;
    this._lockQueue = Promise.resolve(); // Fila de locks (mutex assíncrono)
  }

  // ==========================================================
  // Simulação do ambiente GAS (I/O puro, sem lógica de negócio)
  // ==========================================================

  /** Simula SpreadsheetApp.getActiveSpreadsheet() */
  async getActiveSpreadsheet() {
    const self = this;
    return {
      getSheetByName: async function (name) {
        const exists = await self.sheetsService.sheetExists(name);
        return exists ? {
          getName: function () { return name; },
          getLastRow: async function () {
            const data = await self.sheetsService.getRangeData(name + '!A:Z');
            return data.length > 0 ? data.length : 0;
          },
          getRange: async function (row, column, numRows, numColumns) {
            const range = name + '!' + self.getColumnLetter(column) + row + ':' +
              self.getColumnLetter(column + numColumns - 1) + (row + numRows - 1);
            const data = await self.sheetsService.getRangeData(range);
            return { getValues: function () { return data; } };
          },
          appendRow: async function (rowData) {
            await self.sheetsService.appendRangeData(name + '!A:Z', [rowData]);
          }
        } : null;
      }
    };
  }

  /** Simula Session.getActiveUser() */
  getActiveUser() {
    return {
      getEmail: function () { return 'teste.local@dominio.com'; }
    };
  }

  /** Simula Utilities.formatDate() */
  formatDate(date, timezone, format) {
    if (format === 'dd/MM/yyyy HH:mm:ss') {
      return date.toLocaleString('pt-BR');
    }
    return date.toISOString();
  }

  /** Simula LockService com mutex assíncrono real */
  getLockService() {
    const self = this;
    return {
      getScriptLock: function () {
        let release;
        const prev = self._lockQueue;
        self._lockQueue = new Promise(function (resolve) { release = resolve; });
        return {
          waitLock: async function (timeout) {
            const timeoutPromise = new Promise(function (_, reject) {
              setTimeout(function () { reject(new Error('Lock timeout')); }, timeout);
            });
            await Promise.race([prev, timeoutPromise]);
          },
          releaseLock: function () {
            if (release) { release(); release = null; }
          }
        };
      }
    };
  }

  /** Helper: número de coluna → letra (A, B, ..., Z, AA, AB, ...) */
  getColumnLetter(column) {
    let letter = '';
    while (column > 0) {
      column--;
      letter = String.fromCharCode(65 + (column % 26)) + letter;
      column = Math.floor(column / 26);
    }
    return letter;
  }

  async getUserName() {
    const userEmail = this.getActiveUser().getEmail();
    return userEmail ? userEmail.split('@')[0] : 'anonimo';
  }

  // ==========================================================
  // Métodos públicos — thin adapters (I/O → shared logic)
  // ==========================================================

  /**
   * Obtém dados consolidados do inventário.
   * I/O: lê Sheet → delega transformação para shared/inventory-logic.js
   */
  async getInventoryData(addSpec) {
    if (addSpec === undefined) { addSpec = true; }

    const ss = await this.getActiveSpreadsheet();
    const sheetInventario = await ss.getSheetByName('inventario');

    if (!sheetInventario) {
      throw new Error("getInventoryData: Aba 'inventario' não encontrada.");
    }

    const lastRowInv = await sheetInventario.getLastRow();
    if (lastRowInv < 2) {
      return { locations: [], inventory: [] };
    }

    const numCols = addSpec ? 9 : 3;
    const invData = await (await sheetInventario.getRange(2, 4, lastRowInv - 1, numCols)).getValues();

    // Delega toda a lógica de parsing para o módulo canônico
    return buildInventoryData(invData, addSpec);
  }

  /**
   * Resumo do inventário por localidade.
   * I/O: lê leituras + localidades → delega transformação para shared/inventory-logic.js
   */
  async getInventorySummary(targetLocation) {
    if (targetLocation === undefined) { targetLocation = null; }

    const ss = await this.getActiveSpreadsheet();

    // --- Aba "leituras" ---
    const sheetDados = await ss.getSheetByName("leituras");
    if (!sheetDados) throw new Error("getInventorySummary: Aba 'leituras' não encontrada.");

    const lastRowDados = await sheetDados.getLastRow();
    let leiturasData = [];

    if (lastRowDados >= 2) {
      const rangeLeituras = await sheetDados.getRange(2, 2, lastRowDados - 1, 3);
      leiturasData = await rangeLeituras.getValues();
    }

    // --- Aba "localidades" ---
    const sheetLoc = await ss.getSheetByName("localidades");
    if (!sheetLoc) throw new Error("getInventorySummary: Aba 'localidades' não encontrada.");

    const lastRowLoc = await sheetLoc.getLastRow();
    let localidadesData = [];

    if (lastRowLoc >= 2) {
      localidadesData = await this.sheetsService.getRangeData('localidades!A2:D' + lastRowLoc);
    }

    // Delega toda a lógica de sumarização para o módulo canônico
    return buildInventorySummary(leiturasData, localidadesData, targetLocation);
  }

  /**
   * Itens não encontrados filtrados por localidade.
   */
  async getNotFoundItens(targetLocation) {
    if (!targetLocation) {
      throw new Error("getNotFoundItens: targetLocation não fornecido.");
    }

    const ss = await this.getActiveSpreadsheet();
    const sheet = await ss.getSheetByName('nao_encontrados_geral');

    if (!sheet) {
      throw new Error("getNotFoundItens: aba nao_encontrados_geral não encontrada");
    }

    const lastRow = await sheet.getLastRow();
    if (lastRow < 3) return [];

    const data = await (await sheet.getRange(3, 1, lastRow - 2, 3)).getValues();

    // Delega para módulo canônico
    return filterNotFoundItems(data, targetLocation);
  }

  /**
   * Configurações do aplicativo (chave-valor).
   */
  async getAppSettings() {
    const ss = await this.getActiveSpreadsheet();
    const sheet = await ss.getSheetByName('app_config');

    if (!sheet) {
      console.warn("Aba 'app_config' não encontrada.");
      return {};
    }

    const lastRow = await sheet.getLastRow();
    if (lastRow < 1) return {};

    const data = await (await sheet.getRange(2, 1, lastRow, 2)).getValues();

    // Delega para módulo canônico
    return buildAppSettings(data);
  }

  // ==========================================================
  // Métodos de escrita (I/O + lock — específicos do servidor)
  // ==========================================================

  /**
   * Salva ou atualiza um lote de itens na aba "leituras".
   */
  async saveCodeBatch(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const lock = this.getLockService().getScriptLock();
    try {
      await lock.waitLock(30000);
    } catch (_ignored) {
      throw new Error('Servidor ocupado. Tente novamente.');
    }

    try {
      const ss = await this.getActiveSpreadsheet();
      const sheet = await ss.getSheetByName("leituras");
      if (!sheet) {
        throw new Error('Aba "leituras" não encontrada.');
      }

      const HEADER_ROWS = 1;
      const now = new Date();
      const formattedDate = this.formatDate(now, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
      const user = await this.getUserName();

      const lastRow = await sheet.getLastRow();
      const uidToRow = Object.create(null);

      // Buscar UIDs existentes apenas se houver dados
      if (lastRow > HEADER_ROWS) {
        try {
          const values = await (await sheet.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, LAST_COL_LEITURAS)).getValues();
          values.forEach(function (row, index) {
            const uid = row[0];
            if (uid && !uidToRow[uid]) {
              uidToRow[uid] = HEADER_ROWS + 1 + index;
            }
          });
        } catch (error) {
          console.warn('Erro ao buscar UIDs existentes:', error);
        }
      }

      const rowsToUpdate = [];
      const rowsToAppend = [];
      const persistedUids = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || !item.uid) continue;

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

        const existingRow = uidToRow[item.uid];
        if (existingRow) {
          rowsToUpdate.push({ row: existingRow, data: rowData });
        } else {
          rowsToAppend.push(rowData);
        }
        persistedUids.push(item.uid);
      }

      console.log('📦 Processando batch:', {
        updates: rowsToUpdate.length,
        appends: rowsToAppend.length,
        total: persistedUids.length
      });

      if (rowsToUpdate.length > 0) {
        await this.processUpdates(sheet, rowsToUpdate, LAST_COL_LEITURAS);
      }
      if (rowsToAppend.length > 0) {
        await this.processAppends(sheet, rowsToAppend, LAST_COL_LEITURAS);
      }

      console.log('✅ Batch processado com sucesso:', persistedUids);
      return persistedUids;

    } catch (err) {
      console.error('❌ Erro em saveCodeBatch:', err);
      throw new Error('Falha ao salvar lote: ' + err.message);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Salva uma mensagem na aba "observacoes".
   */
  async saveMessage(payload) {
    const lock = this.getLockService().getScriptLock();
    try {
      await lock.waitLock(30000);
    } catch (_ignored) {
      throw new Error('Servidor ocupado. Tente novamente.');
    }

    try {
      const ss = await this.getActiveSpreadsheet();
      const sheet = await ss.getSheetByName("observacoes");

      if (!sheet) {
        throw new Error("saveMessage: Aba 'observacoes' não encontrada.");
      }

      const uuid = payload.uid;

      // Verificação de duplicidade
      const lastRow = await sheet.getLastRow();
      if (lastRow > 0) {
        const range = await sheet.getRange(1, 1, lastRow, 1);
        const uidsExistentes = range.getValues().flat();
        if (uidsExistentes.includes(uuid)) {
          return uuid;
        }
      }

      const now = new Date();
      const formattedDate = this.formatDate(now, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
      const aferidor = await this.getUserName();

      await sheet.appendRow([
        uuid,
        formattedDate,
        payload.location,
        aferidor,
        payload.message
      ]);

      return uuid;

    } catch (error) {
      console.error("Erro ao salvar mensagem:", error);
      throw new Error("Falha ao salvar observação: " + error.message);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Atualiza linhas existentes em lote.
   */
  async processUpdates(sheet, rowsToUpdate, lastCol) {
    try {
      console.log('🔄 Processando ' + rowsToUpdate.length + ' atualizações...');
      rowsToUpdate.sort(function (a, b) { return a.row - b.row; });

      const batchSize = 10;
      for (let i = 0; i < rowsToUpdate.length; i += batchSize) {
        const batch = rowsToUpdate.slice(i, i + batchSize);
        const updateRequests = batch.map(function (update) {
          return {
            range: 'leituras!A' + update.row + ':' + this.getColumnLetter(lastCol) + update.row,
            values: [update.data]
          };
        }, this);

        console.log('📝 Atualizando linhas: ' + batch.map(function (u) { return u.row; }).join(', '));

        const result = await this.sheetsService.updateMultipleRanges(updateRequests);
        if (!result) {
          throw new Error('Falha ao atualizar dados na planilha');
        }
      }
      console.log('✅ Atualizações concluídas');
    } catch (error) {
      console.error('❌ Erro ao processar updates:', error);
      throw error;
    }
  }

  /**
   * Adiciona novas linhas em lote.
   */
  async processAppends(sheet, rowsToAppend, lastCol) {
    try {
      console.log('📥 Processando ' + rowsToAppend.length + ' adições...');

      const batchSize = 50;
      const colLetter = this.getColumnLetter(lastCol);
      for (let i = 0; i < rowsToAppend.length; i += batchSize) {
        const batch = rowsToAppend.slice(i, i + batchSize);
        console.log('➕ Adicionando ' + batch.length + ' linhas...');

        const result = await this.sheetsService.appendRangeData('leituras!A:' + colLetter, batch);
        if (!result) {
          throw new Error('Falha ao adicionar dados na planilha');
        }
      }
      console.log('✅ Adições concluídas');
    } catch (error) {
      console.error('❌ Erro ao processar appends:', error);
      throw error;
    }
  }
}

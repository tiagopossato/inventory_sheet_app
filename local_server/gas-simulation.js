//import { GoogleSheetsService } from './google-sheets-service.js';

// Simulação do ambiente GAS
export class GASSimulation {
  constructor(sheetsService) {
    this.sheetsService = sheetsService;
    this.mockData = new Map(); // Para simular dados quando necessário
  }

  // Simula SpreadsheetApp.getActiveSpreadsheet()
  async getActiveSpreadsheet() {
    return {
      getSheetByName: async (name) => {
        const exists = await this.sheetsService.sheetExists(name);
        return exists ? {
          getName: () => name,
          getLastRow: async () => {
            const data = await this.sheetsService.getRangeData(`${name}!A:Z`);
            return data.length > 0 ? data.length : 0;
          },
          getRange: async (row, column, numRows, numColumns) => {
            const range = `${name}!${this.getColumnLetter(column)}${row}:${this.getColumnLetter(column + numColumns - 1)}${row + numRows - 1}`;
            const data = await this.sheetsService.getRangeData(range);
            return {
              getValues: () => data
            };
          },
          appendRow: async (rowData) => {
            const range = `${name}!A:Z`;
            await this.sheetsService.appendRangeData(range, [rowData]);
          }
        } : null;
      }
    };
  }

  // Simula Session.getActiveUser()
  getActiveUser() {
    return {
      getEmail: () => 'teste.local@dominio.com'
    };
  }

  // Simula Utilities.formatDate()
  formatDate(date, timezone, format) {
    // Implementação básica - pode ser expandida conforme necessidade
    if (format === 'dd/MM/yyyy HH:mm:ss') {
      return date.toLocaleString('pt-BR');
    }
    return date.toISOString();
  }

  // Simula LockService
  getLockService() {
    return {
      getScriptLock: () => ({
        waitLock: (timeout) => true,
        releaseLock: () => { }
      })
    };
  }

  // Simula Logger
  getLogger() {
    return {
      log: (message) => console.log('GAS Logger:', message)
    };
  }

  // Helper para converter número de coluna em letra
  getColumnLetter(column) {
    let letter = '';
    while (column > 0) {
      column--;
      letter = String.fromCharCode(65 + (column % 26)) + letter;
      column = Math.floor(column / 26);
    }
    return letter;
  }

  // Implementação das funções específicas do seu projeto

  async getUserName() {
    const userEmail = this.getActiveUser().getEmail();
    return userEmail ? userEmail.split('@')[0] : 'anonimo';
  }

  async getInventoryData() {
    const ss = await this.getActiveSpreadsheet();
    const sheetInventario = await ss.getSheetByName('inventario');

    if (!sheetInventario) {
      throw new Error("getInventoryData: Aba 'inventario' não encontrada.");
    }

    const lastRowInv = await sheetInventario.getLastRow();

    if (lastRowInv < 2) {
      return { locations: [], inventory: [] };
    }

    const invData = await (await sheetInventario.getRange(2, 4, lastRowInv - 1, 3)).getValues();
    const inventoryMap = new Map();

    for (let i = 0; i < invData.length; i++) {
      const row = invData[i];
      const local = String(row[0]).trim();

      if (!local) continue;

      const asset = parseInt(row[2], 10);
      if (isNaN(asset)) continue;

      if (!inventoryMap.has(local)) {
        inventoryMap.set(local, []);
      }
      inventoryMap.get(local).push(asset);
    }

    const locationsOutput = [];
    const inventoryOutput = [];

    for (const [key, assetsList] of inventoryMap) {
      inventoryOutput.push({
        location: key,
        assets: assetsList
      });

      locationsOutput.push({
        name: key,
        assetsCount: assetsList.length
      });
    }

    locationsOutput.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    inventoryOutput.sort((a, b) => a.location.localeCompare(b.location, 'pt-BR'));

    return {
      locations: locationsOutput,
      inventory: inventoryOutput
    };
  }

  async getInventorySummary(targetLocation = null) {
    const ss = await this.getActiveSpreadsheet();
    const groups = {};

    const sheetDados = await ss.getSheetByName("leituras");
    if (!sheetDados) {
      throw new Error("getInventorySummary: Aba 'leituras' não encontrada.");
    }

    if (await sheetDados.getLastRow() >= 2) {
      const data = await (await sheetDados.getRange(2, 2, await sheetDados.getLastRow() - 1, 3)).getValues();

      for (let i = 0; i < data.length; i++) {
        const code = parseInt(data[i][1], 10);
        if (isNaN(code)) continue;

        const location = String(data[i][2]).trim();
        if (!location) continue;

        groups[location] = groups[location] || [];
        groups[location].push(code);
      }
    }

    const sheetLoc = await ss.getSheetByName("localidades");
    if (!sheetLoc) {
      throw new Error("getInventorySummary: Aba 'localidades' não encontrada.");
    }

    let locations = [];

    if (await sheetLoc.getLastRow() >= 2) {
      const locData = await this.sheetsService.getRangeData('localidades!A2:D' + (await sheetLoc.getLastRow()));
      const target = targetLocation ? String(targetLocation).trim() : null;

      locations = locData
        .filter(row => row[0] && (!target || String(row[0]).trim() === target))
        .map(row => ({
          name: String(row[0]).trim(),
          totalAssets: Number(row[1]) || 0,
          assetsFindedCount: Number(row[2]) || 0,
          missingAssets: Number(row[3]) || 0
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    }

    const assetsFinded = Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(loc => ({ location: loc, assets: groups[loc] }));

    return { locations, assetsFinded };
  }

  async saveCodeBatch(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const lock = this.getLockService().getScriptLock();
    try {
      lock.waitLock(30000);
    } catch (e) {
      throw new Error('Servidor ocupado. Tente novamente.');
    }

    try {
      const ss = await this.getActiveSpreadsheet();
      const sheet = await ss.getSheetByName("leituras");
      if (!sheet) {
        throw new Error('Aba "leituras" não encontrada.');
      }

      const LAST_COL = 8;
      const HEADER_ROWS = 1;

      const now = new Date();
      const formattedDate = this.formatDate(
        now,
        'America/Sao_Paulo',
        'dd/MM/yyyy HH:mm:ss'
      );
      const user = await this.getUserName();

      const lastRow = await sheet.getLastRow();
      const uidToRow = Object.create(null);

      // Buscar UIDs existentes apenas se houver dados
      if (lastRow > HEADER_ROWS) {
        try {
          const values = await (await sheet.getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, LAST_COL)).getValues();

          values.forEach((row, index) => {
            const uid = row[0];
            if (uid && !uidToRow[uid]) {
              uidToRow[uid] = HEADER_ROWS + 1 + index;
            }
          });
        } catch (error) {
          console.warn('Erro ao buscar UIDs existentes:', error);
          // Continua com uidToRow vazio (tratará tudo como append)
        }
      }

      const rowsToUpdate = [];
      const rowsToAppend = [];
      const persistedUids = [];

      // Separar updates de appends
      for (const item of items) {
        if (!item || !item.uid) continue;

        const rowData = [
          String(item.uid),
          formattedDate,
          Number(item.code ?? ''),
          String(item.location ?? ''),
          user,
          Number(item.state ?? ''),
          Number(item.ipvu ?? ''),
          String(item.obs ?? '')
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

      // PROCESSAR UPDATES
      if (rowsToUpdate.length > 0) {
        await this.processUpdates(sheet, rowsToUpdate, LAST_COL);
      }

      // PROCESSAR APPENDS
      if (rowsToAppend.length > 0) {
        await this.processAppends(sheet, rowsToAppend, LAST_COL);
      }

      console.log('✅ Batch processado com sucesso:', persistedUids);
      return persistedUids;

    } catch (err) {
      console.error('❌ Erro em saveCodeBatch:', err);
      throw new Error(`Falha ao salvar lote: ${err.message}`);
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Processa as linhas que precisam ser atualizadas
   */
  async processUpdates(sheet, rowsToUpdate, lastCol) {
    try {
      console.log(`🔄 Processando ${rowsToUpdate.length} atualizações...`);

      // Ordenar por linha para otimizar as escritas
      rowsToUpdate.sort((a, b) => a.row - b.row);

      const batchSize = 10; // Processar em lotes para evitar timeout
      for (let i = 0; i < rowsToUpdate.length; i += batchSize) {
        const batch = rowsToUpdate.slice(i, i + batchSize);

        const updateRequests = batch.map(update => ({
          range: `leituras!A${update.row}:${this.getColumnLetter(lastCol)}${update.row}`,
          values: [update.data]
        }));

        console.log(`📝 Atualizando linhas: ${batch.map(u => u.row).join(', ')}`);

        // Atualizar usando Google Sheets API
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
   * Processa as linhas que precisam ser adicionadas
   */
  async processAppends(sheet, rowsToAppend, lastCol) {
    try {
      console.log(`📥 Processando ${rowsToAppend.length} adições...`);

      const batchSize = 50; // Limite seguro para append
      for (let i = 0; i < rowsToAppend.length; i += batchSize) {
        const batch = rowsToAppend.slice(i, i + batchSize);

        console.log(`➕ Adicionando ${batch.length} linhas...`);

        // Adicionar usando Google Sheets API
        const result = await this.sheetsService.appendRangeData(
          `leituras!A:H`,
          batch
        );

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

  /**
   * Converte número de coluna em letra (A, B, C, ... Z, AA, AB, etc)
   */
  getColumnLetter(column) {
    let letter = '';
    while (column > 0) {
      const remainder = (column - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      column = Math.floor((column - 1) / 26);
    }
    return letter;
  }


  async saveMessage(payload) {
    const lock = this.getLockService().getScriptLock();
    try {
      lock.waitLock(30000);
    } catch (e) {
      throw new Error('Servidor ocupado. Tente novamente.');
    }

    try {
      const ss = await this.getActiveSpreadsheet();
      const sheet = await ss.getSheetByName("observacoes");

      if (!sheet) {
        throw new Error("saveMessage: Aba 'observacoes' não encontrada.");
      }

      const now = new Date();
      const formattedDate = this.formatDate(
        now,
        'America/Sao_Paulo',
        'dd/MM/yyyy HH:mm:ss'
      );
      const aferidor = await this.getUserName();

      const uuid = payload.uid;
      const localidade = payload.location;
      const mensagem = payload.message;

      await sheet.appendRow([
        uuid,
        formattedDate,
        localidade,
        aferidor,
        mensagem
      ]);

      return uuid;

    } catch (error) {
      console.error("Erro ao salvar mensagem:", error);
      throw new Error("Falha ao salvar observação: " + error.message);
    } finally {
      lock.releaseLock();
    }
  }

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
    const target = String(targetLocation).trim();
    const result = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (String(row[0]).trim() === target) {
        result.push([row[1], row[2]]);
      }
    }

    return result;
  }

  async getAppSettings() {
    const ss = await this.getActiveSpreadsheet();
    const sheet = await ss.getSheetByName('app_config');

    const settings = {};

    if (!sheet) {
      console.warn("Aba 'app_config' não encontrada.");
      return settings;
    }

    const lastRow = await sheet.getLastRow();
    if (lastRow < 1) return settings;

    const data = await (await sheet.getRange(2, 1, lastRow, 2)).getValues();

    for (let i = 0; i < data.length; i++) {
      const key = String(data[i][0]).trim();
      const value = data[i][1].toUpperCase();

      if (key) {
        if (value instanceof Date) {
          settings[key] = value.toISOString().split('T')[0];
        } else if (value === 'TRUE' || value === true) {
          settings[key] = true;
        } else if (value === 'FALSE' || value === false) {
          settings[key] = false;
        } else {
          settings[key] = value;
        }
      }
    }

    //this.getLogger().log(settings);
    return settings;
  }
}

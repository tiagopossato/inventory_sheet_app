/**
 * Obtém um objeto consolidado contendo a lista oficial de localidades (com metadados) e o inventário atual agrupado por local.
 * @return {Object} Dados formatados com locations e inventory
 * @property {Array<{name: string, assetsCount: number}>} locations - Lista de localidades com contagem de bens
 * @property {Array<{location: string, assets: number[]}>} inventory - Inventário agrupado por localidade
 */
function getInventoryData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetInventario = ss.getSheetByName('inventario');

  // Early return com array vazio se a aba não existir
  if (!sheetInventario) {
    throw new Error("getInventoryData: Aba 'inventario' não encontrada.");
  }

  const lastRowInv = sheetInventario.getLastRow();

  // Early return se não houver dados além do cabeçalho
  if (lastRowInv < 2) {
    return { locations: [], inventory: [] };
  }

  /** ===============================
   * 1. LEITURA E PROCESSAMENTO OTIMIZADO
   * =============================== */

  // Ler as colunas necessárias: D (local) e F (tombamento)
  const invData = sheetInventario.getRange(2, 4, lastRowInv - 1, 3).getValues();
  const inventoryMap = new Map(); // Usar Map para melhor performance

  // Processamento otimizado com for loop
  for (let i = 0; i < invData.length; i++) {
    const row = invData[i];
    const local = String(row[0]).trim();

    // Validação rápida: pular linhas sem local
    if (!local) continue;

    const asset = parseInt(row[2], 10);

    // Validação numérica mais eficiente
    if (isNaN(asset)) continue;

    // Usar Map para agrupamento (mais eficiente que Object)
    if (!inventoryMap.has(local)) {
      inventoryMap.set(local, []);
    }
    inventoryMap.get(local).push(asset);
  }

  /** ===============================
   * 2. ESTRUTURAÇÃO DE SAÍDA OTIMIZADA
   * =============================== */

  // Converter Map para arrays de saída em uma única operação
  const locationsOutput = [];
  const inventoryOutput = [];

  // Single-pass conversion: processar o Map apenas uma vez
  for (const [key, assetsList] of inventoryMap) {
    // Ambas as saídas usam os mesmos dados
    inventoryOutput.push({
      location: key,
      assets: assetsList
    });

    locationsOutput.push({
      name: key,
      assetsCount: assetsList.length
    });
  }

  /** ===============================
   * 3. ORDENAÇÃO FINAL
   * =============================== */

  // Ordenar apenas uma vez, por referência
  locationsOutput.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  // Manter inventoryOutput na mesma ordem para consistência
  inventoryOutput.sort((a, b) => a.location.localeCompare(b.location, 'pt-BR'));

  return {
    locations: locationsOutput,
    inventory: inventoryOutput
  };
}

/**
 * @typedef {Object} LocationSummary
 * @property {string} name - Nome da localidade
 * @property {number} totalAssets - Quantidade total de bens
 * @property {number} assetsFindedCount - Bens encontrados no local
 * @property {number} missingAssets - Bens faltantes
 */

/**
 * @typedef {Object} AssetMapping
 * @property {string} location - O nome da localidade correspondente
 * @property {number[]} assets - Array contendo os números de tombamento
 */

/**
 * @typedef {Object} InventoryDataResponse
 * @property {LocationSummary[]} locations - Lista resumida para preenchimento de seletores de UI
 * @property {AssetMapping[]} assetsFinded - Mapeamento detalhado de bens agrupados por local
 */

/**
 * Processa os dados da aba "leituras" para gerar um resumo do inventário agrupado por localidade
 * @param {string} [targetLocation] - A localidade que o usuário está inventariando (opcional)
 * @return {InventoryDataResponse} Objeto contendo o resumo das localidades e o mapa de bens
 */
function getInventorySummary(targetLocation = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const groups = {};

  /** ===============================
   * 1. PROCESSAMENTO DA ABA "leituras" (Otimizado)
   * =============================== */
  const sheetDados = ss.getSheetByName("leituras");

  // Early return com array vazio se a aba não existir
  if (!sheetDados) {
    throw new Error("getInventorySummary: Aba 'leituras' não encontrada.");
  }
  const sheetDadosLastRow = sheetDados.getLastRow();
  if (sheetDadosLastRow >= 2) {
    const data = sheetDados.getRange(2, 2, sheetDadosLastRow - 1, 3).getValues();

    // Loop otimizado
    for (let i = 0; i < data.length; i++) {
      const code = parseInt(data[i][1], 10);
      if (isNaN(code)) continue;

      const location = String(data[i][2]).trim();
      if (!location) continue;

      groups[location] = groups[location] || [];
      groups[location].push(code);
    }
  }

  /** ===============================
   * 2. PROCESSAMENTO DA ABA "localidades" (Otimizado)
   * =============================== */
  const sheetLoc = ss.getSheetByName("localidades");

  // Early return com array vazio se a aba não existir
  if (!sheetLoc) {
    throw new Error("getInventorySummary: Aba 'localidades' não encontrada.");
  }

  let locations = [];
  const sheetLocGetLastRow = sheetLoc.getLastRow();
  if (sheetLocGetLastRow >= 2) {
    const locData = sheetLoc.getRange('A2:D' + sheetLocGetLastRow).getValues();
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

  /** ===============================
   * 3. ESTRUTURAÇÃO FINAL (Otimizada)
   * =============================== */
  const assetsFinded = Object.keys(groups)
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    .map(loc => ({ location: loc, assets: groups[loc] }));

  return { locations, assetsFinded };
}

/**
 * Obtém o nome do usuário atual baseado no email
 * @return {string} Nome do usuário ou 'anonimo' se não identificado
 */
function getUserName() {
  const userEmail = Session.getActiveUser().getEmail();
  return userEmail ? userEmail.split('@')[0] : 'anonimo';
}

/**
 * Salva ou atualiza um lote de itens na planilha "leituras" de forma segura, idempotente e otimizada
 * @param {Array<Object>} items - Array de itens para salvar
 * @param {string} items[].uid - Identificador único do item
 * @param {string|number} items[].code - Código do item
 * @param {string} items[].location - Localidade do item
 * @param {number} items[].state - Estado do item
 * @param {number} items[].ipvu - Valor IPVU do item
 * @param {string} items[].obs - Observações sobre o item
 * @return {Array<string>} UIDs efetivamente persistidos
 */
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

    const LAST_COL = 8;
    const HEADER_ROWS = 1;

    const now = new Date();
    const formattedDate = Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm:ss'
    );
    const user = getUserName();

    /* ------------------------------------------------------------
     * 1. Leitura única da planilha (UID -> linha)
     * ------------------------------------------------------------ */
    const lastRow = sheet.getLastRow();
    const uidToRow = Object.create(null);

    if (lastRow > HEADER_ROWS) {
      const values = sheet
        .getRange(HEADER_ROWS + 1, 1, lastRow - HEADER_ROWS, LAST_COL)
        .getValues();

      values.forEach((row, index) => {
        const uid = row[0];
        if (uid && !uidToRow[uid]) {
          uidToRow[uid] = HEADER_ROWS + 1 + index;
        }
      });
    }

    /* ------------------------------------------------------------
     * 2. Separação entre updates e appends
     * ------------------------------------------------------------ */
    const rowsToUpdate = [];
    const rowsToAppend = [];
    const persistedUids = [];

    items.forEach(item => {
      if (!item || !item.uid) return;

      const rowData = [
        String(item.uid),
        formattedDate,
        String(item.code ?? ''), // preserva zeros/EAN
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
    });

    /* ------------------------------------------------------------
     * 3. Escrita segura
     * ------------------------------------------------------------ */

    // Updates
    rowsToUpdate
      .sort((a, b) => a.row - b.row)
      .forEach(update => {
        sheet
          .getRange(update.row, 1, 1, LAST_COL)
          .setValues([update.data]);
      });

    // Appends (recalcula lastRow para evitar race lógica)
    if (rowsToAppend.length > 0) {
      const appendStartRow = sheet.getLastRow() + 1;
      sheet
        .getRange(appendStartRow, 1, rowsToAppend.length, LAST_COL)
        .setValues(rowsToAppend);
    }

    return persistedUids;

  } catch (err) {
    Logger.log('Erro em saveCodeBatch:', err);
    throw new Error(`Falha ao salvar lote: ${err.message}`);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Salva uma mensagem na aba 'observacoes'
 * @param {Object} payload - Objeto contendo dados da mensagem
 * @param {string} payload.uid - Identificador único
 * @param {string} payload.location - Localidade
 * @param {string} payload.message - Mensagem a ser salva
 * @return {string} O UID da mensagem salva
 */
function saveMessage(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('Servidor ocupado. Tente novamente.');
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("observacoes");

    // Early return com array vazio se a aba não existir
    if (!sheet) {
      throw new Error("saveMessage: Aba 'observacoes' não encontrada.");
    }

    const now = new Date();
    const formattedDate = Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm:ss'
    );
    const aferidor = getUserName();


    // Preparação dos dados
    const uuid = payload.uid;
    const localidade = payload.location;
    const mensagem = payload.message;

    // Inserção na planilha (A:E)
    sheet.appendRow([
      uuid,           // Coluna A
      formattedDate,  // Coluna B
      localidade,     // Coluna C
      aferidor,       // Coluna D
      mensagem        // Coluna E
    ]);

    // Retorna o UID para o frontend confirmar o sucesso
    return uuid;

  } catch (error) {
    Logger.log("Erro ao salvar mensagem:", error);
    throw new Error("Falha ao salvar observação: " + error.message);
  } finally {
    lock.releaseLock();
  }
}


/**
 * Obtém itens não encontrados filtrados por localidade
 * @param {string} targetLocation Nome da localidade (Obrigatório)
 * @return {Array<Array<string>>} Lista de [Tombamento, Descrição]
 */
function getNotFoundItens(targetLocation) {
  // 1. Validação de Entrada (Parâmetro Obrigatório)
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

  // 2. Otimização de I/O: Leitura em lote
  // Inicia na linha 3, coluna 1, pega (lastRow - 2) linhas e 3 colunas (A, B, C)
  const data = sheet.getRange(3, 1, lastRow - 2, 3).getValues();

  // 3. Normalização fora do loop (Evita repetir trim() milhares de vezes)
  const target = String(targetLocation).trim();
  const result = [];

  // 4. Otimização de Processamento (Single Pass Loop)
  // Usar for tradicional é mais rápido que filter/map no Apps Script
  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Compara Localidade (Coluna A -> índice 0)
    if (String(row[0]).trim() === target) {
      // Adiciona direto [Tombamento, Descrição] (Colunas B e C -> índices 1 e 2)
      result.push([row[1], row[2]]);
    }
  }

  return result;
}

/**
 * Lê as configurações da aba 'app_config' e retorna um objeto chave-valor
 * @return {Object} Objeto contendo todas as configurações
 */
function getAppSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('app_config');

  // Objeto de retorno padrão caso a aba não exista
  const settings = {};

  if (!sheet) {
    Logger.log("Aba 'app_config' não encontrada.");
    return settings;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return settings;

  // Lê as colunas A e B (Chave e Valor)
  const data = sheet.getRange(2, 1, lastRow, 2).getValues();

  // Transforma o array bidimensional em um objeto { chave: valor }
  for (let i = 0; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const value = data[i][1];

    if (key) {
      // Type handling
      if (value instanceof Date) {
        settings[key] = value.toISOString().split('T')[0]; // Returns YYYY-MM-DD
      } else if (value === 'true' || value === true) {
        settings[key] = true;
      } else if (value === 'false' || value === false) {
        settings[key] = false;
      } else {
        settings[key] = value;
      }
    }
  }
  Logger.log(settings);
  return settings;
}
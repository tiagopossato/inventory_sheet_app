/**
 * inventory-logic.js — MÓDULO CANÔNICO DE LÓGICA DE NEGÓCIO
 * ============================================================
 *
 * Funções PURAS de transformação — sem I/O de planilha, sem dependências externas.
 * Este é o SINGLE SOURCE OF TRUTH para toda regra de negócio do inventário.
 *
 * ## Quem usa este módulo
 *
 *     ┌──────────────────────────────────────┐
 *     │     inventory-logic.js (aqui)        │
 *     │     Funções puras, zero I/O          │
 *     └──────┬───────────────┬───────────────┘
 *            │               │
 *     ┌──────▼──────┐ ┌──────▼──────────────┐
 *     │ Node.js     │ │ Google Apps Script  │
 *     │ import via  │ │ escopo global       │
 *     │ ES modules  │ │ (deploy.js remove   │
 *     │             │ │  "export" no dist/) │
 *     └──────┬──────┘ └──────┬──────────────┘
 *            │               │
 *     ┌──────▼──────┐ ┌──────▼──────────────┐
 *     │ inventory-  │ │ public.js/.gs         │
 *     │ service.js  │ │ Thin I/O adapter    │
 *     │ Thin I/O    │ │ SpreadsheetApp,     │
 *     │ adapter     │ │ LockService, etc.   │
 *     └─────────────┘ └─────────────────────┘
 *
 * ## Regra de ouro
 * >>> Alterou regra de negócio? Mexa SOMENTE neste arquivo. <<<
 * public.js e inventory-service.js são thin adapters — não contêm lógica.
 *
 * ## Mapeamento: função pura → equivalente GAS
 *
 * | inventory-logic.js            | public.js (GAS)            |
 * |-------------------------------|--------------------------|
 * | `buildInventoryData_()`        | `getInventoryData()`     |
 * | `buildInventorySummary_()`     | `getInventorySummary()`  |
 * | `groupLeiturasByLocation()`   | (interno)                |
 * | `buildLocationSummaries()`    | (interno)                |
 * | `buildAssetsFinded()`         | (interno)                |
 * | `filterNotFoundItems_()`       | `getNotFoundItens()`     |
 * | `buildAppSettings_()`          | `getAppSettings()`       |
 *
 * ## Layout das abas da planilha
 *
 * Aba "inventario" (colunas D-L a partir da linha 2):
 *   D=local  E=(não usado)  F=tombamento  ...  L=especificação
 *
 * Aba "leituras" (colunas A-I a partir da linha 2):
 *   A=UID  B=Data  C=Código  D=Local  E=Usuário  F=Estado  G=IPVU  H=Obs  I=Fonte
 *
 * Aba "app_config" (colunas A-B a partir da linha 2):
 *   A=Chave  B=Valor
 *
 * ## Padrão de implantação como biblioteca GAS
 *
 * O projeto é implantado no Google Apps Script de duas formas equivalentes:
 *
 *   1. **Script standalone**: os arquivos .gs ficam no projeto GAS vinculado
 *      à planilha. O frontend (index.html) é servido via doGet() e chama as
 *      funções via google.script.run.
 *
 *   2. **Biblioteca GAS**: o projeto pode ser publicado como biblioteca e
 *      importado por outras planilhas. As funções públicas (getInventoryData,
 *      saveCodeBatch, etc.) ficam disponíveis para o script host.
 *
 * Em AMBOS os modos, as funções aqui definidas (buildInventoryData_, etc.)
 * são funções auxiliares internas — NÃO são expostas diretamente ao frontend.
 * O frontend chama apenas as funções definidas em public.js.
 *
 * @module inventory-logic
 * @author Tiago Possato
 */

// ============================================================
// CONSTANTES DE COLUNAS
// ============================================================

/** Índices base 0 a partir da coluna D da aba "inventario" */
const COL_INV_LOCATION = 0; // Coluna D — Nome da localidade
const COL_INV_ASSET = 2; // Coluna F — Número de tombamento
const COL_INV_SPECNAME = 8; // Coluna L — Nome da especificação
const SPEC_NAME_MAX_LEN = 140; // Limite de caracteres para specName

/** Índices base 0 a partir da coluna B da aba "leituras" */
const COL_LEITURAS_CODE = 1; // Coluna C — Código do bem
const COL_LEITURAS_LOC = 2; // Coluna D — Localidade
let LAST_COL_LEITURAS = 9; //Número total de colunas na aba "leituras" (A até I).

/** Índices base 0 da aba "nao_encontrados_geral" */
const COL_NOTFOUND_LOC = 0; // Coluna A — Localidade
const COL_NOTFOUND_ASSET = 1; // Coluna B — Tombamento

// ============================================================
// getInventoryData — Aba "inventario"
// ============================================================

/**
 * Transforma linhas brutas da aba "inventario" (colunas D-L) nos objetos
 * estruturados `locations` e `inventory`.
 *
 * @param {Array<Array>} invData - Array 2D retornado por getValues() a partir da linha 2, coluna 4
 * @param {boolean} [addSpec=true] - Se true, inclui `name` (coluna L) em cada asset
 * @returns {{ locations: Array<{name: string, assetsCount: number}>, inventory: Array<{location: string, assets: Array}> }}
 */
function buildInventoryData_(invData, addSpec) {
  if (addSpec === undefined) { addSpec = true; }
  if (!invData || invData.length === 0) {
    return { locations: [], inventory: [] };
  }

  const inventoryMap = new Map();

  for (let i = 0; i < invData.length; i++) {
    const row = invData[i];
    const local = String(row[COL_INV_LOCATION]).trim();

    if (!local) continue;

    const asset = parseInt(row[COL_INV_ASSET], 10);
    if (isNaN(asset)) continue;

    if (!inventoryMap.has(local)) {
      inventoryMap.set(local, []);
    }

    if (addSpec) {
      const specName = String(row[COL_INV_SPECNAME] || '').trim().substring(0, SPEC_NAME_MAX_LEN);
      inventoryMap.get(local).push({ code: asset, name: specName });
    } else {
      inventoryMap.get(local).push({ code: asset });
    }
  }

  const locationsOutput = [];
  const inventoryOutput = [];

  const sortedKeys = Array.from(inventoryMap.keys()).sort(function (a, b) {
    return a.localeCompare(b, 'pt-BR');
  });

  for (let k = 0; k < sortedKeys.length; k++) {
    const key = sortedKeys[k];
    const assetsList = inventoryMap.get(key);
    inventoryOutput.push({ location: key, assets: assetsList });
    locationsOutput.push({ name: key, assetsCount: assetsList.length });
  }

  return { locations: locationsOutput, inventory: inventoryOutput };
}

// ============================================================
// getInventorySummary — Abas "leituras" + "localidades"
// ============================================================

/**
 * Processa as linhas da aba "leituras" (B2:D) e retorna um mapa de
 * localidade → array de códigos.
 *
 * @param {Array<Array>} data - Array 2D a partir da linha 2, colunas B-D
 * @returns {Object<string, number[]>} Mapa localidade → [códigos]
 */
function groupLeiturasByLocation_(data) {
  const groups = {};
  if (!data || data.length === 0) return groups;

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const code = parseInt(row[COL_LEITURAS_CODE], 10);
    if (isNaN(code)) continue;

    const location = String(row[COL_LEITURAS_LOC]).trim();
    if (!location) continue;

    if (!groups[location]) groups[location] = [];
    groups[location].push(code);
  }

  return groups;
}

/**
 * Processa as linhas da aba "localidades" (A2:D) e retorna um array
 * ordenado de objetos LocationSummary, opcionalmente filtrado por
 * targetLocation.
 *
 * @param {Array<Array>} locData - Array 2D a partir da linha 2, colunas A-D
 * @param {string|null} targetLocation - Localidade específica ou null para todas
 * @returns {Array<{name: string, totalAssets: number, assetsFindedCount: number, missingAssets: number}>}
 */
function buildLocationSummaries_(locData, targetLocation) {
  const locations = [];
  if (!locData || locData.length === 0) return locations;

  const target = targetLocation ? String(targetLocation).trim() : null;

  for (let r = 0; r < locData.length; r++) {
    const row = locData[r];
    const locName = row[0] ? String(row[0]).trim() : '';

    if (!locName || (target && locName !== target)) continue;

    locations.push({
      name: locName,
      totalAssets: Number(row[1]) || 0,
      assetsFindedCount: Number(row[2]) || 0,
      missingAssets: Number(row[3]) || 0
    });
  }

  locations.sort(function (a, b) {
    return a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
  });

  return locations;
}

/**
 * Ordena as chaves de `groups` e monta o array `assetsFinded`.
 *
 * @param {Object<string, number[]>} groups - Mapa de localidade → códigos
 * @returns {Array<{location: string, assets: number[]}>}
 */
function buildAssetsFinded_(groups) {
  return Object.keys(groups)
    .sort(function (a, b) { return a.localeCompare(b, 'pt-BR', { numeric: true }); })
    .map(function (loc) { return { location: loc, assets: groups[loc] }; });
}

/**
 * Função composta: recebe dados brutos das duas abas e retorna o resumo completo.
 * Equivale a getInventorySummary() do GAS.
 *
 * @param {Array<Array>} leiturasData - Dados da aba "leituras" (B2:D)
 * @param {Array<Array>} localidadesData - Dados da aba "localidades" (A2:D)
 * @param {string|null} targetLocation - Localidade alvo (opcional)
 * @returns {{ locations: Array, assetsFinded: Array }}
 */
function buildInventorySummary_(leiturasData, localidadesData, targetLocation) {
  const groups = groupLeiturasByLocation_(leiturasData);
  const locations = buildLocationSummaries_(localidadesData, targetLocation);
  const assetsFinded = buildAssetsFinded_(groups);
  return { locations: locations, assetsFinded: assetsFinded };
}

// ============================================================
// getNotFoundItens — Aba "nao_encontrados_geral"
// ============================================================

/**
 * Filtra as linhas da aba "nao_encontrados_geral" (A3:C) para a localidade alvo.
 *
 * @param {Array<Array>} data - Array 2D a partir da linha 3, colunas A-C
 * @param {string} targetLocation - Localidade a filtrar (obrigatório)
 * @returns {Array<Array<string>>} Lista de [Tombamento]
 */
function filterNotFoundItems_(data, targetLocation) {
  if (!targetLocation) {
    throw new Error('filterNotFoundItems_: targetLocation não fornecido.');
  }
  if (!data || data.length === 0) return [];

  const target = String(targetLocation).trim();
  const result = [];

  for (let d = 0; d < data.length; d++) {
    const row = data[d];
    const colA = row[COL_NOTFOUND_LOC];
    const colB = row[COL_NOTFOUND_ASSET];

    if (colA != null && String(colA).trim() === target) {
      result.push([colB]);
    }
  }

  return result;
}

// ============================================================
// getAppSettings — Aba "app_config"
// ============================================================

/**
 * Converte as linhas da aba "app_config" (A2:B) em um objeto chave-valor.
 * Tipagem automática: Date → ISO string, 'true'/'false' → boolean.
 *
 * @param {Array<Array>} data - Array 2D a partir da linha 2, colunas A-B
 * @returns {Object} Configurações como { chave: valor }
 */
function buildAppSettings_(data) {
  const settings = {};
  if (!data || data.length === 0) return settings;

  for (let i = 0; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const value = data[i][1];

    if (key) {
      // Type handling — case-insensitive para strings 'true'/'false' da planilha
      if (value instanceof Date) {
        settings[key] = value.toISOString().split('T')[0]; // Returns YYYY-MM-DD
      } else if (value === 'true' || value === 'TRUE' || value === true) {
        settings[key] = true;
      } else if (value === 'false' || value === 'FALSE' || value === false) {
        settings[key] = false;
      } else {
        settings[key] = value;
      }
    }
  }

  return settings;
}

/**
 * @fileoverview InventoryBaseline - Módulo de Gerenciamento de Cache de Dados Mestre
 * 
 * Gerencia o cache de dados do inventário e validações de localização.
 * Fornece métodos para consulta e verificação de ativos baseados na localização.
 * 
 * @module InventoryBaseline
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} InventoryItem
 * @property {string} location - Nome da localização
 * @property {number[]} assets - Array de códigos de ativo
 */

/**
 * @typedef {InventoryItem[]} InventoryData
 */

/**
 * @typedef {Object} VerificationResult
 * @property {boolean|string} status - Resultado da verificação (true = válido, false = inválido, 'check' = precisa confirmação)
 * @property {string} [msg] - Mensagem de erro quando status é false
 * @property {string} [local] - Localização encontrada quando status é 'check'
 */

/**
 * Classe principal do módulo InventoryBaseline
 * @class
 * @public
 */
function InventoryBaseline() {
    /**
     * Cache dos dados do inventário
     * @type {InventoryData|null}
     * @private
     */
    this.data = null;

    // Bind de métodos para garantir o contexto 'this'
    this.setAssetsDatabase = this.setAssetsDatabase.bind(this);
    this.getLocation = this.getLocation.bind(this);
    this.verifyItem = this.verifyItem.bind(this);
}

/**
 * Carrega a base de dados do inventário
 * @param {InventoryData} data - Dados estruturados do inventário
 * @returns {void}
 * @public
 * 
 * @example
 * // Formato esperado dos dados:
 * // [
 * //   { "location": "Sala 1", "assets": [1001, 1002, 1003] },
 * //   { "location": "Sala 2", "assets": [2001, 2002] }
 * // ]
 * 
 * inventoryBaseline.setAssetsDatabase(inventoryData);
 */
InventoryBaseline.prototype.setAssetsDatabase = function (data) {
    if (data && typeof data === 'object') {
        this.data = data;
    }
};

/**
 * Retorna a localização de um código de ativo
 * @param {string|number} asset - Código do ativo a ser verificado
 * @returns {string|null} Localização correspondente ou null se não encontrado
 * @public
 * 
 * @example
 * const location = inventoryBaseline.getLocation("1001");
 * // Retorna: "Sala 1" ou null
 */
InventoryBaseline.prototype.getLocation = function (asset) {
    if (!this.data || !Array.isArray(this.data)) return null;

    const codeToCheck = parseInt(asset, 10);
    if (isNaN(codeToCheck)) return null;

    // Percorre o array de objetos do inventário
    for (let i = 0; i < this.data.length; i++) {
        const item = this.data[i]; // { location: "Sala 1", assets: [...] }
        const loc = item.location;
        const codes = item.assets;

        // Verifica se o array de códigos existe e contém o tombamento
        if (Array.isArray(codes) && codes.indexOf(codeToCheck) !== -1) {
            return loc;
        }
    }

    return null;
};

/**
 * Retorna os códigos de ativo associados a uma localização
 * @param {string} location - Localização para buscar os códigos
 * @returns {number[]} Array de códigos de ativo associados à localização
 * @public
 * 
 * @example
 * const assets = inventoryBaseline.getAssetsFromLocation("Sala 1");
 * // Retorna: [1001, 1002, 1003]
 */
InventoryBaseline.prototype.getAssetsFromLocation = function (location) {
    if (!this.data || !Array.isArray(this.data)) return [];

    for (let i = 0; i < this.data.length; i++) {
        const item = this.data[i];
        if (item.location === location) {
            return item.assets;
        }
    }
    return [];
};

/**
 * Verifica se o item pertence à localização selecionada
 * @param {string|number} asset - Código do item a ser verificado
 * @param {string} selectedLocation - Localização selecionada para verificação
 * @returns {VerificationResult} Objeto com status e informações da verificação
 * @public
 * 
 * @example
 * // Item na localização correta
 * const result1 = inventoryBaseline.verifyItem("1001", "Sala 1");
 * // Retorna: { status: true }
 * 
 * // Item em localização diferente
 * const result2 = inventoryBaseline.verifyItem("1001", "Sala 2");
 * // Retorna: { status: 'check', local: 'Sala 1' }
 * 
 * // Item não encontrado
 * const result3 = inventoryBaseline.verifyItem("9999", "Sala 1");
 * // Retorna: { status: false, msg: "Código 9999 não encontrado na base." }
 */
InventoryBaseline.prototype.verifyItem = async function (asset, selectedLocation) {
    if (!this.data) {
        return { status: false, msg: "Base de dados não carregada." };
    }

    const locFound = this.getLocation(asset);

    if (locFound) {
        return locFound === selectedLocation
            ? { status: true }
            : { status: 'check', local: locFound };
    }

    return { status: false, msg: "Código " + asset + " não encontrado na base." };
};

/**
 * Retorna o estado atual dos dados carregados
 * @returns {boolean} true se dados estão carregados, false caso contrário
 * @public
 */
InventoryBaseline.prototype.isLoaded = function () {
    return this.data !== null && Array.isArray(this.data);
};

/**
 * Retorna estatísticas básicas do inventário
 * @returns {Object} Estatísticas do inventário
 * @property {number} totalLocations - Número total de localizações
 * @property {number} totalAssets - Número total de ativos
 * @public
 */
InventoryBaseline.prototype.getStats = function () {
    if (!this.data || !Array.isArray(this.data)) {
        return { totalLocations: 0, totalAssets: 0 };
    }

    const totalAssets = this.data.reduce((sum, location) => {
        return sum + (Array.isArray(location.assets) ? location.assets.length : 0);
    }, 0);

    return {
        totalLocations: this.data.length,
        totalAssets: totalAssets
    };
};

/**
 * Instância singleton do InventoryBaseline
 * @type {InventoryBaseline}
 */
export const inventoryBaseline = new InventoryBaseline();

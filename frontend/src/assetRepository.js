/**
 * @fileoverview AssetRepository - Gerenciamento de Dados Locais (ES2015 Prototype Version)
 * Responsável exclusivamente pelo CRUD e persistência no LocalStorage.
 * @module AssetRepository
 */

// Constantes de escopo do módulo
const STORAGE_KEY = 'BARCODE_APP_DATA_V1';
const VERSION_KEY = 'BARCODE_APP_VERSION';
const SAVE_DEBOUNCE_MS = 400;

/**
 * Enumeração dos status possíveis para os ativos
 * @readonly
 * @enum {string}
 */
export const AssetStatus = Object.freeze({
  /** @description Aguardando sincronização */
  PENDING: 'pending',
  /** @description Sincronização em andamento */
  IN_FLIGHT: 'inFlight',
  /** @description Sincronizado com sucesso */
  SYNCED: 'synced',
  /** @description Falha na sincronização */
  FAILED: 'failed'
});

/**
 * Construtor do AssetRepository - Responsável pelo gerenciamento de dados locais
 * @constructor
 * @classdesc Classe para gerenciamento de dados de ativos com persistência no LocalStorage
 */
function AssetRepository() {
  /** @type {Array<Object>} items - Lista de itens armazenados */
  this.items = [];
  /** @type {number|null} saveTimer - Timer para debounce das operações de salvamento */
  this.saveTimer = null;
  this._load();

  // Reativa itens que estavam marcados como sendo enviados na última sessão 
  // mas que não foram confirmados como sincronizados
  let saveNeeded = false;
  this.items.forEach(function (item) {
    if (item.status === AssetStatus.IN_FLIGHT) {
      item.status = AssetStatus.PENDING;
      saveNeeded = true;
    }
  });
  if (saveNeeded) {
    this._save();
  }
}

// --- Métodos Internos de Persistência ---

/**
 * Salva os dados no LocalStorage com debounce
 * @private
 * @param {boolean} [immediate=false] - Se true, salva imediatamente sem debounce
 */
AssetRepository.prototype._save = function (immediate) {
  const self = this;

  // Limpar timer existente
  if (self.saveTimer) {
    clearTimeout(this.saveTimer);
    self.saveTimer = null;
  }

  const persist = function () {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(self.items));
    } catch (e) {
      console.error('AssetRepository: Erro ao salvar', e);
      // Tentar salvar com dados reduzidos em caso de erro
      if (e.name === 'QuotaExceededError') {
        self._handleStorageFull();
      }
    }
  };

  if (immediate) {
    persist();
  } else {
    self.saveTimer = setTimeout(persist, SAVE_DEBOUNCE_MS);
  }
};

/**
 * Trata o erro de quota excedida no LocalStorage aplicando uma limpeza conservadora
 * @private
 * @description Método auxiliar que é chamado automaticamente quando o LocalStorage está cheio.
 * Remove os itens mais antigos mantendo apenas os 100 registros mais recentes para evitar
 * perda total de dados. Em caso de falha crítica, apenas registra o erro sem lançar exceção.
 * 
 * @example
 * // Chamado automaticamente pelo método _save quando ocorre QuotaExceededError
 * this._handleStorageFull();
 * 
 * @throws {Error} Não lança exceções, apenas registra erros no console
 * 
 * @returns {void}
 * 
 * @todo Implementar estratégia mais sofisticada de limpeza (por prioridade/status)
 */
AssetRepository.prototype._handleStorageFull = function () {
  console.warn('AssetRepository: Storage cheio, aplicando limpeza conservadora');

  /**
   * Ordena os itens por data de criação (mais recentes primeiro) e mantém apenas os 100 mais recentes
   * @type {Array<Object>}
   */
  this.items = this.items
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100);

  try {
    /**
     * Tenta salvar os dados reduzidos após a limpeza conservadora
     * @throws {Error} Possível erro se mesmo os dados reduzidos excederem a quota
     */
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    console.info('AssetRepository: Limpeza conservadora aplicada com sucesso');
  } catch (e) {
    /**
     * Erro crítico - mesmo os dados reduzidos não cabem no storage
     * @type {Error}
     */
    console.error('AssetRepository: Erro crítico ao salvar após limpeza', e);

    /**
     * Última tentativa: limpar completamente o storage em caso de falha crítica
     * Isso previne que a aplicação fique em estado inconsistente
     */
    try {
      this.items = [];
      localStorage.removeItem(STORAGE_KEY);
      console.warn('AssetRepository: Storage limpo completamente devido a erro crítico');
    } catch (finalError) {
      /**
       * Falha catastrófica - não é possível acessar o storage de forma alguma
       * @type {Error}
       */
      console.error('AssetRepository: Falha catastrófica no storage', finalError);
    }
  }

  /**
   * Notifica a aplicação sobre a mudança drástica no repositório
   * Permite que a UI atualize adequadamente
   */
  this._emit('repositoryChanged');
};


/**
 * Carrega os dados do LocalStorage
 * @private
 */
AssetRepository.prototype._load = function () {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    this.items = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('AssetRepository: Erro ao carregar', e);
    this.items = [];
  }
};

/**
 * Dispara eventos customizados
 * @private
 * @param {string} name - Nome do evento
 * @param {Object} [detail] - Detalhes do evento
 */
AssetRepository.prototype._emit = function (name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
};

// --- CRUD Público ---

/**
 * Adiciona um novo item ao repositório
 * @param {string|number} rawCode - Código do ativo (código de barras)
 * @param {string} location - Localização do ativo
 * @returns {Promise<Object|null>} Item criado ou null se já existir
 */
AssetRepository.prototype.addItem = async function (rawCode, location) {
  // Validações rigorosas
  if (typeof rawCode === 'undefined' || rawCode === null || rawCode === '') {
    console.warn('AssetRepository.addItem: Código do ativo é inválido', rawCode);
    return null;
  }

  if (typeof location === 'undefined' || location === null || typeof location !== 'string' || location.trim() === '') {
    console.warn('AssetRepository.addItem: Localização é inválida', location);
    return null;
  }

  const barcode = parseInt(String(rawCode).trim(), 10);
  if (isNaN(barcode) || barcode <= 0 || !Number.isSafeInteger(barcode)) {
    console.warn('AssetRepository.addItem: Código do ativo não é um número válido', rawCode);
    return null;
  }

  const loc = location.trim();
  if (loc.length > 200) { // Limite razoável para localização
    console.warn('AssetRepository.addItem: Localização é muito longa', loc);
    return null;
  }

  const exists = this.items.some(function (i) {
    return i.code === barcode && i.location === loc;
  });

  if (exists) {
    console.info('AssetRepository.addItem: Item já existe', { code: barcode, location: loc });
    return null;
  }

  const item = {
    uid: Date.now().toString(36) + Math.random().toString(36).slice(2),
    code: barcode,
    location: loc,
    state: 3,
    ipvu: 8,
    obs: '',
    status: AssetStatus.PENDING,
    retryCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  this.items.push(item);
  this._save(true);
  this._emit('assetAdded', { item: Object.assign({}, item) });
  this._emit('repositoryChanged');
  return item;
};

/**
 * Atualiza os dados de um item existente
 * @param {string} uid - Identificador único do item
 * @param {number} state - Estado do item
 * @param {number} ipvu - Valor IPVU do item
 * @param {string} obs - Observações do item
 * @returns {boolean} True se o item foi atualizado, false se não encontrado
 */
AssetRepository.prototype.updateItem = function (uid, state, ipvu, obs) {
  // Validações rigorosas
  if (typeof uid !== 'string' || uid.trim() === '') {
    console.warn('AssetRepository.updateItem: UID é inválido', uid);
    return false;
  }

  if (typeof state !== 'number' || isNaN(state) || state < 0 || state > 5) { // Assumindo estado entre 0-5
    console.warn('AssetRepository.updateItem: Estado é inválido', state);
    return false;
  }

  if (typeof ipvu !== 'number' || isNaN(ipvu) || ipvu < 0 || ipvu > 10) {
    console.warn('AssetRepository.updateItem: IPVU é inválido', ipvu);
    return false;
  }

  if (typeof obs !== 'undefined' && obs !== null && typeof obs !== 'string') {
    console.warn('AssetRepository.updateItem: Observações devem ser uma string', obs);
    return false;
  }

  // Limite razoável para observações
  const observation = typeof obs === 'string' ? obs.substring(0, 140) : '';

  const item = this.items.find(function (i) { return i.uid === uid; });
  if (!item) {
    console.warn('AssetRepository.updateItem: Item não encontrado', uid);
    return false;
  }

  item.state = state;
  item.ipvu = ipvu;
  item.obs = observation;
  item.updatedAt = Date.now();
  item.status = AssetStatus.PENDING;
  item.retryCount = 0;

  this._save();
  this._emit('assetDataChanged', { item: Object.assign({}, item) });
  this._emit('repositoryChanged');
  return true;
};

/**
 * Verifica se um item existe no repositório
 * @param {string|number} barcode - Código do ativo
 * @param {string} location - Localização do ativo
 * @returns {Promise<boolean>} True se o item existe, false caso contrário
 */
AssetRepository.prototype.hasItem = async function (barcode, location) {
  // Validações rigorosas
  if (typeof barcode === 'undefined' || barcode === null || barcode === '') {
    console.warn('AssetRepository.hasItem: Código do ativo é inválido', barcode);
    return false;
  }

  if (typeof location === 'undefined' || location === null || typeof location !== 'string' || location.trim() === '') {
    console.warn('AssetRepository.hasItem: Localização é inválida', location);
    return false;
  }

  const code = parseInt(String(barcode).trim(), 10);
  if (isNaN(code) || code <= 0 || !Number.isSafeInteger(code)) {
    console.warn('AssetRepository.hasItem: Código do ativo não é um número válido', barcode);
    return false;
  }

  const loc = location.trim();
  if (loc.length > 200) {
    console.warn('AssetRepository.hasItem: Localização é muito longa', loc);
    return false;
  }

  return this.items.some(function (item) {
    return item.code === code && item.location === loc;
  });
};

/**
 * Obtém um item específico pelo UID
 * @param {string} uid - Identificador único do item
 * @returns {Object|null} Item encontrado ou null se não existir
 */
AssetRepository.prototype.getItem = function (uid) {
  // Validação rigorosa
  if (typeof uid !== 'string' || uid.trim() === '') {
    console.warn('AssetRepository.getItem: UID é inválido', uid);
    return null;
  }

  return this.items.find(function (i) { return i.uid === uid; }) || null;
};

/**
 * Obtém todos os itens do repositório (cópia)
 * @returns {Array<Object>} Array com cópia de todos os itens
 */
AssetRepository.prototype.getAllItems = function () {
  return this.items.map(function (item) { return Object.assign({}, item); });
};

/**
 * Obtém todos os itens de uma localização específica
 * @param {string} location - Localização para filtrar
 * @returns {Array<Object>} Array com cópia dos itens filtrados por localização
 */
AssetRepository.prototype.getItemsByLocation = function (location) {
  // Validação rigorosa
  if (typeof location === 'undefined' || location === null || typeof location !== 'string' || location.trim() === '') {
    // console.warn('AssetRepository.getItemsByLocation: Localização é inválida', location);
    return this.getAllItems();
  }

  const targetLoc = location.trim();
  if (targetLoc.length > 200) {
    console.warn('AssetRepository.getItemsByLocation: Localização é muito longa', targetLoc);
    return [];
  }

  return this.items
    .filter(function (item) { return item.location === targetLoc; })
    .map(function (item) { return Object.assign({}, item); });
};

/**
 * Obtém estatísticas dos itens por status
 * @returns {Object} Objeto com estatísticas de contagem por status
 * @property {number} total - Total de itens
 * @property {number} synced - Itens sincronizados
 * @property {number} pending - Itens pendentes ou em andamento
 * @property {number} failed - Itens com falha
 */
AssetRepository.prototype.getStats = function () {
  return {
    total: this.items.length,
    synced: this.items.filter(function (i) { return i.status === AssetStatus.SYNCED; }).length,
    pending: this.items.filter(function (i) {
      return i.status === AssetStatus.PENDING || i.status === AssetStatus.IN_FLIGHT;
    }).length,
    failed: this.items.filter(function (i) { return i.status === AssetStatus.FAILED; }).length
  };
};

// --- Métodos de Suporte à Sincronização ---

/**
 * Obtém um lote de itens pendentes para sincronização
 * @param {number} batchSize - Tamanho máximo do lote
 * @returns {Array<Object>} Array com os itens pendentes (até batchSize)
 */
AssetRepository.prototype.getPendingBatch = function (batchSize) {
  // Validação rigorosa
  if (typeof batchSize !== 'number' || isNaN(batchSize) || batchSize <= 0 || batchSize > 1000) { // Limite razoável
    console.warn('AssetRepository.getPendingBatch: Tamanho do lote é inválido', batchSize);
    return [];
  }

  return this.items
    .filter(function (i) { return i.status === AssetStatus.PENDING; })
    .slice(0, batchSize);
};

/**
 * Marca um lote de itens como "em sincronização"
 * @param {Array<string>} uids - Array de UIDs dos itens a serem marcados
 */
AssetRepository.prototype.markBatchInFlight = function (uids) {
  // Validação rigorosa
  if (!Array.isArray(uids) || uids.length === 0) {
    console.warn('AssetRepository.markBatchInFlight: Lista de UIDs é inválida ou vazia', uids);
    return;
  }

  // Validar que todos os elementos são strings válidas
  for (let i = 0; i < uids.length; i++) {
    if (typeof uids[i] !== 'string' || uids[i].trim() === '') {
      console.warn('AssetRepository.markBatchInFlight: UID inválido encontrado', uids[i]);
      return;
    }
  }

  // Limitar o tamanho do lote para evitar problemas de desempenho
  if (uids.length > 1000) {
    console.warn('AssetRepository.markBatchInFlight: Lote muito grande, limitando a 1000 itens');
    uids = uids.slice(0, 1000);
  }

  this.items.forEach(function (item) {
    if (uids.indexOf(item.uid) !== -1) {
      item.status = AssetStatus.IN_FLIGHT;
    }
  });
  this._save();
};

/**
 * Processa o resultado de uma sincronização bem-sucedida
 * @param {Array<string>} syncedUids - Array de UIDs dos itens sincronizados com sucesso
 */
AssetRepository.prototype.processSyncSuccess = function (syncedUids) {
  // Validação rigorosa
  if (!Array.isArray(syncedUids) || syncedUids.length === 0) {
    console.warn('AssetRepository.processSyncSuccess: Lista de UIDs sincronizados é inválida ou vazia', syncedUids);
    return;
  }

  // Validar que todos os elementos são strings válidas
  for (let i = 0; i < syncedUids.length; i++) {
    if (typeof syncedUids[i] !== 'string' || syncedUids[i].trim() === '') {
      console.warn('AssetRepository.processSyncSuccess: UID inválido encontrado', syncedUids[i]);
      return;
    }
  }

  // Limitar o tamanho do lote para evitar problemas de desempenho
  if (syncedUids.length > 1000) {
    console.warn('AssetRepository.processSyncSuccess: Lote muito grande, limitando a 1000 itens');
    syncedUids = syncedUids.slice(0, 1000);
  }

  const self = this;
  let changed = false;
  this.items.forEach(function (item) {
    if (item.status === AssetStatus.IN_FLIGHT && syncedUids.indexOf(item.uid) !== -1) {
      item.status = AssetStatus.SYNCED;
      item.retryCount = 0;
      changed = true;
      self._emit('assetDataChanged', { item: Object.assign({}, item), type: 'sync' });
    }
  });

  if (changed) this._save(true);
};

/**
 * Processa o resultado de uma sincronização com falha (para retry)
 * @param {Array<string>} failedUids - Array de UIDs dos itens com falha
 * @param {number} maxRetries - Número máximo de tentativas permitidas
 */
AssetRepository.prototype.processSyncRetry = function (failedUids, maxRetries) {
  // Validações rigorosas
  if (!Array.isArray(failedUids) || failedUids.length === 0) {
    console.warn('AssetRepository.processSyncRetry: Lista de UIDs com falha é inválida ou vazia', failedUids);
    return;
  }

  if (typeof maxRetries !== 'number' || isNaN(maxRetries) || maxRetries < 0) {
    console.warn('AssetRepository.processSyncRetry: Número máximo de tentativas é inválido', maxRetries);
    return;
  }

  // Validar que todos os elementos são strings válidas
  for (let i = 0; i < failedUids.length; i++) {
    if (typeof failedUids[i] !== 'string' || failedUids[i].trim() === '') {
      console.warn('AssetRepository.processSyncRetry: UID inválido encontrado', failedUids[i]);
      return;
    }
  }

  // Limitar o tamanho do lote para evitar problemas de desempenho
  if (failedUids.length > 1000) {
    console.warn('AssetRepository.processSyncRetry: Lote muito grande, limitando a 1000 itens');
    failedUids = failedUids.slice(0, 1000);
  }

  const self = this;
  let changed = false;
  this.items.forEach(function (item) {
    if (item.status === AssetStatus.IN_FLIGHT && failedUids.indexOf(item.uid) !== -1) {
      item.retryCount++;
      item.status = item.retryCount >= maxRetries ? AssetStatus.FAILED : AssetStatus.PENDING;
      changed = true;

      if (item.status === AssetStatus.FAILED) {
        self._emit('assetFailed', { item: Object.assign({}, item) });
      }
    }
  });
  if (changed) this._save(true);
};

/**
 * Reativa itens com status de falha para nova tentativa de sincronização
 * @returns {boolean} True se algum item foi reativado, false caso contrário
 */
AssetRepository.prototype.retryFailed = function () {
  let changed = false;
  this.items.forEach(function (item) {
    if (item.status === AssetStatus.FAILED) {
      item.status = AssetStatus.PENDING;
      item.retryCount = 0;
      changed = true;
    }
  });
  if (changed) {
    this._save(true);
    this._emit('repositoryChanged');
  }
  return changed;
};

/**
 * Aplica manutenção no repositório (limpeza por data e controle de versão)
 * @param {Object} appSettings - Configurações da aplicação
 * @param {string} appSettings.min_valid_date - Data mínima válida para os itens
 * @param {string} appSettings.app_version - Versão atual da aplicação
 */
AssetRepository.prototype.applyMaintenance = function (appSettings) {
  // Validações rigorosas
  if (!appSettings || typeof appSettings !== 'object') {
    console.warn('AssetRepository.applyMaintenance: Configurações da aplicação são inválidas', appSettings);
    return;
  }

  const min_valid_date = appSettings.min_valid_date;
  const app_version = appSettings.app_version;

  // Validar formato da data
  const minDateTimestamp = new Date(min_valid_date).getTime();
  if (isNaN(minDateTimestamp)) {
    console.warn('AssetRepository.applyMaintenance: Data mínima inválida', min_valid_date);
    return;
  }

  const newVersion = String(app_version).trim();
  if (!newVersion) {
    console.warn('AssetRepository.applyMaintenance: Versão do aplicativo é inválida', app_version);
    return;
  }

  const localVersion = localStorage.getItem(VERSION_KEY);
  let forceSave = false;

  if (!localVersion) {
    localStorage.setItem(VERSION_KEY, newVersion);
  } else if (localVersion !== newVersion) {
    this.clearStorage();
    localStorage.setItem(VERSION_KEY, newVersion);
    console.info('AssetRepository.applyMaintenance: Versão mudou, limpeza completa realizada');
    return;
  }

  if (this.items.length > 0) {
    const initialCount = this.items.length;

    this.items = this.items.filter(function (item) {
      return item.createdAt >= minDateTimestamp;
    });

    if (this.items.length !== initialCount) {
      forceSave = true;
      console.info('AssetRepository.applyMaintenance: Itens antigos removidos', {
        initialCount,
        remainingCount: this.items.length,
        removedCount: initialCount - this.items.length
      });
    }
  }

  if (forceSave) {
    this._save(true);
    this._emit('repositoryChanged');
  }
};

/**
 * Limpa completamente o armazenamento local
 * @returns {boolean} True indicando sucesso na operação
 */
AssetRepository.prototype.clearStorage = function () {
  this.items = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('AssetRepository: Erro ao limpar storage', e);
  }
  this._emit('repositoryChanged');
  this._emit('syncCompleted');
  return true;
};

/**
 * Instância única do AssetRepository para uso na aplicação
 * @type {AssetRepository}
 */
export const assetRepository = new AssetRepository();
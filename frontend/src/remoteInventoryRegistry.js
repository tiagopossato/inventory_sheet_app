/**
 * @fileoverview RemoteInventoryRegistry - Módulo de Gerenciamento do Registro Remoto de Inventário
 * 
 * Gerencia o cache e sincronização do estado das leituras globais com o backend.
 * Mantém um registro local dos itens já escaneados e suas localizações.
 * 
 * @module RemoteInventoryRegistry
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} RemoteInventoryRegistryOptions
 * @property {number} [updateIntervalMs=30000] - Intervalo entre sincronizações em milissegundos
 * @property {number} [ttlMs=600000] - Tempo de vida do cache local em milissegundos (10 minutos)
 * @property {string} [storageKey='SCANNING_REGISTRY_V1'] - Chave para armazenamento local
 */

/**
 * @typedef {Object} InventorySummaryResponse
 * @property {Array} locations - Lista de localizações disponíveis
 * @property {Array} assetsFinded - Grupos de ativos encontrados por localização
 */

/**
 * @typedef {Object} AssetGroup
 * @property {string} location - Nome da localização
 * @property {string[]} assets - Array de códigos de ativos
 */

import { locationSelector } from "./locationSelector.js";
import { backendService } from "./backendService.js"

/**
 * Classe principal do módulo RemoteInventoryRegistry
 * @class
 * @public
 * @param {RemoteInventoryRegistryOptions} [options] - Opções de configuração
 */
function RemoteInventoryRegistry(options) {
    const opts = options || {};

    /**
     * Cache interno de códigos para localizações
     * @type {Map<string, string>}
     * @private
     */
    this.cache = new Map(); // code -> location

    /**
     * Intervalo entre sincronizações
     * @type {number}
     * @private
     */
    this.intervalMs = opts.updateIntervalMs || 30000;

    /**
     * Tempo de vida do cache local
     * @type {number}
     * @private
     */
    this.ttlMs = opts.ttlMs || 600000; // 10 minutos

    /**
     * Chave para armazenamento local
     * @type {string}
     * @private
     */
    this.storageKey = opts.storageKey || 'SCANNING_REGISTRY_V1';

    /**
     * Timer para sincronização periódica
     * @type {number|null}
     * @private
     */
    this.timer = null;

    /**
     * Flag indicando se está em processo de sincronização
     * @type {boolean}
     * @private
     */
    this.isFetching = false;

    /**
     * Flag indicando se o módulo está pronto para uso
     * @type {boolean}
     * @private
     */
    this.ready = false;
    window.dispatchEvent(new CustomEvent('inventoryRegistryIsFetching', { detail: { isFetching: self.isFetching } }));

    /**
     * Timestamp da última atualização
     * @type {Date|null}
     * @private
     */
    this.lastUpdated = null;

    // Vincula o contexto para o event listener
    this._handleOnline = this._syncWithRemote.bind(this);

    // Inicialização
    this._loadFromStorage();
    this._setupListeners();
    this.start();
}

/**
 * Configura os listeners de eventos do sistema
 * @private
 */
RemoteInventoryRegistry.prototype._setupListeners = function () {
    const self = this;

    // Usa arrow functions ou referências nomeadas para evitar duplicidade
    window.addEventListener('online', () => self.start());
    window.addEventListener('offline', () => self.stop());

    // Evita múltiplas chamadas rápidas com um pequeno debounce ou flag
    const syncHandler = () => self._syncWithRemote();
    window.addEventListener('locationChanged', syncHandler);
    window.addEventListener('syncCompleted', syncHandler);
};

/* --- CICLO DE VIDA --- */

/**
 * Inicia o processo de sincronização periódica
 * @public
 */
RemoteInventoryRegistry.prototype.start = function () {
    const self = this;
    // Se já houver um timer, cancela para reiniciar a contagem
    this.stop();

    // Inicia a primeira sincronização com pequeno delay
    setTimeout(function () {
        self._syncWithRemote();
    }, 1500);

};

/**
 * Para o processo de sincronização periódica
 * @public
 */
RemoteInventoryRegistry.prototype.stop = function () {
    if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
    }
};

/* --- API PÚBLICA --- */

/**
 * Verifica a localização de um ativo no registro remoto
 * @param {string} code - Código do ativo a ser verificado
 * @returns {Promise<string|null>} Localização do ativo ou null se não encontrado
 * @public
 */
RemoteInventoryRegistry.prototype.checkAssetLocation = async function (code) {
    if (!this.ready || !code) return null;
    return this.cache.get(this._normalizeCode(code)) || null;
};

/**
 * Verifica se um código já foi escaneado em qualquer localização
 * @param {string} code - Código do ativo a ser verificado
 * @returns {boolean} true se o código existe no registro
 * @public
 */
RemoteInventoryRegistry.prototype.hasBeenScanned = function (code) {
    if (!code) return false;
    return this.cache.has(this._normalizeCode(code));
};

/* --- AUXILIARES E PERSISTÊNCIA --- */

/**
 * Normaliza um código para formato padrão
 * @param {string} value - Código a ser normalizado
 * @returns {string} Código normalizado
 * @private
 */
RemoteInventoryRegistry.prototype._normalizeCode = function (value) {
    return String(value).trim().toUpperCase();
};

/**
 * Carrega o cache do armazenamento local
 * @private
 */
RemoteInventoryRegistry.prototype._loadFromStorage = function () {
    try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (!parsed.timestamp || !parsed.data) return;

        const age = Date.now() - parsed.timestamp;
        if (age > this.ttlMs) {
            console.warn("RemoteInventoryRegistry: Cache expirado. Limpando...");
            localStorage.removeItem(this.storageKey);
            return;
        }

        // Reconstrói o Map a partir do array salvo
        this.cache = new Map(parsed.data);
        this.ready = true;
        this.lastUpdated = new Date(parsed.timestamp);
    } catch (e) {
        console.error("RemoteInventoryRegistry: Erro ao carregar cache", e);
        localStorage.removeItem(this.storageKey);
    }
};

/**
 * Salva o cache atual no armazenamento local
 * @private
 */
RemoteInventoryRegistry.prototype._saveToStorage = function () {
    try {
        // Converte o Map para Array para poder salvar em JSON
        const payload = {
            timestamp: Date.now(),
            data: Array.from(this.cache.entries())
        };
        localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (e) {
        console.error("RemoteInventoryRegistry: Erro ao salvar cache (quota excedida?)", e);
    }
};

/* --- SINCRONIZAÇÃO COM O BACKEND --- */

/**
 * Agenda a próxima sincronização
 * @private
 */
RemoteInventoryRegistry.prototype._scheduleNext = function () {
    const self = this;
    if (this.timer) clearTimeout(this.timer);

    this.timer = setTimeout(function () {
        self._syncWithRemote();
    }, this.intervalMs);
};

/**
 * Realiza a sincronização com o servidor
 * Processa o objeto retornado: { locations: [...], assetsFinded: [...] }
 * @private
 */
RemoteInventoryRegistry.prototype._syncWithRemote = function () {
    const self = this;
    // 1. Limpa qualquer agendamento anterior para reiniciar o contador
    if (self.timer) {
        clearTimeout(self.timer);
        self.timer = null;
    }

    if (self.isFetching || !navigator.onLine) {
        // Se estiver offline ou já buscando, reagenda para tentar de novo no intervalo normal
        self._scheduleNext();
        return;
    }


    self.isFetching = true;
    window.dispatchEvent(new CustomEvent('inventoryRegistryIsFetching', { detail: { isFetching: self.isFetching } }));
    let selectedLocation = locationSelector.getSelectedLocation();
    selectedLocation = selectedLocation === locationSelector.NONE_SELECTED ? null : selectedLocation;

    /**
     * Processa a resposta do servidor e atualiza o cache local
     * @param {InventorySummaryResponse} response - Resposta do servidor com dados do inventário
     * @private
     */
    function processResponse(response) {
        // Verificação de conexão após o retorno
        if (!navigator.onLine) {
            self.isFetching = false;
            window.dispatchEvent(new CustomEvent('inventoryRegistryIsFetching', { detail: { isFetching: self.isFetching } }));
            return;
        }

        try {
            // VALIDAÇÃO Verifica se o objeto e a chave esperada existem
            if (!response || !Array.isArray(response.assetsFinded)) {
                console.error("RemoteInventoryRegistry: Estrutura de dados assetsFinded inválida", response);
                self.isFetching = false;
                window.dispatchEvent(new CustomEvent('inventoryRegistryIsFetching', { detail: { isFetching: self.isFetching } }));
                return;
            }
            if (!response || !Array.isArray(response.locations)) {
                console.error("RemoteInventoryRegistry: Estrutura de dados locations inválida", response);
                self.isFetching = false;
                window.dispatchEvent(new CustomEvent('inventoryRegistryIsFetching', { detail: { isFetching: self.isFetching } }));
                return;
            }

            const newCache = new Map();
            const groups = response.assetsFinded;

            // Itera sobre os grupos (cada grupo é uma localidade com seus itens)
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const locationName = group.location;
                const assets = group.assets;

                if (Array.isArray(assets)) {
                    for (let j = 0; j < assets.length; j++) {
                        const code = self._normalizeCode(assets[j]);
                        if (code !== "") {
                            // Mapeia o código para o nome da localidade
                            newCache.set(code, locationName);
                        }
                    }
                }
            }

            // Atualização do Estado Interno
            self.cache = newCache;
            self.ready = true;
            self.lastUpdated = new Date();
            self._saveToStorage();

            // Disparo de Evento com metadados do objeto recebido
            window.dispatchEvent(new CustomEvent('inventoryRegistryUpdated', {
                detail: {
                    locations: response.locations
                }
            }));

            // console.info(`RemoteInventoryRegistry: Sincronizado. ${newCache.size} itens em ${response.locations.length} locais.`);
        } catch (err) {
            console.error("RemoteInventoryRegistry: Erro ao processar resposta", err);
        } finally {
            self.isFetching = false;
            window.dispatchEvent(new CustomEvent('inventoryRegistryIsFetching', { detail: { isFetching: self.isFetching } }));
            self._scheduleNext(); // <--- REAGENDA APÓS SUCESSO
        }
    }


    // Usar backendService com tratamento unificado
    backendService.getInventorySummary(selectedLocation)
        .then(processResponse)
        .catch(function (error) {
            console.error("RemoteInventoryRegistry: Falha na chamada ao GAS", error);
            self.isFetching = false;
            window.dispatchEvent(new CustomEvent('inventoryRegistryIsFetching', { detail: { isFetching: self.isFetching } }));
            self._scheduleNext(); // <--- REAGENDA APÓS FALHA
        });
};

// --- INSTANCIAÇÃO GLOBAL ---

/**
 * Instância singleton do RemoteInventoryRegistry
 * @type {RemoteInventoryRegistry}
 */
export const remoteInventoryRegistry = new RemoteInventoryRegistry({
    updateIntervalMs: 30000,
    ttlMs: 10 * 60 * 1000 // 10 min
});

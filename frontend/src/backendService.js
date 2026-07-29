/**
 * @fileoverview BackendService - Módulo de abstração para chamadas do backend
 * 
 * Centraliza todas as comunicações com o Google Apps Script (GAS) e fornece
 * uma interface unificada para possível migração para outros backends.
 * Implementa padrão Adapter para desacoplamento.
 * 
 * @module BackendService
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} SaveCodeBatchPayload
 * @property {string} uid - Identificador único do item
 * @property {string} code - Código de barras
 * @property {string} location - Localização
 * @property {number} state - Estado do bem
 * @property {number} ipvu - Vida útil estimada
 * @property {string} obs - Observações
 */

/**
 * @typedef {Object} MessagePayload
 * @property {string} uid - Identificador único da mensagem
 * @property {string} location - Localização
 * @property {string} message - Texto da mensagem
 */

/**
 * @typedef {Object} InventorySummaryResponse
 * @property {Array} locations - Lista de localizações
 * @property {Array} assetsFinded - Ativos encontrados por localização
 */

/**
 * @typedef {Object} BackendCallOptions
 * @property {number} timeout - Timeout em milissegundos
 * @property {boolean} retryOnFailure - Se deve tentar novamente em caso de falha
 */

/**
 * Classe principal do módulo BackendService
 * @class
 * @public
 */
function BackendService() {
    /**
     * Configuração padrão para chamadas
     * @type {BackendCallOptions}
     * @private
     */
    this.defaultOptions = {
        timeout: 30000,
        retryOnFailure: true,
        maxRetries: 3,
        baseDelay: 2000
    };

    /**
     * Contador de chamadas para debugging
     * @type {Object}
     * @private
     */
    this.callStats = {
        total: 0,
        success: 0,
        failure: 0,
        pending: 0
    };

    /**
     * Flag que indica se o acesso foi negado permanentemente.
     * Quando `true`, todas as chamadas ao backend são bloqueadas.
     * @type {boolean}
     * @private
     */
    this.accessDenied = false;
}

BackendService.prototype.getCallConfig = function (functionName) {
    const configs = {
        'saveCodeBatch': {
            timeout: 15000,
            retryOnFailure: true,
            maxRetries: 2, // Poucas tentativas para evitar duplicação
            baseDelay: 2000
        },
        'getInventorySummary': {
            timeout: 30000,
            retryOnFailure: true,
            maxRetries: 3,
            baseDelay: 1000
        },
        'getNotFoundItens': {
            timeout: 25000,
            retryOnFailure: true,
            maxRetries: 2,
            baseDelay: 1500
        },
        'saveMessage': {
            timeout: 10000,
            retryOnFailure: true,
            maxRetries: 1, // Mensagens podem esperar
            baseDelay: 3000
        },
        'getInventoryData': {
            timeout: 20000,
            retryOnFailure: true,
            maxRetries: 3, // Dados críticos, mais tentativas
            baseDelay: 1000
        }
    };

    return configs[functionName] || this.defaultOptions;
};


/**
 * Verifica se o ambiente suporta Google Apps Script
 * @returns {boolean} true se estiver em ambiente GAS
 * @public
 */
BackendService.prototype.isGASEnvironment = function () {
    return typeof google !== 'undefined' && typeof google.script !== 'undefined';
};

/**
 * Executa uma chamada genérica ao backend com tratamento de erro
 * @param {string} functionName - Nome da função no GAS
 * @param {*} params - Parâmetros para a função
 * @returns {Promise<any>} Resultado da chamada
 * @private
 */

BackendService.prototype._callBackend = function (functionName, params = {}) {
    const self = this;

    // Bloqueia novas chamadas se acesso foi negado permanentemente
    if (self.accessDenied) {
        return Promise.reject(new Error('Acesso negado: novas requisições bloqueadas.'));
    }

    const functionConfig = self.getCallConfig(functionName);
    const config = { ...functionConfig, };

    self.callStats.total++;
    self.callStats.pending++;

    // MELHORIA: Garante que os dados são serializáveis antes de enviar
    try {
        JSON.stringify(params);
    } catch (e) {
        return Promise.reject(new Error(`Parâmetros inválidos para ${functionName}: Não serializável`));
    }

    // Operação que será repetida
    const operation = () => {
        return new Promise((resolve, reject) => {
            if (!self.isGASEnvironment()) {
                reject(new Error('Ambiente GAS não disponível'));
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error(`Timeout na chamada ${functionName} após ${config.timeout}ms`));
            }, config.timeout);

            google.script.run
                .withSuccessHandler((result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .withFailureHandler((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                })
            [functionName](params);
        });
    };

    // Aplicar retry se configurado
    const executeCall = config.retryOnFailure && config.maxRetries > 0
        ? () => self._retryOperation(operation, {
            maxRetries: config.maxRetries,
            baseDelay: 1000,
            maxDelay: config.timeout * 0.8, // 80% do timeout máximo
            shouldRetry: (error) => {
                // Garante que tem uma string para verificar
                const errorString = error ? (error.message || error.toString()) : '';

                if (!errorString) return false; // Erro desconhecido, não tenta de novo

                // Se for erro de cota do Google (muito comum em loops)
                if (errorString.includes('ScriptError') || errorString.includes('Rate Limit')) return true;
                if (errorString.includes('Timeout')) return true;

                // Não repetir para esses tipos de erro
                if (errorString.includes('Acesso negado')) return false;
                if (errorString.includes('Auth')) return false;
                if (errorString.includes('404')) return false;
                return true;
            }
        })
        : operation;

    return executeCall()
        .then((result) => {
            self.callStats.success++;
            self.callStats.pending--;
            return result;
        })
        .catch((error) => {
            self.callStats.failure++;
            self.callStats.pending--;

            // Detecta erro de acesso negado e trava novas requisições
            const errorString = error ? (error.message || error.toString()) : '';
            if (errorString.includes('Acesso negado')) {
                self.accessDenied = true;
                window.dispatchEvent(new CustomEvent('accessDenied', {
                    detail: { reason: errorString }
                }));
            }

            throw error;
        });
};


/**
 * Método de retry com exponential backoff e jitter
 * @param {Function} operation - Função assíncrona a ser executada
 * @param {Object} options - Opções do retry
 * @param {number} options.maxRetries - Número máximo de tentativas
 * @param {number} options.baseDelay - Delay base em ms
 * @param {number} options.maxDelay - Delay máximo em ms
 * @param {Function} options.shouldRetry - Função para determinar se deve tentar novamente
 * @returns {Promise<any>} Resultado da operação
 * @private
 */
BackendService.prototype._retryOperation = async function (operation, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        shouldRetry = (error) => true
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await operation();
            // Se chegou aqui, a operação foi bem-sucedida
            if (attempt > 0) {
                console.log(`✅ Retry bem-sucedido na tentativa ${attempt + 1}`);
            }
            return result;
        } catch (error) {
            lastError = error;

            // Verificar se deve tentar novamente
            if (attempt === maxRetries || !shouldRetry(error)) {
                break;
            }

            // Calcular delay com exponential backoff e jitter
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt) * (0.5 + Math.random()),
                maxDelay
            );

            console.warn(`🔄 Tentativa ${attempt + 1} falhou, tentando novamente em ${Math.round(delay)}ms:`, error.message);

            // Aguardar antes da próxima tentativa
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Todas as tentativas falharam
    throw lastError;
};


/* ============================================================================
 * MÉTODOS PÚBLICOS - INVENTÁRIO
 * ============================================================================ */

/**
 * Salva um lote de códigos no backend
 * @param {SaveCodeBatchPayload[]} batch - Lote de itens para salvar
 * @returns {Promise<string[]>} Array de UIDs salvos com sucesso
 * @public
 */
BackendService.prototype.saveCodeBatch = function (batch) {
    return this._callBackend('saveCodeBatch', batch);
};

/**
 * Obtém o resumo do inventário
 * @param {string|null} location - Localização específica (opcional)
 * @returns {Promise<InventorySummaryResponse>} Resumo do inventário
 * @public
 */
BackendService.prototype.getInventorySummary = function (location = null) {
    return this._callBackend('getInventorySummary', location);
};

/**
 * Obtém itens não encontrados para uma localização
 * @param {string} location - Localização para buscar
 * @returns {Promise<Array>} Array de itens não encontrados
 * @public
 */
BackendService.prototype.getNotFoundItens = function (location) {
    return this._callBackend('getNotFoundItens', location);
};

/**
 * Salva uma mensagem/observação no backend
 * @param {MessagePayload} message - Dados da mensagem
 * @returns {Promise<string>} UID da mensagem salva
 * @public
 */
BackendService.prototype.saveMessage = function (message) {
    return this._callBackend('saveMessage', message);
};

/**
 * Busca as configurações do aplicativo
 * @returns {Promise<Object>} Configurações do aplicativo
 * @public
 */
BackendService.prototype.getAppSettings = function () {
    return this._callBackend('getAppSettings', {});
};


/* ============================================================================
 * MÉTODOS PÚBLICOS - DADOS MESTRE
 * ============================================================================ */

/**
 * Obtém dados do inventário (localizações e ativos)
 * @param {BackendCallOptions} options - Opções da chamada
 * @returns {Promise<Object>} Dados completos do inventário
 * @public
 */
BackendService.prototype.getInventoryData = function () {
    return this._callBackend('getInventoryData', true);
};

/* ============================================================================
 * UTILITÁRIOS E ESTATÍSTICAS
 * ============================================================================ */

/**
 * Retorna estatísticas de uso do serviço
 * @returns {Object} Estatísticas das chamadas
 * @public
 */
BackendService.prototype.getStats = function () {
    return { ...this.callStats };
};

/**
 * Reseta as estatísticas do serviço
 * @public
 */
BackendService.prototype.resetStats = function () {
    this.callStats = {
        total: 0,
        success: 0,
        failure: 0,
        pending: 0
    };
};

/**
 * Verifica a conectividade com o backend
 * @returns {Promise<boolean>} true se o backend está acessível
 * @public
 */
BackendService.prototype.checkConnectivity = async function () {
    // Se acesso já foi negado, não tenta mais
    if (this.accessDenied) return false;

    try {
        // Força refresh para não pegar cache — testa conectividade REAL
        await this._callBackend('getAppSettings', { _forceRefresh: true });
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Simula uma chamada para testes (usado em desenvolvimento)
 * @param {string} functionName - Nome da função
 * @param {*} mockData - Dados mockados
 * @param {number} delay - Delay em ms para simular latency
 * @returns {Promise<any>} Dados mockados
 * @public
 */
BackendService.prototype.mockCall = function (functionName, mockData, delay = 500) {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Mock call: ${functionName}`, mockData);
            resolve(mockData);
        }, delay);
    });
};

/**
 * Instância singleton do BackendService
 * @type {BackendService}
 */
export const backendService = new BackendService();

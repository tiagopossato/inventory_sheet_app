/**
 * MÓDULO: mockGAS
 * Substitui o ambiente do Google Apps Script quando não detectado
 * Agora suporta configuração de host personalizado
 */

// Verifica se está no ambiente GAS real
const isGAS = typeof google !== 'undefined' && google.script && google.script.run;

// Configuração do servidor local
const SERVER_HOST = window.MOCK_GAS_HOST || window.location.hostname;
const SERVER_PORT = window.MOCK_GAS_PORT || 3000;
const SERVER_URL = `https://${SERVER_HOST}:${SERVER_PORT}`;

if (!isGAS) {
    console.log(`🔧 Ambiente de desenvolvimento detectado. Redirecionando para ${SERVER_URL}`);

    // Factory function para criar uma nova instância do google.script.run para cada chamada
    function createGoogleScriptRun() {
        return {
            _successHandler: null,
            _failureHandler: null,

            withSuccessHandler: function (callback) {
                this._successHandler = callback;
                return this;
            },

            withFailureHandler: function (callback) {
                this._failureHandler = callback;
                return this;
            },

            getInventoryData: function () {
                return this._httpCall('GET', '/api/inventory-data', 'getInventoryData');
            },

            getInventorySummary: function (targetLocation = null) {
                const params = targetLocation ? `?location=${encodeURIComponent(targetLocation)}` : '';
                return this._httpCall('GET', `/api/inventory-summary${params}`, 'getInventorySummary');
            },

            getNotFoundItens: function (targetLocation) {
                if (!targetLocation) {
                    return this._fail('getNotFoundItens', new Error('targetLocation é obrigatório'));
                }
                return this._httpCall('GET', `/api/not-found-items?location=${encodeURIComponent(targetLocation)}`, 'getNotFoundItens');
            },

            getAppSettings: function () {
                return this._httpCall('GET', '/api/app-settings', 'getAppSettings');
            },

            saveCodeBatch: function (items) {
                return this._httpCall('POST', '/api/save-batch', 'saveCodeBatch', { items });
            },

            saveMessage: function (payload) {
                if (typeof payload === 'object') {
                    return this._httpCall('POST', '/api/save-message', 'saveMessage', payload);
                } else {
                    return this._httpCall('POST', '/api/save-message', 'saveMessage', {
                        uid: payload,
                        location: arguments[1],
                        message: arguments[2]
                    });
                }
            },

            // Método interno para fazer chamadas HTTP
            _httpCall: function (method, endpoint, functionName, data = null) {
                const url = `${SERVER_URL}${endpoint}`;

                //console.log(`🌐 [MockGAS] ${functionName}: ${method} ${url}`, data);

                // Salva os handlers localmente (evita conflito entre chamadas simultâneas)
                const successHandler = this._successHandler;
                const failureHandler = this._failureHandler;

                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                    }
                };

                if (data && method === 'POST') {
                    options.body = JSON.stringify(data);
                }

                // Faz a chamada fetch
                fetch(url, options)
                    .then(async response => {
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`HTTP ${response.status}: ${errorText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        //console.log(`✅ [MockGAS] ${functionName}: Sucesso`, data);
                        if (successHandler) {
                            successHandler(data);
                        }
                    })
                    .catch(error => {
                        console.error(`❌ [MockGAS] ${functionName}: Erro`, error);
                        if (failureHandler) {
                            failureHandler(error);
                        }
                    });

                return this; // Para permitir chaining
            },

            _fail: function (functionName, error) {
                console.error(`❌ [MockGAS] ${functionName}: Erro simulado`, error);
                setTimeout(() => {
                    if (this._failureHandler) {
                        this._failureHandler(error);
                    }
                }, 0);
                return this;
            }
        };
    }

    // Substitui o google.script.run por uma factory que cria nova instância a cada acesso
    window.google = {
        script: {
            get run() {
                // Retorna uma NOVA instância cada vez que .run é acessado
                return createGoogleScriptRun();
            }
        }
    };

    console.log(`✅ Mock GAS configurado para ${SERVER_URL}`);
} else {
    console.log('✅ Ambiente GAS real detectado - usando google.script.run normal');
}

/**
 * Função para configurar o host do servidor manualmente
 */
export function setMockServerHost(host, port = 3000) {
    if (!isGAS) {
        window.MOCK_GAS_HOST = host;
        window.MOCK_GAS_PORT = port;
        console.log(`🔧 Mock GAS reconfigurado para: http://${host}:${port}`);
    }
}

/**
 * Função auxiliar para facilitar o uso do mock
 */
export function initMockGAS(host = null, port = 3000) {
    if (host) {
        setMockServerHost(host, port);
    }

    if (!isGAS) {
        console.log(`🔧 MockGAS: Conectando a http://${window.MOCK_GAS_HOST || 'localhost'}:${window.MOCK_GAS_PORT || 3000}`);
    }
}

// Inicialização automática quando o módulo é carregado
initMockGAS();

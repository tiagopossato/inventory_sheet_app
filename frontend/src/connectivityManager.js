/**
 * @fileoverview ConnectivityManager - Módulo de Gerenciamento de Status de Conexão
 * 
 * Monitora o status da conectividade da rede e gerencia notificações de interface.
 * Detecta transições online/offline e atualiza a UI correspondente.
 * 
 * @module ConnectivityManager
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} ConnectivityConfig
 * @property {string} bannerId - ID do elemento banner de offline
 * @property {boolean} isOnline - Status atual da conectividade
 */

/**
 * Classe principal do módulo ConnectivityManager
 * @class
 * @public
 */
function ConnectivityManager() {
    /**
     * ID do elemento HTML do banner de offline
     * @type {string}
     * @private
     */
    this.bannerId = 'offlineBanner';

    /**
     * Status atual da conectividade
     * @type {boolean}
     * @public
     */
    this.isOnline = navigator.onLine;

    // Bind de métodos para manter o contexto
    this.updateStatus = this.updateStatus.bind(this);
    this.init = this.init.bind(this);

    this.init();
}

/**
 * Configura os listeners de eventos de rede e inicializa a UI
 * @public
 */
ConnectivityManager.prototype.init = function () {
    /**
     * Evento disparado quando a conexão é restaurada
     * @event online
     */
    window.addEventListener('online', this.updateStatus);

    /**
     * Evento disparado quando a conexão é perdida
     * @event offline
     */
    window.addEventListener('offline', this.updateStatus);

    // Executa a verificação inicial após o carregamento do DOM
    if (document.readyState === 'complete') {
        this.updateStatus();
    } else {
        /**
         * Evento disparado quando a página termina de carregar
         * @event load
         */
        window.addEventListener('load', this.updateStatus);
    }
};

/**
 * Atualiza a interface baseada no status de conectividade e dispara eventos
 * @public
 */
ConnectivityManager.prototype.updateStatus = function () {
    this.isOnline = navigator.onLine;
    const banner = document.getElementById(this.bannerId);

    // Atualiza a exibição do banner de offline
    if (banner) {
        banner.style.display = this.isOnline ? 'none' : 'block';
    }

    // Logs informativos para debugging
    if (!this.isOnline) {
        console.warn("🔌 Dispositivo entrou em modo OFFLINE.");
        /**
         * Evento customizado para notificar outros módulos sobre mudança de status
         * @event connectivityStatusChanged
         * @property {boolean} online - Novo status de conectividade
         */
        window.dispatchEvent(new CustomEvent('connectivityStatusChanged', {
            detail: { online: false }
        }));
    } else {
        console.log("🌐 Dispositivo está ONLINE.");
        window.dispatchEvent(new CustomEvent('connectivityStatusChanged', {
            detail: { online: true }
        }));
    }
};

/**
 * Instância singleton do ConnectivityManager
 * @type {ConnectivityManager}
 */
export const connectivityManager = new ConnectivityManager();

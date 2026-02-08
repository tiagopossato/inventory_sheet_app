/**
 * @fileoverview BarcodeScanner - Módulo para Leitura de Códigos de Barras via OTG/Teclado
 *
 * Gerencia a captura de códigos de barras a partir de leitores OTG conectados via USB
 * Dispara eventos unificados compatíveis com o ScannerManager.
 *
 * @module BarcodeScanner
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} BarcodeScannerConfig
 * @property {number} scanDelay - Delay para detectar fim da leitura (ms)
 * @property {number} minLength - Comprimento mínimo do código para considerar válido
 */

/**
 * @typedef {Object} BarcodeScannerState
 * @property {boolean} isEnabled - Scanner ativo/inativo
 * @property {boolean} isLocked - Bloqueado externamente
 * @property {string} buffer - Buffer de caracteres acumulados
 * @property {number} scanCount - Contador de escaneamentos válidos
 */

/**
 * Função construtora do módulo BarcodeScanner
 * @param {Object} config - Configuração do scanner
 * @public
 */
function BarcodeScanner(config = {}) {
    // Validação de configuração
    if (typeof config !== 'object') {
        throw new TypeError('Configuração inválida: esperado um objeto');
    }

    /**
     * Configuração do scanner
     * @type {BarcodeScannerConfig}
     * @private
     */
    this.config = {
        scanDelay: Math.max(0, config.scanDelay || 100),
        minLength: Math.max(1, config.minLength || 8),
    };

    /**
     * Estado interno do scanner
     * @type {BarcodeScannerState}
     * @private
     */
    this.state = {
        isEnabled: false,
        isLocked: false,
        buffer: '',
        timeoutId: null,
        lastScanTime: 0,
        scanCount: 0 // Contador de escaneamentos válidos
    };

    this.init();
}

/**
 * Inicializa o scanner e configura os listeners
 * @private
 */
BarcodeScanner.prototype.init = function () {
    this.bindEvents();
    this.enable();
    console.log('🔌 BarcodeScanner OTG inicializado');
};

/**
 * Configura os event listeners para captura de teclas
 * @private
 */
BarcodeScanner.prototype.bindEvents = function () {
    // Remove event listeners anteriores para evitar duplicação
    document.removeEventListener('keydown', this._handleKeyDownBound);

    // Bind do handler para preservar contexto
    this._handleKeyDownBound = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this._handleKeyDownBound);
};

/**
 * Manipula eventos de teclado para captura de códigos
 * @param {KeyboardEvent} event - Evento de tecla pressionada
 * @private
 */
BarcodeScanner.prototype.handleKeyDown = function (event) {
    // Se desabilitado ou bloqueado, ignora
    if (!this.state.isEnabled || this.state.isLocked) return;

    // Se o foco está em campo de entrada, ignora (deixa o usuário digitar)
    if (this.isInputFieldFocused()) return;

    // Previne comportamento padrão para teclas de caractere e Enter
    if (event.key.length === 1 || event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
    }

    // Clear timeout anterior
    if (this.state.timeoutId) {
        clearTimeout(this.state.timeoutId);
        this.state.timeoutId = null;
    }

    if (event.key === 'Enter') {
        // Finaliza a leitura com Enter
        this.finishScan();
    } else if (event.key.length === 1) {
        // Caractere normal - adiciona ao buffer
        this.state.buffer += event.key;
        // Configura timeout para detecção automática do fim
        this.state.timeoutId = setTimeout(() => {
            this.finishScan();
        }, this.config.scanDelay);
    }
};

/**
 * Finaliza o processo de escaneamento e processa o código
 * @private
 */
BarcodeScanner.prototype.finishScan = function () {
    const code = this.state.buffer.trim();

    console.log(`Digitado: ${code}`);

    if (code.length >= this.config.minLength) {
        /**
         * Evento disparado quando um código é escaneado com sucesso
         * @event codeScanned
         * @property {string} code - Código escaneado
         * @property {string} source - Fonte da leitura ('otg')
         */
        window.dispatchEvent(new CustomEvent('codeScanned', {
            detail: {
                code: code,
                source: 'otg'
            }
        }));

        this.state.lastScanTime = Date.now();
        this.state.scanCount++; // Incrementa contador de escaneamentos válidos
    }

    this.resetBuffer();
};

/**
 * Verifica se o foco está em campo de entrada
 * @returns {boolean} True se em input/textarea
 * @private
 */
BarcodeScanner.prototype.isInputFieldFocused = function () {
    const active = document.activeElement;
    return active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable
    );
};

/**
 * Reseta o buffer de escaneamento
 * @private
 */
BarcodeScanner.prototype.resetBuffer = function () {
    this.state.buffer = '';
    if (this.state.timeoutId) {
        clearTimeout(this.state.timeoutId);
        this.state.timeoutId = null;
    }
};

/**
 * Habilita o scanner OTG
 * @public
 */
BarcodeScanner.prototype.enable = function () {
    this.state.isEnabled = true;
    this.state.isLocked = false;
    this.resetBuffer();
    console.log('🔊 BarcodeScanner habilitado');
};

/**
 * Desabilita o scanner OTG
 * @public
 */
BarcodeScanner.prototype.disable = function () {
    this.state.isEnabled = false;
    this.resetBuffer();
    console.log('🔇 BarcodeScanner desabilitado');
};

/**
 * Bloqueia temporariamente o scanner (para modais)
 * @public
 */
BarcodeScanner.prototype.lock = function () {
    this.state.isLocked = true;
    this.resetBuffer();
    console.log('🔒 BarcodeScanner bloqueado');
};

/**
 * Desbloqueia o scanner
 * @public
 */
BarcodeScanner.prototype.unlock = function () {
    this.state.isLocked = false;
    console.log('🔓 BarcodeScanner desbloqueado');
};

/**
 * Destrói o scanner e remove listeners
 * @public
 */
BarcodeScanner.prototype.destroy = function () {
    document.removeEventListener('keydown', this._handleKeyDownBound);
    this.resetBuffer();
    console.log('🗑️ BarcodeScanner destruído');
};

/**
 * Instância singleton do BarcodeScanner
 * @type {BarcodeScanner}
 */
export const barcodeScanner = new BarcodeScanner({
    scanDelay: 500,       // 150ms entre caracteres
    minLength: 8         // Mínimo 8 caracteres
});
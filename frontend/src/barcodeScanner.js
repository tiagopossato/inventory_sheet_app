/**
 * @fileoverview BarcodeScanner - Módulo de Scanner via Emulação de Teclado (OTG/Bluetooth)
 *
 * Captura leituras de código de barras enviadas através de simulação de teclado,
 * diferenciando a velocidade de digitação humana da velocidade de um leitor a laser.
 *
 * @module BarcodeScanner
 * @version 1.0.0
 */

/**
 * Classe principal do módulo BarcodeScanner
 * @class
 */
function BarcodeScanner() {
    /**
     * Buffer para armazenar os caracteres digitados
     * @type {string}
     * @private
     */
    this.buffer = "";

    /**
     * Tempo do último caractere digitado
     * @type {number}
     * @private
     */
    this.lastKeyTime = Date.now();

    /**
     * Flag de controle para saber se o ouvinte está ativo
     * @type {boolean}
     * @private
     */
    this.isListening = false;

    // Faz o bind do método para garantir que 'this' aponte para a instância correta
    this._handleKeyDown = this._handleKeyDown.bind(this);
}

/**
 * Inicia a escuta global do teclado para capturar códigos
 * @public
 */
BarcodeScanner.prototype.start = function () {
    if (!this.isListening) {
        window.addEventListener('keydown', this._handleKeyDown);
        this.isListening = true;
    }
};

/**
 * Para a escuta global do teclado
 * @public
 */
BarcodeScanner.prototype.stop = function () {
    if (this.isListening) {
        window.removeEventListener('keydown', this._handleKeyDown);
        this.isListening = false;
    }
};

/**
 * Processa as teclas digitadas
 * @param {KeyboardEvent} e - Evento do teclado
 * @private
 */
BarcodeScanner.prototype._handleKeyDown = function (e) {
    const currentTime = Date.now();

    // Se o intervalo entre teclas for maior que 50ms, 
    // provavelmente é um humano digitando, então limpamos o buffer.
    if (currentTime - this.lastKeyTime > 5000) {
        this.buffer = "";
        this.lastKeyTime = currentTime;
    }

    // Ignora teclas de controle (Shift, Alt, CapsLock, etc)
    if (e.key.length > 1 && e.key !== 'Enter') return;

    this.buffer += e.key;
    console.log(`Key: ${e.key}, Time since last key: ${currentTime - this.lastKeyTime}ms, Buffer: "${this.buffer}"`);

    if (this.buffer.length >= 10) { // Evita disparar com um Enter acidental              
        //limpa os caracteres finais do buffer até encontrar um número, para evitar que o Enter seja parte do código
        while (this.buffer.length > 0 && isNaN(this.buffer[this.buffer.length - 1])) {
            this.buffer = this.buffer.slice(0, -1);
        }
        // Dispara o evento personalizado para o resto do sistema
        window.dispatchEvent(new CustomEvent('codeScanned', {
            detail: {
                code: this.buffer,
                source: 'otg'
            }
        }));

        this.buffer = ""; // Limpa para a próxima leitura
    }

    this.lastKeyTime = currentTime;
};

/**
 * Instância singleton do BarcodeScanner
 * @type {BarcodeScanner}
 */
export const barcodeScanner = new BarcodeScanner();
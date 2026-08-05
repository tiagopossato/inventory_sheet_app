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
        console.log('BarcodeScanner: Ativando escuta do leitor em segundo plano.');
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
        console.log('BarcodeScanner: Desativando escuta do leitor em segundo plano.');
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
    if (currentTime - this.lastKeyTime > 50) {
        this.buffer = "";
    }

    this.lastKeyTime = currentTime;

    // Enter: finaliza a leitura e dispara o evento
    if (e.key === 'Enter') {
        // Remove caracteres não numéricos do final (ex: caracteres de controle)
        while (this.buffer.length > 0 && isNaN(this.buffer[this.buffer.length - 1])) {
            this.buffer = this.buffer.slice(0, -1);
        }

        // Mínimo de 5 caracteres para considerar um scan válido
        // Evita falsos positivos de digitação humana + Enter acidental
        if (this.buffer.length >= 5) {
            // Bloqueia o Enter de chegar ao campo de texto manual
            e.preventDefault();
            e.stopPropagation();

            // Limpa o campo de texto manual (remove o 1º caractere que escapou)
            const manualInput = document.getElementById('manualBarcode');
            if (manualInput) {
                manualInput.value = '';
            }

            window.dispatchEvent(new CustomEvent('codeScanned', {
                detail: {
                    code: this.buffer,
                    source: 'otg'
                }
            }));
        }

        this.buffer = "";
        return;
    }

    // Ignora teclas de controle (Shift, Alt, CapsLock, etc)
    if (e.key.length > 1) return;

    // Se o buffer já tem conteúdo, o caractere anterior chegou há < 50ms
    // → estamos num burst de scanner → bloqueia o caractere do input focado
    if (this.buffer.length > 0) {
        e.preventDefault();
    }

    this.buffer += e.key;
};

/**
 * Instância singleton do BarcodeScanner
 * @type {BarcodeScanner}
 */
export const barcodeScanner = new BarcodeScanner();
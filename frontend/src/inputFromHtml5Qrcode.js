/**
 * @fileoverview InputFromHtml5Qrcode - Módulo de Scanner usando biblioteca Html5Qrcode
 *
 * Implementa a interface de scanner de códigos de barras utilizando a biblioteca Html5Qrcode.
 * Fornece controles de câmera, flash e processamento de leituras.
 *
 * @module InputFromHtml5Qrcode
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * Classe principal do módulo InputFromHtml5Qrcode
 * @class
 */
export function InputFromHtml5Qrcode() {
    /**
     * Instância do scanner Html5Qrcode
     * @type {Html5Qrcode|null}
     * @private
     */
    this.html5QrCode = null;

    /**
     * Estado da câmera
     * @type {boolean}
     * @private
     */
    this.isCameraOn = false;

    /**
     * Indica se pode escanear
     * @type {boolean}
     * @private
     */
    this.canScan = true;

    /**
     * Callback para sucesso no escaneamento
     * @type {Function|null}
     * @private
     */
    this.onScanCallback = null;
}

/**
 * Inicializa o scanner com o callback de sucesso
 * @param {Function} onScanSuccess - Callback chamado quando um código é escaneado
 * @public
 */
InputFromHtml5Qrcode.prototype.init = function (onScanSuccess) {
    this.onScanCallback = onScanSuccess;
};

/**
 * Inicia a câmera
 * @async
 * @public
 */
InputFromHtml5Qrcode.prototype.startCamera = async function () {
    // @ts-ignore
    this.html5QrCode = new Html5Qrcode("reader");

    await this.html5QrCode.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: { width: 300, height: 100 },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: "environment",
                width: { min: 1280, ideal: 1920 },
                height: { min: 720, ideal: 1080 },
                advanced: [{ focusMode: "continuous" }]
            }
        },
        (txt) => this._onScanSuccess(txt)
    );

    this.isCameraOn = true;
    this.canScan = true;
};

/**
 * Para a câmera
 * @async
 * @public
 */
InputFromHtml5Qrcode.prototype.stopCamera = async function () {
    if (this.html5QrCode) {
        try {
            await this.html5QrCode.stop();
            this.html5QrCode = null;
        } catch (err) {
            console.warn(err);
        }
    }
    this.isCameraOn = false;
};

/**
 * Processa sucesso do escaneamento
 * @param {string} decodedText - Texto decodificado
 * @private
 */
InputFromHtml5Qrcode.prototype._onScanSuccess = function (decodedText) {
    if (!this.canScan) return;

    this.canScan = false;

    if (this.onScanCallback) {
        this.onScanCallback(decodedText);
    }

    setTimeout(() => {
        this.canScan = true;
    }, 1500);
};

/**
 * Retorna o estado da câmera
 * @returns {boolean}
 * @public
 */
InputFromHtml5Qrcode.prototype.getIsCameraOn = function () {
    return this.isCameraOn;
};

/**
 * Libera o scanner para novas leituras
 * @public
 */
InputFromHtml5Qrcode.prototype.unlock = function () {
    this.canScan = true;
};

/**
 * Bloqueia novas leituras
 * @public
 */
InputFromHtml5Qrcode.prototype.lock = function () {
    this.canScan = false;
};

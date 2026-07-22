/**
 * @fileoverview InputFromQuagga2 - Módulo de Scanner usando biblioteca Quagga2
 *
 * Implementa a interface de scanner de códigos de barras utilizando a biblioteca Quagga2.
 * Fornece controles de câmera, flash e processamento de leituras.
 *
 * @module InputFromQuagga2
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * Classe principal do módulo InputFromQuagga2
 * @class
 * @public
 */
export function InputFromQuagga2() {


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
     * Indica se o Quagga está inicializado
     * @type {boolean}
     * @private
     */
    this._isInitializing = false;
    /**
     * Callback para sucesso no escaneamento
     * @type {Function|null}
     * @private
     */
    this._quaggaInitialized = false;
    this.onScanCallback = null;
    /**
    * Função _onDetected bound
    * @type {Function}
    * @private
    */
    this._onDetectedBound = this._onDetected.bind(this);
}

/**
 * Inicializa o scanner com o callback de sucesso
 * @param {Function} onScanSuccess - Callback chamado quando um código é escaneado
 * @public
 */
InputFromQuagga2.prototype.init = function (onScanSuccess) {
    this.onScanCallback = onScanSuccess;
};

/**
 * Obtém a instância do Quagga do escopo global
 * @returns {Object|null}
 * @private
 */
InputFromQuagga2.prototype._getQuagga = function () {
    if (typeof window !== 'undefined' && window.Quagga) return window.Quagga;
    console.error('Quagga2 não está disponível no escopo global.');
    return null;
};

/**
 * Verifica se a câmera está acessível
 * @async
 * @private
 */
InputFromQuagga2.prototype._checkCameraAccess = async function () {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (err) {
        console.error('Erro ao acessar câmera:', err);
        throw err;
    }
};

/**
 * Inicia a câmera
 * @async
 * @public
 */
InputFromQuagga2.prototype.startCamera = async function () {
    if (this._isInitializing) {
        console.log('[Quagga] Já está inicializando...');
        return;
    }

    const quagga = this._getQuagga();
    if (!quagga) throw new Error('Biblioteca Quagga2 não carregada!');

    const readerEl = document.querySelector('#reader');
    if (!readerEl) throw new Error('Elemento de visualização não encontrado.');

    this._isInitializing = true;
    readerEl.innerHTML = '';

    try {
        await this._checkCameraAccess();

        await new Promise((resolve, reject) => {
            const initConfig = {
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: readerEl,
                    constraints: {
                        facingMode: "environment",
                        width: { min: 1280, ideal: 1920 },
                        height: { min: 720, ideal: 1080 },
                        advanced: [{ focusMode: "continuous" }]
                    },
                },
                frequency: 20,
                locate: true,
                locator: { patchSize: "medium", halfSample: true },
                numOfWorkers: navigator.hardwareConcurrency || 4,
                decoder: { readers: ["code_39_reader"] }
            };

            quagga.init(initConfig, (err) => {
                if (err) {
                    console.error('[Quagga] Erro no init:', err);
                    reject(err);
                    return;
                }
                resolve();
            });
        });

        quagga.start();
        quagga.onDetected(this._onDetectedBound);

        await new Promise((resolve) => {
            let attempts = 0;
            const checkStream = setInterval(() => {
                const video = document.querySelector('#reader video');
                if (video && video.readyState >= 2) {
                    clearInterval(checkStream);
                    resolve();
                }
                attempts++;
                if (attempts > 50) {
                    clearInterval(checkStream);
                    resolve();
                }
            }, 100);
        });

        this._quaggaInitialized = true;
        this.isCameraOn = true;
        this.canScan = true;

    } catch (err) {
        console.error("Erro ao iniciar câmera com Quagga:", err);
        throw err;
    } finally {
        this._isInitializing = false;
    }
};

/**
 * Para a câmera
 * @async
 * @public
 */
InputFromQuagga2.prototype.stopCamera = async function () {
    const quagga = this._getQuagga();
    if (this._quaggaInitialized && quagga) {
        try {
            quagga.offDetected(this._onDetectedBound);
            quagga.stop();
            this._quaggaInitialized = false;
        } catch (err) {
            console.error("Erro ao parar Quagga:", err);
        }
    }
    this._isInitializing = false;
    this.isCameraOn = false;
};

/**
 * Processa sucesso do escaneamento
 * @param {Object} result - Resultado da detecção
 * @private
 */
InputFromQuagga2.prototype._onDetected = function (result) {
    if (!this.canScan) return;
    const decodedText = result && result.codeResult ? result.codeResult.code : null;
    if (!decodedText || typeof decodedText !== 'string' || decodedText.trim() === '') return;

    const cleanCode = decodedText.trim();
    this.canScan = false;

    if (this.onScanCallback) {
        this.onScanCallback(cleanCode);
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
InputFromQuagga2.prototype.getIsCameraOn = function () { return this.isCameraOn; };

/**
 * Libera o scanner para novas leituras
 * @public
 */
InputFromQuagga2.prototype.unlock = function () { this.canScan = true; };
/**
 * Bloqueia novas leituras
 * @public
 */
InputFromQuagga2.prototype.lock = function () { this.canScan = false; };

/**
* Função de diagnóstico para debug
* @public
*/
InputFromQuagga2.prototype.diagnose = function () {
    console.log('=== Diagnóstico InputFromQuagga2 ===');
    console.log('isCameraOn:', this.isCameraOn);
    console.log('canScan:', this.canScan);
    console.log('_isInitializing:', this._isInitializing);
    console.log('_quaggaInitialized:', this._quaggaInitialized);
    console.log('Quagga disponível:', !!window.Quagga);
    console.log('Elemento #reader:', document.querySelector('#reader'));
    const video = document.querySelector('#reader video');
    console.log('Vídeo:', video);
    if (video) {
        console.log('  - readyState:', video.readyState);
        console.log('  - paused:', video.paused);
        console.log('  - srcObject:', video.srcObject ? 'presente' : 'ausente');
    }
    console.log('=========================================');
}

/**
 * @fileoverview InputArea - Módulo de Gerenciamento de Área de Scanner
 *
 * Gerencia a interface e funcionalidades de escaneamento de códigos de barras.
 * Fornece controles de flash, bloqueio e validações de localização.
 * Permite alternar entre as bibliotecas Html5Qrcode e Quagga2.
 *
 * @module InputArea
 * @version 1.0.0
 * @author Tiago Possato
 */

import { locationSelector } from './locationSelector.js';
import { userWarnings } from './userWarnings.js';
import { InputFromHtml5Qrcode } from './inputFromHtml5Qrcode.js';
import { InputFromQuagga2 } from './inputFromQuagga2.js';

/**
 * Tipos de scanner disponíveis
 * @enum {string}
 */
export const ScannerType = {
    HTML5QRCODE: 'html5qrcode',
    QUAGGA2: 'quagga2'
};

/**
 * Classe principal do módulo InputArea
 * @class
 */
export function InputArea() {
    /**
     * Scanner atual (Html5Qrcode ou Quagga2)
     * @type {InputFromHtml5Qrcode|InputFromQuagga2|null}
     * @private
     */
    this.currentScanner = null;

    /**
     * Tipo do scanner atual
     * @type {ScannerType}
     * @private
     */
    this.currentScannerType = ScannerType.HTML5QRCODE;

    /**
     * Estado do bloqueio externo
     * @type {boolean}
     * @private
     */
    this.isLockedExternal = false;

    /**
     * Input manual de código de barras
     * @type {HTMLElement|null}
     * @private
     */
    this.manualBarcodeInput = null;

    /**
     * Inicializa o módulo
     * @private
     */
    this.init();
}

/**
 * Inicializa a interface HTML e configura os eventos
 * @private
 */
InputArea.prototype.init = function() {
    const container = document.querySelector('#scanner-area');
    if (!container) return;

    container.innerHTML = `
        <div id="videoArea">
            <div id="reader"></div>
            <div id="cameraPlaceholder">Câmera Desligada</div>
            <div id="scanDelayOverlay">Processado!</div>
        </div>

        <div class="control-row">
            <button id="toggleFlash" class="btn btn-gray">⚡ Flash</button>
            <button id="toggleCamera" class="btn btn-primary">📷 Ligar Câmera</button>
            <button id="switchScanner" class="btn btn-gray">🔄 Alternar Scanner</button>
        </div>

        <div class="control-row">
            <input type="number" id="manualBarcode" placeholder="Código (13 dig)" inputmode="numeric">
            <button id="submitManualBarcode" class="btn btn-gray">Enviar</button>
        </div>
        <div class="control-row">
            <input type="checkbox" id="bypassCheckLocation" name="bypassCheckLocation" value="bypassCheckLocation">
            <label for="bypassCheckLocation"> Ignorar verificação de localização?</label><br>
        </div>
    `;

    // Bind de eventos
    document.getElementById('toggleCamera').addEventListener('click', () => this.handleCameraAction());
    document.getElementById('toggleFlash').addEventListener('click', () => this.toggleFlash());
    document.getElementById('switchScanner').addEventListener('click', () => this.switchScanner());

    this.manualBarcodeInput = document.getElementById('manualBarcode');
    this._setupManualInput();
    this.hide();

    // Inicializa o scanner atual
    this._initializeCurrentScanner();
};

/**
 * Inicializa o scanner atual
 * @private
 */
InputArea.prototype._initializeCurrentScanner = function() {
    if (this.currentScannerType === ScannerType.HTML5QRCODE) {
        this.currentScanner = new InputFromHtml5Qrcode();
    } else {
        this.currentScanner = new InputFromQuagga2();
    }
    this.currentScanner.init((code) => this._onScanSuccess(code));
};

/**
 * Alterna entre as bibliotecas de scanner
 * @public
 */
InputArea.prototype.switchScanner = async function() {
    // Para o scanner atual se estiver rodando
    if (this.currentScanner && this.currentScanner.getIsCameraOn()) {
        await this.stopScanner();
    }

    // Alterna o tipo
    this.currentScannerType = this.currentScannerType === ScannerType.HTML5QRCODE
        ? ScannerType.QUAGGA2
        : ScannerType.HTML5QRCODE;

    // Recria o scanner
    this._initializeCurrentScanner();

    // Atualiza o placeholder para mostrar qual scanner está ativo
    const placeholder = document.getElementById('cameraPlaceholder');
    if (placeholder) {
        placeholder.innerText = `Scanner: ${this.currentScannerType === ScannerType.HTML5QRCODE ? 'Html5Qrcode' : 'Quagga2'}`;
    }
    setTimeout(() => {
        this.startCamera();
    }, 500);

    console.log(`[InputArea] Scanner alternado para: ${this.currentScannerType}`);
};

/**
 * Configura a entrada manual de códigos de barras
 * @private
 */
InputArea.prototype._setupManualInput = function() {
    const btn = document.getElementById('submitManualBarcode');

    btn.addEventListener('click', () => {
        const cleanValue = (this.manualBarcodeInput.value || "").trim();
        if (cleanValue === "") {
            this.setFocus();
            return;
        }

        btn.disabled = true;
        setTimeout(() => { btn.disabled = false; }, 500);

        window.dispatchEvent(new CustomEvent('codeScanned', {
            detail: {
                code: cleanValue,
                source: 'manual_input'
            }
        }));

        this.manualBarcodeInput.value = "";
    });
};

/**
 * Foca no input manual
 * @public
 */
InputArea.prototype.setFocus = function() {
    if (this.manualBarcodeInput) {
        this.manualBarcodeInput.disabled = false;
        this.manualBarcodeInput.value = "";
        this.manualBarcodeInput.focus();
    }
};

/**
 * Exibe a interface do scanner
 * @public
 */
InputArea.prototype.show = function() {
    const el = document.querySelector('#scanner-area');
    if (el) el.style.display = 'block';
    this.isCameraOn = false;
    this.handleCameraAction();
};

/**
 * Oculta a interface do scanner
 * @public
 */
InputArea.prototype.hide = function() {
    const el = document.querySelector('#scanner-area');
    if (el) el.style.display = 'none';
};

/**
 * Bloqueia novas leituras (útil para quando um modal está aberto)
 * @public
 */
InputArea.prototype.lock = function() {
    this.isLockedExternal = true;
    if (this.currentScanner) {
        this.currentScanner.lock();
    }
    const overlay = document.getElementById('scanDelayOverlay');
    if (overlay) overlay.style.display = 'none';
};

/**
 * Libera o scanner para novas leituras
 * @public
 */
InputArea.prototype.unlock = function() {
    this.isLockedExternal = false;
    if (this.currentScanner) {
        this.currentScanner.unlock();
    }
};

/**
 * Gerencia a ação de ligar/desligar a câmera
 * @private
 */
InputArea.prototype.handleCameraAction = async function() {
    if (!this.currentScanner.getIsCameraOn()) {
        this.startCamera();
    } else {
        await this.stopScanner();
    }
};

/**
 * Inicia a câmera baseada no scanner selecionado
 * @async
 * @public
 */
InputArea.prototype.startCamera = async function() {
    const btn = document.getElementById('toggleCamera');
    const placeholder = document.getElementById('cameraPlaceholder');

    if (locationSelector.getSelectedLocation() === locationSelector.NONE_SELECTED) {
        userWarnings.printUserWarning("Selecione uma localização antes de iniciar as leituras!");
        return;
    }

    try {
        await this.currentScanner.startCamera();

        if (placeholder) placeholder.style.display = 'none';
        if (btn) {
            btn.innerText = '🚫 Desligar Câmera';
            btn.classList.replace('btn-primary', 'btn-danger');
        }

        // Verifica flash após pequeno delay
        setTimeout(() => {
            this._checkFlashSupport();
        }, 500);

    } catch (err) {
        console.error("Erro ao iniciar câmera:", err);
        let errorMsg = 'Erro ao iniciar câmera';

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMsg = 'Permissão de câmera negada. Permita o acesso à câmera nas configurações do navegador.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMsg = 'Nenhuma câmera encontrada no dispositivo.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMsg = 'Câmera já está em uso. Feche outros aplicativos que estejam usando a câmera.';
        } else if (err.message) {
            errorMsg += ': ' + err.message;
        }

        userWarnings.printUserWarning(errorMsg);
        if (placeholder) {
            placeholder.style.display = 'block';
            placeholder.innerText = 'Erro ao iniciar câmera';
        }
        if (btn) {
            btn.disabled = false;
            btn.innerText = '📷 Ligar Câmera';
            btn.classList.replace('btn-danger', 'btn-primary');
        }
    }
};

/**
 * Verifica se a câmera suporta flash e atualiza a UI
 * @private
 */
InputArea.prototype._checkFlashSupport = function() {
    const flashBtn = document.getElementById('toggleFlash');
    if (!flashBtn) return;

    try {
        const video = document.querySelector('#reader video');
        if (!video || !video.srcObject) {
            flashBtn.style.display = 'none';
            return;
        }

        const track = video.srcObject.getVideoTracks()[0];
        if (!track || !track.getCapabilities) {
            flashBtn.style.display = 'none';
            return;
        }

        const caps = track.getCapabilities();
        if (caps.torch || caps.flash) {
            flashBtn.style.display = 'block';
        } else {
            flashBtn.style.display = 'none';
        }
    } catch (err) {
        console.warn("Erro ao verificar suporte a flash:", err);
        if (flashBtn) flashBtn.style.display = 'none';
    }
};

/**
 * Para o scanner e desliga a câmera
 * @private
 */
InputArea.prototype.stopScanner = async function() {
    const btn = document.getElementById('toggleCamera');
    const placeholder = document.getElementById('cameraPlaceholder');
    const flashBtn = document.getElementById('toggleFlash');

    if (this.currentScanner) {
        await this.currentScanner.stopCamera();
    }

    if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerText = 'Câmera Desligada';
    }
    if (flashBtn) flashBtn.style.display = 'none';
    if (btn) {
        btn.innerText = '📷 Ligar Câmera';
        btn.classList.replace('btn-danger', 'btn-primary');
    }
};

/**
 * Alterna o flash da câmera (se suportado)
 * @private
 */
InputArea.prototype.toggleFlash = async function() {
    if (!this.currentScanner || !this.currentScanner.getIsCameraOn()) return;

    try {
        const video = document.querySelector('#reader video');
        if (!video || !video.srcObject) return;

        const track = video.srcObject.getVideoTracks()[0];
        if (!track) return;

        const settings = track.getSettings();
        const isFlashNow = !!(settings.torch || settings.flash);

        await track.applyConstraints({
            advanced: [{ torch: !isFlashNow }]
        });

    } catch (err) {
        console.warn("Erro ao alternar flash:", err);
        userWarnings.printUserWarning("Flash não suportado neste dispositivo");
    }
};

/**
 * Manipula o sucesso do escaneamento
 * @param {string} decodedText - Texto decodificado do código escaneado
 * @private
 */
InputArea.prototype._onScanSuccess = function(decodedText) {
    if (this.isLockedExternal) return;

    // A UI é controlada APENAS pela classe InputArea
    const overlay = document.getElementById('scanDelayOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.innerText = "Processando...";
    }

    window.dispatchEvent(new CustomEvent('codeScanned', {
        detail: { code: decodedText, source: 'camera' }
    }));

    setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
    }, 1500);
};

/**
 * Retorna o tipo de scanner atual
 * @returns {ScannerType}
 * @public
 */
InputArea.prototype.getCurrentScannerType = function() {
    return this.currentScannerType;
};

/**
 * Retorna se a câmera está ligada
 * @returns {boolean}
 * @public
 */
InputArea.prototype.getIsCameraOn = function() {
    return this.currentScanner ? this.currentScanner.getIsCameraOn() : false;
};

/**
 * Função de diagnóstico para debug
 * @public
 */
InputArea.prototype.diagnose = function() {
    console.log('=== Diagnóstico InputArea ===');
    console.log('Scanner atual:', this.currentScannerType);
    console.log('isLockedExternal:', this.isLockedExternal);
    if (this.currentScanner && typeof this.currentScanner.diagnose === 'function') {
        this.currentScanner.diagnose();
    }
    console.log('=========================================');
};

/**
 * Instância singleton do InputArea
 * @type {InputArea}
 */
export const inputArea = new InputArea();

// Expõe globalmente para debug e acesso do console
if (typeof window !== 'undefined') {
    window.inputArea = inputArea;
}

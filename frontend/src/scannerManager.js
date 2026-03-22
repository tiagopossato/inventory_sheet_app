// /**
//  * @fileoverview ScannerManager - Módulo de Gerenciamento de Scanner de Códigos de Barras
//  * 
//  * Gerencia a interface e funcionalidades de escaneamento tanto por câmera quanto
//  * por entrada manual. Integra com a biblioteca Html5Qrcode e fornece controles
//  * de flash, bloqueio e validações de localização.
//  * 
//  * @module ScannerManager
//  * @version 1.0.0
//  * @author Tiago Possato
//  */

// import { locationSelector } from './locationSelector.js';
// import { userWarnings } from './userWarnings.js';

// /**
//  * @typedef {Object} ScannerConfig
//  * @property {number} scanDelay - Tempo de delay entre escaneamentos em milissegundos
//  */

// /**
//  * @typedef {Object} ScannerState
//  * @property {boolean} isCameraOn - Indica se a câmera está ativa
//  * @property {boolean} canScan - Indica se o scanner está liberado para novas leituras
//  * @property {boolean} isLockedExternal - Indica se está bloqueado externamente (por modals)
//  */

// /**
//  * Classe principal do módulo ScannerManager
//  * @class
//  * @public
//  */
// function ScannerManager() {
//     /**
//      * Instância do scanner Html5Qrcode
//      * @type {Html5Qrcode|null}
//      * @private
//      */
//     this.html5QrCode = null;

//     /**
//      * Estado interno do scanner
//      * @type {ScannerState}
//      * @private
//      */
//     this.isCameraOn = false;
//     this.canScan = true;
//     this.isLockedExternal = false; // Nova flag de controle

//     /**
//      * Inicializa o módulo
//      * @private
//      */
//     this.init();
// }

// /**
//  * Inicializa a interface HTML e configura os eventos
//  * @private
//  */
// ScannerManager.prototype.init = function () {
//     const container = document.querySelector('#scanner-area');
//     if (!container) return;

//     container.innerHTML = `
//         <div id="videoArea">
//             <div id="reader"></div>
//             <div id="cameraPlaceholder">Câmera Desligada</div>
//             <div id="scanDelayOverlay">Processado!</div>
//         </div>

//         <div class="control-row">
//             <button id="toggleFlash" class="btn btn-gray">⚡ Flash</button>
//             <button id="toggleCamera" class="btn btn-primary">📷 Ligar Câmera</button>
//         </div>

//         <div class="control-row">
//             <input type="number" id="manualBarcode" placeholder="Código (13 dig)" inputmode="numeric">
//             <button id="submitManualBarcode" class="btn btn-gray">Enviar</button>
//         </div>
//         <div class="control-row">
//             <input type="checkbox" id="bypassCheckLocation" name="bypassCheckLocation" value="bypassCheckLocation">
//             <label for="bypassCheckLocation"> Ignorar verificação de localização?</label><br>
//         </div>
//     `;

//     // Bind de eventos (usando arrow function para preservar o 'this' da instância)
//     document.getElementById('toggleCamera').addEventListener('click', () => this.handleCameraAction());
//     document.getElementById('toggleFlash').addEventListener('click', () => this.toggleFlash());

//     this.manualBarcodeInput = document.getElementById('manualBarcode');
//     this._setupManualInput();
//     this.hide();
// };

// ScannerManager.prototype.setFocus = function () {
//     this.manualBarcodeInput.disabled = false;
//     this.manualBarcodeInput.value = "";
//     this.manualBarcodeInput.focus();
// }

// /**
//  * Configura a entrada manual de códigos de barras
//  * @private
//  */
// ScannerManager.prototype._setupManualInput = function () {
//     const self = this;
//     const btn = document.getElementById('submitManualBarcode');

//     btn.addEventListener('click', () => {
//         const cleanValue = (self.manualBarcodeInput.value || "").trim();
//         if (cleanValue === "") {
//             self.setFocus();
//             return;
//         }

//         btn.disabled = true;
//         setTimeout(() => { btn.disabled = false; }, 500);

//         /**
//          * Evento global disparado quando um código é escaneado ou inserido manualmente
//          * @event codeScanned
//          * @property {string} code - Código escaneado/inserido
//          */
//         window.dispatchEvent(new CustomEvent('codeScanned', {
//             detail: {
//                 code: cleanValue,
//                 source: 'manual_input'
//             }
//         }));

//         self.manualBarcodeInput.value = "";

//     });
// };

// /**
//  * Exibe a interface do scanner
//  * @public
//  */
// ScannerManager.prototype.show = function () {
//     const el = document.querySelector('#scanner-area');
//     if (el) el.style.display = 'block';
//     this.isCameraOn = false;
//     this.handleCameraAction();
// };

// /**
//  * Oculta a interface do scanner
//  * @public
//  */
// ScannerManager.prototype.hide = function () {
//     const el = document.querySelector('#scanner-area');
//     if (el) el.style.display = 'none';
//     this.isCameraOn = true;
//     this.handleCameraAction();
// };

// /**
//  * Bloqueia novas leituras (útil para quando um modal está aberto)
//  * @public
//  */
// ScannerManager.prototype.lock = function () {
//     this.isLockedExternal = true;
//     this.canScan = false; // Trava imediata
//     const overlay = document.getElementById('scanDelayOverlay');
//     if (overlay) overlay.style.display = 'none';
// };

// /**
//  * Libera o scanner para novas leituras
//  * @public
//  */
// ScannerManager.prototype.unlock = function () {
//     this.isLockedExternal = false;
//     this.canScan = true; // Libera para a próxima
// };

// /**
//  * Gerencia a ação de ligar/desligar a câmera
//  * @private
//  */
// ScannerManager.prototype.handleCameraAction = async function () {
//     const btn = document.getElementById('toggleCamera');
//     const placeholder = document.getElementById('cameraPlaceholder');
//     const flashBtn = document.getElementById('toggleFlash');

//     if (!this.isCameraOn) {
//         if (locationSelector.getSelectedLocation() === locationSelector.NONE_SELECTED) {
//             userWarnings.printUserWarning("Selecione uma localização antes de iniciar as leituras!");
//             return;
//         }

//         // @ts-ignore
//         this.html5QrCode = new Html5Qrcode("reader");

//         try {
//             // await this.html5QrCode.start(
//             //     { facingMode: "environment" },
//             //     { fps: 5, qrbox: { width: 280, height: 125 }, aspectRatio: 1.0 },
//             //     (txt) => this._onScanSuccess(txt)
//             // );
//             await this.html5QrCode.start(
//                 { facingMode: "environment" }, // Mantemos apenas UMA chave aqui!
//                 {
//                     fps: 10,
//                     qrbox: { width: 300, height: 100 },
//                     aspectRatio: 1.0,
//                     // As configurações de resolução e foco vêm para cá:
//                     videoConstraints: {
//                         facingMode: "environment",
//                         width: { min: 1280, ideal: 1920 },
//                         height: { min: 720, ideal: 1080 },
//                         advanced: [{ focusMode: "continuous" }]
//                     }
//                 },
//                 (txt) => this._onScanSuccess(txt)
//             );


//             this.isCameraOn = true;
//             this.canScan = true;
//             placeholder.style.display = 'none';
//             btn.innerText = '🚫 Desligar Câmera';
//             btn.classList.replace('btn-primary', 'btn-danger');

//             this._checkFlashSupport(flashBtn);
//         } catch (err) {
//             console.error("Erro ao iniciar câmera:", err);
//         }
//     } else {
//         await this.stopScanner();
//     }
// };

// /**
//  * Para o scanner e desliga a câmera
//  * @private
//  */
// ScannerManager.prototype.stopScanner = async function () {
//     const btn = document.getElementById('toggleCamera');
//     const placeholder = document.getElementById('cameraPlaceholder');
//     const flashBtn = document.getElementById('toggleFlash');

//     if (this.html5QrCode) {
//         try {
//             await this.html5QrCode.stop();
//             this.html5QrCode = null;
//         } catch (err) { console.warn(err); }
//     }

//     this.isCameraOn = false;
//     placeholder.style.display = 'block';
//     flashBtn.style.display = 'none';
//     btn.innerText = '📷 Ligar Câmera';
//     btn.classList.replace('btn-danger', 'btn-primary');
// };

// /**
//  * Alterna o flash da câmera (se suportado)
//  * @private
//  */
// ScannerManager.prototype.toggleFlash = async function () {
//     if (!this.isCameraOn) return;
//     try {
//         const track = document.querySelector('#reader video').srcObject.getVideoTracks()[0];
//         const isFlashNow = track.getSettings().torch || false;
//         await track.applyConstraints({ advanced: [{ torch: !isFlashNow }] });
//     } catch (err) { console.warn(err); }
// };

// /**
//  * Verifica se a câmera suporta flash e exibe o botão correspondente
//  * @param {HTMLElement} flashBtn - Elemento do botão de flash
//  * @private
//  */
// ScannerManager.prototype._checkFlashSupport = function (flashBtn) {
//     const video = document.querySelector('#reader video');
//     if (video && video.srcObject) {
//         const track = video.srcObject.getVideoTracks()[0];
//         const caps = track.getCapabilities ? track.getCapabilities() : {};
//         if (caps.torch) flashBtn.style.display = 'block';
//     }
// };

// /**
//  * Manipula o sucesso do escaneamento
//  * @param {string} decodedText - Texto decodificado do código escaneado
//  * @private
//  */
// ScannerManager.prototype._onScanSuccess = function (decodedText) {
//     // Se estiver bloqueado por qualquer motivo, ignora totalmente
//     if (!this.canScan || this.isLockedExternal) return;

//     this.canScan = false;

//     const overlay = document.getElementById('scanDelayOverlay');
//     if (overlay) {
//         overlay.style.display = 'flex';
//         overlay.innerText = "Processando...";
//     }

//     window.dispatchEvent(new CustomEvent('codeScanned', {
//         detail: {
//             code: decodedText,
//             source: 'camera'
//         }
//     }));

//     setTimeout(() => {
//         if (overlay) overlay.style.display = 'none';

//         // SÓ libera se o modal não tiver travado o scanner nesse meio tempo
//         if (!this.isLockedExternal) {
//             this.canScan = true;
//         }
//     }, 1500); // tempo do modal abrir
// };

// /**
//  * Instância singleton do ScannerManager
//  * @type {ScannerManager}
//  *
//  *
//  */

// export const scannerManager = new ScannerManager();
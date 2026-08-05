/**
 * @fileoverview InputArea - Módulo de Gerenciamento de Área de Scanner
 *
 * Gerencia a interface e funcionalidades de escaneamento de códigos de barras.
 *
 * @module InputArea
 * @version 2.0.0
 * @author Tiago Possato
 */

import { barcodeScanner } from './barcodeScanner.js';

/**
 * Classe principal do módulo InputArea
 * @class
 */
export function InputArea() {
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
     * Cache de códigos recentemente despachados para evitar double-fire de scanners
     * Mapeia código → timestamp (Date.now())
     * @type {Object<string, number>}
     * @private
     */
    this._recentCodes = {};

    /**
     * Janela de debounce para rejeitar códigos duplicados (em ms)
     * @type {number}
     * @private
     */
    this._debounceWindow = 3000;

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
InputArea.prototype.init = function () {
    const container = document.querySelector('#scanner-area');
    if (!container) {
        console.warn("[InputArea] Contêiner #scanner-area não encontrado no DOM.");
        return;
    }

    container.innerHTML = `
        <div class="control-row">
            <input 
                type="text" 
                id="manualBarcode" 
                name="barcode_no_fill"
                placeholder="Tombamento" 
                inputmode="numeric" 
                pattern="[0-9]*" 
                autocomplete="nope" 
                autocorrect="off" 
                autocapitalize="off"
                spellcheck="false" 
                data-lpignore="true" 
                data-form-type="other"
            >
            <button id="clearManualBarcode" class="btn btn-danger">Limpar</button>
        </div>
    `;
    // TODO: Ao reativar esse trecho, criar um método para recuperar o estado do checkbox de bypass, 
    // sem usar querySelector diretamente no main.js
    //     <div class="control-row">
    //         <input type="checkbox" id="bypassCheckLocation" name="bypassCheckLocation" value="bypassCheckLocation">
    //         <label for="bypassCheckLocation"> Ignorar verificação de localização?</label><br>
    //     </div>
    // `;
    this.manualBarcodeInput = document.getElementById('manualBarcode');
    this._setupManualInput();
    this.hide();
};

/**
 * Configura a entrada manual de códigos de barras e o observador de caracteres
 * @private
 */
InputArea.prototype._setupManualInput = function () {
    const clearBtn = document.getElementById('clearManualBarcode');
    const self = this;

    // Listener keydown: submete o código manualmente ao pressionar Enter
    this.manualBarcodeInput.addEventListener('keydown', function (e) {
        if (self.isLockedExternal) return;

        // Enter: dispara o envio do código digitado manualmente
        if (e.key === 'Enter') {
            const currentValue = e.target.value.trim();

            if (currentValue.length > 0) {
                // Limpa o campo antes de disparar o evento
                self.manualBarcodeInput.value = "";

                // Debounce: rejeita o mesmo código se despachado dentro da janela de 3s
                const now = Date.now();
                const lastTime = self._recentCodes[currentValue];
                if (lastTime && (now - lastTime) < self._debounceWindow) {
                    self._cleanupRecentCodes();
                    return;
                }

                // Registra o código como despachado
                self._recentCodes[currentValue] = now;
                self._cleanupRecentCodes();

                // Dispara o evento de forma assíncrona para não travar a UI
                setTimeout(function () {
                    window.dispatchEvent(new CustomEvent('codeScanned', {
                        detail: {
                            code: currentValue,
                            source: 'manual_input'
                        }
                    }));
                }, 0);
            }
        }
    });

    // Quando o input recebe foco, pausa o barcodeScanner
    // para evitar duplicação: o scanner físico digita direto no campo,
    // e o handler keydown do input já processa a leitura
    this.manualBarcodeInput.addEventListener('focus', function () {
        barcodeScanner.stop();
    });

    // Quando o input perde foco, reativa o barcodeScanner
    // apenas se o inputArea não estiver bloqueado
    this.manualBarcodeInput.addEventListener('blur', function () {
        if (!self.isLockedExternal) {
            barcodeScanner.start();
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            self.manualBarcodeInput.value = "";
            self.setFocus();
        });
    }
};

/**
 * Remove entradas expiradas do cache de códigos recentes
 * para evitar acúmulo de memória
 * @private
 */
InputArea.prototype._cleanupRecentCodes = function () {
    const self = this;
    const now = Date.now();
    Object.keys(self._recentCodes).forEach(function (code) {
        if (now - self._recentCodes[code] > self._debounceWindow) {
            delete self._recentCodes[code];
        }
    });
};

/**
 * Foca no input manual
 * @public
 */
InputArea.prototype.setFocus = function () {
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
InputArea.prototype.show = function () {
    const el = document.querySelector('#scanner-area');
    if (el) el.classList.add('is-visible');
    this.unlock();
};

/**
 * Oculta a interface do scanner
 * @public
 */
InputArea.prototype.hide = function () {
    const el = document.querySelector('#scanner-area');
    if (el) el.classList.remove('is-visible');
    this.lock();
};

/**
 * Bloqueia novas leituras (útil para quando um modal está aberto)
 * @public
 */
InputArea.prototype.lock = function () {
    this.isLockedExternal = true;
    if (this.manualBarcodeInput) {
        this.manualBarcodeInput.disabled = true; // CORREÇÃO: Bloqueia o input visualmente
    }
    barcodeScanner.stop(); // Para a escuta do scanner quando nenhum local é selecionado
};

/**
 * Libera o scanner para novas leituras
 * @public
 */
InputArea.prototype.unlock = function () {
    this.isLockedExternal = false;
    if (this.manualBarcodeInput) {
        this.manualBarcodeInput.disabled = false; // CORREÇÃO: Desbloqueia o input
        this.setFocus();
    }
    // barcodeScanner é reativado via evento 'blur' do input manual,
    // não aqui, pois setFocus() acima dispara 'focus' que pausa o scanner
};

/**
 * Instância singleton do InputArea
 * @type {InputArea}
 */
export const inputArea = new InputArea();

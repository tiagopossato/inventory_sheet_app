/**
 * @fileoverview InputArea - Módulo de Gerenciamento de Área de Scanner
 *
 * Gerencia a interface e funcionalidades de escaneamento de códigos de barras.
 *
 * @module InputArea
 * @version 2.0.0
 * @author Tiago Possato
 */

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
                placeholder="Código (10 dig)" 
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
        <div class="control-row">
            <input type="checkbox" id="bypassCheckLocation" name="bypassCheckLocation" value="bypassCheckLocation">
            <label for="bypassCheckLocation"> Ignorar verificação de localização?</label><br>
        </div>
    `;
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

    // Adiciona o observador (listener) que "ouve" a digitação
    this.manualBarcodeInput.addEventListener('input', function (e) {
        if (self.isLockedExternal) return; // Não permite ler se estiver bloqueado

        const currentValue = e.target.value.trim();

        // Se chegar a 10 caracteres, dispara o envio automático!
        if (currentValue.length >= 10) {
            // CORREÇÃO: Limpa o campo ANTES de disparar o evento. 
            // Assim, se o evento der erro em outro arquivo, o campo já estará limpo.
            self.manualBarcodeInput.value = ""; 

            // Dispara o evento de forma assíncrona para não travar a UI
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('codeScanned', {
                    detail: {
                        code: currentValue,
                        source: 'manual_input'
                    }
                }));
            }, 0);
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
    if (el) el.style.display = 'block';
};

/**
 * Oculta a interface do scanner
 * @public
 */
InputArea.prototype.hide = function () {
    const el = document.querySelector('#scanner-area');
    if (el) el.style.display = 'none';
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
};

/**
 * Instância singleton do InputArea
 * @type {InputArea}
 */
export const inputArea = new InputArea();

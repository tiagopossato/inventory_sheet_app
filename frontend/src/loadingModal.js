/**
 * @fileoverview LoadingModal - Gerenciamento global de estados de carregamento
 * @module LoadingModal
 */

function LoadingModal() {
    this.injectHTML();
    this.alert = document.getElementById('consultingAlert');
    this.overlay = document.getElementById('loadingOverlay'); // Overlay dedicado
}

/**
 * Injeta o HTML necessário para o feedback de carregamento
 * @private
 */
LoadingModal.prototype.injectHTML = function () {
    if (document.getElementById('consultingAlert')) return;

    const html = `
        <div id="loadingOverlay"></div>
        <div id="consultingAlert">
            <p>⏳ Consultando planilha ...</p>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

/**
 * Controla a exibição do loading
 * @param {boolean} show - Mostrar ou ocultar
 * @param {string} [message] - Mensagem personalizada opcional
 */
LoadingModal.prototype.toggle = function (show, message = "⏳ Consultando planilha ...") {
    if (!this.alert || !this.overlay) return;

    if (show) {
        this.alert.querySelector('p').textContent = message;
        this.overlay.classList.add('is-loading');
        this.alert.classList.add('is-visible');

    } else {
        this.alert.classList.remove('is-visible');
        this.overlay.classList.remove('is-loading');
    }
};

export const loadingModal = new LoadingModal();

// if (show) {
//     if (this.overlay) {
//         this.overlay.style.display = 'block';
//         this.overlay.style.zIndex = '9998'; // Coloca logo abaixo do alert (9999)
//         this.overlay.onclick = null;
//         this.overlay.style.cursor = 'default'; // Remove o ponteiro de mão
//     }
//     alert.style.display = 'block';
// } else {
//     alert.style.display = 'none';
//     // Se o modal de tabela não estiver aberto, fecha o overlay
//     if (this.modal.style.display !== 'flex' && this.overlay) {
//         this.overlay.style.display = 'none';
//         this.overlay.style.zIndex = '1900'; // Retorna ao z-index original do modal
//     }
// }
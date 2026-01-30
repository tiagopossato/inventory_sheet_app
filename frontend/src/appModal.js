/**
 * MÓDULO: AppModal
 * Substituto moderno e assíncrono para o window.confirm/alert.
 * Padrão Singleton para evitar múltiplas instâncias.
 * 
 * @namespace AppModal
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} ModalElements
 * @property {HTMLDivElement} overlay - Elemento overlay do modal
 * @property {HTMLDivElement} title - Elemento do título
 * @property {HTMLDivElement} body - Elemento do corpo da mensagem
 * @property {HTMLButtonElement} btnConfirm - Botão de confirmação
 * @property {HTMLButtonElement} btnCancel - Botão de cancelamento
 */

/**
 * Interface do AppModal
 * @type {Object}
 * @property {boolean} isVisible - Indica se o modal está visível
 * @property {ModalElements|null} elements - Cache dos elementos DOM
 */
export const AppModal = {
    /**
     * Indica se o modal está atualmente visível
     * @type {boolean}
     */
    isVisible: false,

    /**
     * Cache dos elementos DOM do modal
     * @type {ModalElements|null}
     */
    elements: null,

    /**
     * Inicializa o HTML e CSS na primeira chamada.
     * Método privado - não deve ser chamado diretamente
     * @private
     */
    _init() {
        if (this.elements) return;

        // 1. Cria Elementos DOM
        const overlay = document.createElement('div');
        overlay.className = 'app-modal-overlay';
        overlay.innerHTML = `
            <div class="app-modal-box">
                <div class="app-modal-title"></div>
                <div class="app-modal-body"></div>
                <div class="app-modal-actions">
                    <button class="app-btn app-btn-cancel">Cancelar</button>
                    <button class="app-btn app-btn-confirm">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 2. Cache de seletores
        this.elements = {
            overlay: overlay,
            title: overlay.querySelector('.app-modal-title'),
            body: overlay.querySelector('.app-modal-body'),
            btnConfirm: overlay.querySelector('.app-btn-confirm'),
            btnCancel: overlay.querySelector('.app-btn-cancel')
        };
    },

    /**
     * Exibe um modal de confirmação customizado.
     * Substitui o window.confirm() nativo com interface mais amigável.
     * 
     * @param {string} title - Título do modal (pode conter emojis)
     * @param {string} message - Mensagem do modal (suporta \n para quebra de linha)
     * @returns {Promise<boolean>} Promise que resolve para true se confirmado, false se cancelado
     * 
     * @example
     * // Uso básico
     * const resultado = await AppModal.confirm("Confirmação", "Deseja prosseguir?");
     * if (resultado) {
     *     // Ação confirmada
     * }
     * 
     * @example
     * // Com quebras de linha
     * AppModal.confirm("Aviso", "Esta ação é irreversível.\n\nDeseja continuar?");
     * 
     * @throws {Error} Se não for executado em ambiente browser com DOM disponível
     */
    confirm(title, message) {
        return new Promise((resolve) => {
            // Proteção contra duplicação
            if (this.isVisible) {
                console.warn("AppModal: Tentativa de abrir modal duplicado ignorada.");
                return resolve(false);
            }

            this._init();

            // Configura conteúdo
            this.elements.title.textContent = title;
            this.elements.body.textContent = message;

            /**
             * Realiza a limpeza dos event listeners e estado do modal
             * @private
             */
            const cleanup = () => {
                this.isVisible = false;
                this.elements.overlay.classList.remove('active');
                this.elements.btnConfirm.removeEventListener('click', onConfirm);
                this.elements.btnCancel.removeEventListener('click', onCancel);
            };

            /**
             * Handler para confirmação
             * @private
             */
            const onConfirm = () => {
                cleanup();
                resolve(true);
            };

            /**
             * Handler para cancelamento
             * @private
             */
            const onCancel = () => {
                cleanup();
                resolve(false);
            };

            // Ativa eventos
            this.elements.btnConfirm.addEventListener('click', onConfirm);
            this.elements.btnCancel.addEventListener('click', onCancel);

            // Exibe o modal
            this.isVisible = true;
            this.elements.overlay.classList.add('active');
        });
    }
};

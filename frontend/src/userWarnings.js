/**
 * @fileoverview UserWarnings - Módulo de Gerenciamento de Alertas do Usuário
 * 
 * Gerencia a exibição e controle de mensagens de aviso/erro na interface.
 * Implementa timeout automático para limpeza de alertas após 15 segundos.
 * 
 * @module UserWarnings
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} UserWarningsConfig
 * @property {HTMLElement} warningArea - Elemento HTML para exibição dos alertas
 * @property {number} timeoutDuration - Duração do timeout em milissegundos
 */

/**
 * Classe principal do módulo UserWarnings
 * @class
 * @public
 */
function UserWarnings() {
    /**
     * Área de exibição dos avisos
     * @type {HTMLElement}
     * @private
     */
    this.warningArea = document.getElementById('warning-area');

    /**
     * ID do timer para limpeza automática
     * @type {number|null}
     * @private
     */
    this.timerId = null;
}

/**
 * Exibe uma mensagem na área de aviso com destaque visual e timeout automático
 * @param {string} message - A mensagem a ser exibida
 * @public
 * 
 * @example
 * // Exibe um aviso por 15 segundos
 * userWarnings.printUserWarning("Código de barras inválido");
 * 
 * @example
 * // Substitui um aviso anterior
 * userWarnings.printUserWarning("Primeira mensagem");
 * userWarnings.printUserWarning("Segunda mensagem"); // Substitui a primeira
 */
UserWarnings.prototype.printUserWarning = function (message) {
    console.log(message);

    if (!this.warningArea) return;

    // Define o conteúdo e ativa a classe CSS
    this.warningArea.textContent = message;
    this.warningArea.classList.add('warning-active');

    // Gerencia o Timer (usando dataset para evitar conflitos de escopo)
    if (this.timerId) {
        clearTimeout(this.timerId);
    }

    this.timerId = setTimeout(() => {
        this.clearUserWarning();
    }, 15000);
}

/**
 * Limpa o texto e remove o estilo da área de aviso imediatamente
 * @public
 * 
 * @example
 * // Limpa o aviso atual
 * userWarnings.clearUserWarning();
 */
UserWarnings.prototype.clearUserWarning = function () {
    if (!this.warningArea) return;

    this.warningArea.textContent = '';
    this.warningArea.classList.remove('warning-active');

    if (this.timerId) {
        clearTimeout(this.timerId);
    }
}

/**
 * Instância singleton do UserWarnings
 * @type {UserWarnings}
 */
export const userWarnings = new UserWarnings();

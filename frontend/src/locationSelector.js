/**
 * @fileoverview LocationSelector - Módulo de Gerenciamento da Seleção de Localização
 * 
 * Gerencia o seletor de localização, renderizando opções baseadas em dados injetados
 * pelo Google Apps Script e disparando eventos de mudança para outros módulos.
 * 
 * @module LocationSelector
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} LocationItem
 * @property {string} name - Nome da localização
 * @property {number} assetsCount - Número de itens na localização
 */

/**
 * @typedef {LocationItem[]} LocationsData
 */

/**
 * Classe principal do módulo LocationSelector
 * @class
 * @public
 */
function LocationSelector() {
    /**
     * Seletor CSS do container do componente
     * @type {string}
     * @private
     */
    this.containerId = '#location-selector';

    /**
     * ID do elemento select
     * @type {string}
     * @private
     */
    this.selectId = 'location-select';

    /**
     * Valor usado quando nenhuma localização está selecionada
     * @type {string}
     * @constant
     * @public
     */
    this.NONE_SELECTED = '-1';

    // Bind de métodos para manter o contexto
    this.getSelectedLocation = this.getSelectedLocation.bind(this);
    this.init = this.init.bind(this);
}

/**
 * Retorna o valor atual selecionado ou this.NONE_SELECTED
 * @returns {string} Localização selecionada ou NONE_SELECTED
 * @public
 * 
 * @example
 * const location = locationSelector.getSelectedLocation();
 * if (location === locationSelector.NONE_SELECTED) {
 *     console.log('Nenhuma localização selecionada');
 * }
 */
LocationSelector.prototype.getSelectedLocation = function () {
    const el = document.getElementById(this.selectId);
    return el ? el.value : this.NONE_SELECTED;
};

/**
 * Inicializa e renderiza o componente usando os dados globais injetados
 * @param {LocationsData} data - Array de localizações com contagem de itens
 * @returns {void}
 * @public
 * 
 * @example
 * // Formato esperado dos dados:
 * // [
 * //   { "name": "Sala 1", "assetsCount": 25 },
 * //   { "name": "Sala 2", "assetsCount": 18 }
 * // ]
 * 
 * locationSelector.init(locationsData);
 */
LocationSelector.prototype.init = function (data) {
    const container = document.querySelector(this.containerId);
    if (!container) {
        console.error('LocationSelector: Container não encontrado:', this.containerId);
        return;
    }

    // Garante que trabalhamos com um array, mesmo que data seja null/undefined
    const locations = data || [];

    if (locations.length === 0) {
        console.warn("LocationSelector: Nenhuma localização disponível para renderizar.");
        container.innerHTML = '<p class="error">Nenhuma localização encontrada.</p>';
        return;
    }

    let optionsHtml = `<option value="${this.NONE_SELECTED}">Selecione uma localização</option>`;

    for (let i = 0; i < locations.length; i++) {
        const item = locations[i];

        // Valida a estrutura do item
        if (!item || typeof item.name !== 'string') {
            console.warn('LocationSelector: Item inválido ignorado:', item);
            continue;
        }

        const name = item.name;
        const count = item.assetsCount || 0;

        optionsHtml += (
            '<option value="' + name + '">' +
            name + ' [' + count + ' itens]' +
            '</option>'
        );
    }

    container.innerHTML = (
        '<select id="' + this.selectId + '" class="location-select">' +
        optionsHtml +
        '</select>'
    );

    this.setupEvents();
};

/**
 * Configura os ouvintes de eventos do seletor
 * @private
 */
LocationSelector.prototype.setupEvents = function () {
    const select = document.getElementById(this.selectId);

    if (!select) {
        console.error("LocationSelector: Elemento select com id '" + this.selectId + "' não encontrado.");
        return;
    }

    /**
     * Handler para evento de mudança de seleção
     * @private
     */
    const handleChange = function () {
        const newValue = select.value;

        /**
         * Evento global disparado quando a localização é alterada
         * @event locationChanged
         * @property {string} location - Nova localização selecionada
         */
        window.dispatchEvent(new CustomEvent('locationChanged', {
            detail: { location: newValue }
        }));
    };

    select.addEventListener('change', handleChange);
};

/**
 * Retorna o estado atual do seletor
 * @returns {boolean} true se uma localização válida está selecionada
 * @public
 */
LocationSelector.prototype.hasValidSelection = function () {
    const selected = this.getSelectedLocation();
    return selected !== this.NONE_SELECTED;
};

/**
 * Força a seleção de uma localização específica
 * @param {string} locationName - Nome da localização a ser selecionada
 * @returns {boolean} true se a seleção foi bem-sucedida
 * @public
 */
LocationSelector.prototype.setSelectedLocation = function (locationName) {
    const select = document.getElementById(this.selectId);
    if (!select) return false;

    const optionExists = Array.from(select.options).some(option =>
        option.value === locationName
    );

    if (optionExists) {
        select.value = locationName;
        select.dispatchEvent(new Event('change'));
        return true;
    }

    return false;
};

/**
 * Instância singleton do LocationSelector
 * @type {LocationSelector}
 */
export const locationSelector = new LocationSelector();

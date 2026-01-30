/**
 * @fileoverview BarcodeTable - Módulo de Gerenciamento da Tabela de Leituras
 * 
 * Gerencia a renderização, atualização e eventos da tabela de códigos de barras.
 * Implementa paginação, filtros por localização e atualizações em tempo real.
 * 
 * @module BarcodeTable
 * @version 1.0.0
 * @author Tiago Possato
 */

import { assetRepository, AssetStatus } from './assetRepository.js';
import { locationSelector } from './locationSelector.js';

/**
 * @typedef {Object} TableConfig
 * @property {number} itemsPerPage - Número de itens por página
 * @property {string|null} currentFilter - Filtro de localização atual
 */

/**
 * @typedef {Object} PaginationInfo
 * @property {number} currentPage - Página atual
 * @property {number} totalPages - Total de páginas
 * @property {number} totalItems - Total de itens
 * @property {number} startIndex - Índice de início da página
 * @property {number} endIndex - Índice de fim da página
 */

/**
 * Classe principal do módulo BarcodeTable
 * @class
 * @public
 */
function BarcodeTable() {
    /**
     * Página atual da tabela
     * @type {number}
     * @public
     */
    this.currentPage = 1;

    // Bind de métodos para travar o contexto 'this'
    this.renderTable = this.renderTable.bind(this);
    this._updateItemInTable = this._updateItemInTable.bind(this);
    this._setupTableEvents = this._setupTableEvents.bind(this);

    /**
     * Configurações da tabela
     * @type {TableConfig}
     * @private
     */
    this._itemsPerPage = 10;
    this._currentFilter = null;

    // Renderiza a estrutura HTML inicial
    const tableArea = document.getElementById('barcode-table-area');
    tableArea.innerHTML = `
        <div class="table-wrapper">
            <h4 class="table-header-container" id="table-heading">Itens Encontrados por este dispositivo</h4>
            <table id="barcode-table">
                <thead>
                    <tr>
                        <th class="col-stat">Stat</th>
                        <th class="col-patrimonio">Patrimônio</th>
                        <th class="col-location">Local</th>
                        <th class="col-action">Ação</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        <div class="pagination-container">
            <div class="pagination-info">Itens: <span id="table-item-count">0</span></div>
            <div class="pagination-info">Página <span id="page-num">1</span></div>
            <div class="pagination-buttons">
                <button id="prev-page" class="pagination-btn">Anterior</button>
                <button id="next-page" class="pagination-btn">Próximo</button>
            </div>
        </div>
    `;

    // Inicializa os ouvintes de eventos globais
    this._setupTableEvents();
}

/**
 * Cria uma célula de tabela com conteúdo e classe CSS
 * @param {string} content - Conteúdo da célula
 * @param {string} [className] - Classe CSS opcional
 * @returns {HTMLTableCellElement} Elemento TD criado
 * @private
 */
BarcodeTable.prototype._createCell = function (content, className) {
    const cell = document.createElement("td");
    cell.className = className || "";
    cell.textContent = content;
    return cell;
};

/**
 * Retorna o ícone correspondente ao status do item
 * @param {string} status - Status do asset
 * @returns {string} Emoji representando o status
 * @private
 */
BarcodeTable.prototype._statusIcon = function (status) {
    switch (status) {
        case AssetStatus.SYNCED: return '✅';
        case AssetStatus.IN_FLIGHT: return '🔄';
        case AssetStatus.FAILED: return '❌';
        case AssetStatus.PENDING: return '⏳';
        default: return '?';
    }
};

/**
 * Atualiza visualmente uma linha sem reconstruí-la
 * @param {Object} item - Item a ser atualizado
 * @private
 */
BarcodeTable.prototype._updateItemInTable = function (item) {
    const row = document.getElementById('row-' + item.uid);
    if (!row) return;

    // Atualiza apenas se necessário (evita reflow desnecessário)
    if (row.cells[0].textContent !== this._statusIcon(item.status)) {
        row.cells[0].textContent = this._statusIcon(item.status);
    }

    if (row.cells[1].textContent !== item.code) {
        row.cells[1].textContent = item.code;
    }

    if (row.cells[2].textContent !== item.location) {
        row.cells[2].textContent = item.location;
    }
};

/**
 * Renderiza/atualiza a tabela com os itens filtrados e paginados
 * @param {string|null} [currentFilter=null] - Filtro de localização
 * @public
 */
BarcodeTable.prototype.renderTable = function (currentFilter = null) {
    const self = this;
    const tbody = document.querySelector("#barcode-table tbody");
    if (!tbody) return;

    // Aplica o filtro se ele existir
    if (currentFilter !== null) {
        if (currentFilter !== locationSelector.NONE_SELECTED) {
            self._currentFilter = currentFilter;
        } else {
            self._currentFilter = null;
        }
    }

    const allFilteredItems = [...assetRepository.getItemsByLocation(self._currentFilter)].reverse();

    const totalItems = allFilteredItems.length;
    const totalPages = Math.ceil(totalItems / self._itemsPerPage) || 1;

    // Garante que a página atual é válida após filtrar
    if (self.currentPage > totalPages) self.currentPage = totalPages;
    if (self.currentPage < 1) self.currentPage = 1;

    const start = (self.currentPage - 1) * self._itemsPerPage;
    const end = start + self._itemsPerPage;
    const paginatedItems = allFilteredItems.slice(start, end);

    // Atualiza UI de paginação
    document.getElementById('page-num').textContent = self.currentPage + " / " + totalPages;
    document.getElementById('prev-page').disabled = (self.currentPage === 1);
    document.getElementById('next-page').disabled = (self.currentPage === totalPages);
    document.getElementById('table-item-count').textContent = String(totalItems);

    // Limpa e reconstrói a tabela
    tbody.innerHTML = ''; // Limpa a página anterior
    const fragment = document.createDocumentFragment();

    paginatedItems.forEach(function (item) {
        const tr = document.createElement("tr");
        tr.id = "row-" + item.uid;

        tr.appendChild(self._createCell(self._statusIcon(item.status), 'status-cell centered-cell'));
        tr.appendChild(self._createCell(item.code, "centered-cell"));
        tr.appendChild(self._createCell(item.location, "default-cell"));

        const actionCell = document.createElement("td");
        actionCell.className = "centered-cell";

        const btn = document.createElement("button");
        btn.className = "btn-edit";
        btn.textContent = "Editar";
        btn.onclick = function () {
            window.dispatchEvent(new CustomEvent('editItemRequested', {
                detail: { uid: item.uid }
            }));
        };

        actionCell.appendChild(btn);
        tr.appendChild(actionCell);
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
};

/**
 * Configura listeners para reagir a mudanças de dados
 * @private
 */
BarcodeTable.prototype._setupTableEvents = function () {
    const self = this;

    const btnPrev = document.getElementById('prev-page');
    const btnNext = document.getElementById('next-page');

    if (btnPrev && btnNext) {
        btnPrev.onclick = function () {
            if (self.currentPage > 1) {
                self.currentPage--;
                self.renderTable();
            }
        };

        btnNext.onclick = function () {
            const totalPages = Math.ceil(assetRepository.getStats().total / self._itemsPerPage);
            if (self.currentPage < totalPages) {
                self.currentPage++;
                self.renderTable();
            }
        };
    }

    /**
     * Escuta eventos de mudança de dados dos assets
     * @event assetDataChanged
     */
    window.addEventListener('assetDataChanged', function (event) {
        const item = event.detail && event.detail.item;
        if (item) {
            self._updateItemInTable(item);
        }
    });

    /**
     * Escuta eventos de mudança de localização
     * @event locationChanged
     */
    window.addEventListener('locationChanged', function (e) {
        const novoLocal = e.detail.location;
        //verifica se o local é válido
        if (novoLocal === null || novoLocal === undefined) return;

        // Atualiza o estado interno do filtro no módulo da tabela
        self.currentPage = 1; // Volta para a primeira página ao trocar de local
        self.renderTable(novoLocal);
    });
};

/**
 * Instância singleton do BarcodeTable
 * @type {BarcodeTable}
 */
export const barcodeTable = new BarcodeTable();

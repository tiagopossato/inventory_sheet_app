/**
 * @fileoverview AssetsNotFound - Módulo de Gerenciamento de Itens Não Encontrados
 * 
 * Gerencia a interface e lógica para busca e processamento de itens não encontrados
 * na planilha. Inclui modal de exibição, consulta assíncrona ao Google Sheets
 * e integração com o processo de código de barras.
 * 
 * @module AssetsNotFound
 * @version 1.0.0
 * @author Tiago Possato
 */

import { processBarcode } from './processBarcode.js';
import { locationSelector } from './locationSelector.js'
import { userWarnings } from './userWarnings.js';
import { AppModal } from './appModal.js';
import { loadingModal } from './loadingModal.js'
import { backendService } from "./backendService.js"
import { scannerManager } from "./scannerManager.js"

/**
 * @typedef {Object} NotFoundItem
 * @property {string} 0 - Código do tombo
 * @property {string} 1 - Descrição do item
 */

/**
 * @typedef {Object} AssetsNotFoundElements
 * @property {HTMLElement} overlay - Overlay do modal
 * @property {HTMLElement} modal - Modal principal
 */

/**
 * Classe principal do módulo AssetsNotFound
 * @class
 * @public
 */
function AssetsNotFound() {
    // 1. Injeta o HTML primeiro para garantir que os IDs existam no DOM
    this.injectHTML();

    /**
     * Referências do DOM
     * @type {AssetsNotFoundElements}
     * @private
     */
    this.overlay = document.getElementById('notFoundOverlay');
    this.modal = document.getElementById('assetNotFoundModal');

    // Binds de contexto
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.setupEvents = this.setupEvents.bind(this);
    this.addItensToNotFoundTable = this.addItensToNotFoundTable.bind(this);
    this.getNotFoundItensOnLocation = this.getNotFoundItensOnLocation.bind(this);

    this.setupEvents();
    this.hideButton(); // Começa oculto até selecionar um local
}

/**
 * Injeta o HTML necessário no DOM
 * @private
 */
AssetsNotFound.prototype.injectHTML = function () {
    const container = document.getElementById('not-found-area');
    if (!container) return;

    // 1. Botão de busca (Usa as classes .btn e .location-btn da seção 3)
    if (!document.getElementById('notFoundBtn')) {
        container.innerHTML += `
            <button id="notFoundBtn" class="btn location-btn">
                Buscar itens não encontrados
            </button>
        `;
    }

    if (document.getElementById('assetNotFoundModal')) return;

    // 2. Overlay (Estilizado na seção 10: #notFoundOverlay)
    const localOverlayHtml = `<div id="notFoundOverlay"></div>`;

    // 3. Modal e Tabela (Estilizados na seção 10: #assetNotFoundModal.full-screen e #notFoundTable)
    const modalHtml = `
        <div id="assetNotFoundModal" class="full-screen">
            <div class="popup-header">
                <h3 class="popup-title">Itens Não Encontrados</h3>
                <button id="closePopupButton" class="btn btn-red">FECHAR</button>
            </div>
            <div class="table-scroll">
                <table id="notFoundTable">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th style="width: 100px;">Tombo</th>
                            <th>Descrição</th>
                            <th style="width: 90px;">Ação</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', localOverlayHtml);
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/**
 * Exibe o botão de busca de itens não encontrados
 * @public
 */
AssetsNotFound.prototype.showButton = function () {
    const btn = document.getElementById('notFoundBtn');
    if (btn) btn.style.display = 'block';
};

/**
 * Oculta o botão de busca de itens não encontrados
 * @public
 */
AssetsNotFound.prototype.hideButton = function () {
    const btn = document.getElementById('notFoundBtn');
    if (btn) btn.style.display = 'none';
};

/**
 * Configura os eventos do módulo
 * @private
 */
AssetsNotFound.prototype.setupEvents = function () {
    const self = this;
    const btn = document.getElementById('notFoundBtn');
    if (btn) {
        btn.onclick = function () {
            const local = locationSelector.getSelectedLocation();
            if (local === locationSelector.NONE_SELECTED) {
                userWarnings.printUserWarning("Selecione uma localização primeiro!");
                return;
            }
            // 1. BLOQUEIA O SCANNER
            scannerManager.lock();
            self.getNotFoundItensOnLocation(local);
        };
    }

    const closeBtn = document.getElementById('closePopupButton');
    if (closeBtn) {
        closeBtn.onclick = this.close;
    }

    window.addEventListener('locationChanged', function (e) {
        const novoLocal = e.detail.location;
        //verifica se o local é válido
        if (novoLocal === null || novoLocal === undefined) return;
        if (novoLocal === locationSelector.NONE_SELECTED) {
            self.hideButton();
        } else {
            self.showButton();
        }
    });
};

/**
 * Abre o modal de itens não encontrados
 * @public
 */
AssetsNotFound.prototype.open = function () {
    // Move para o final do body para evitar z-index/parent issues
    document.body.appendChild(this.modal);

    this.overlay.style.display = 'block';
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Trava o scroll do fundo
};

/**
 * Fecha o modal de itens não encontrados
 * @public
 */
AssetsNotFound.prototype.close = function () {
    this.overlay.style.display = 'none';
    this.modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Destrava o scroll
    // 2. DESBLOQUEIA O SCANNER 
    scannerManager.unlock();
};

/**
 * Adiciona itens à tabela de não encontrados
 * @param {NotFoundItem[]} itens - Array de itens não encontrados
 * @public
 */
AssetsNotFound.prototype.addItensToNotFoundTable = function (itens) {
    if (!itens || itens.length === 0) {
        return;
    }

    const tbody = document.querySelector("#notFoundTable tbody");
    tbody.innerHTML = '';

    const fragment = document.createDocumentFragment();

    itens.forEach((item, index) => {
        const tr = document.createElement("tr");

        // Os estilos de borda, padding e alinhamento centralizado das colunas 1, 2 e 4
        // já estão definidos na Seção 10 do seu CSS.
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item[0]}</td>
            <td>${item[1]}</td>
            <td></td>
        `;

        const btn = document.createElement("button");
        btn.textContent = "Adicionar";
        btn.className = "btn-edit"; // Classe definida na Seção 10 (#notFoundTable .btn-edit)

        btn.onclick = async () => {
            const confirmado = await AppModal.confirm(
                `Confirmar Adição`,
                `Deseja marcar o item ${item[0]} como encontrado?`
            );

            if (confirmado) {
                processBarcode(item[0], locationSelector.getSelectedLocation());
                tr.remove();
                if (tbody.childElementCount === 0) this.close();
            }
        };

        tr.cells[3].appendChild(btn);
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    this.open();
};

/**
 * Busca itens não encontrados para uma localização específica
 * @param {string} location - Localização para busca
 * @public
 */
AssetsNotFound.prototype.getNotFoundItensOnLocation = function (location) {
    const self = this;
    const TIMEOUT = 25000;
    let isFinished = false;

    const timeoutAlert = setTimeout(function () {
        if (!isFinished) {
            isFinished = true;
            loadingModal.toggle(false);
            // 2. DESBLOQUEIA O SCANNER 
            scannerManager.unlock();
            userWarnings.printUserWarning('Tempo esgotado. Verifique sua conexão com a planilha.');
        }
    }, TIMEOUT);

    loadingModal.toggle(true);

    // Usar backendService com tratamento unificado
    backendService.getNotFoundItens(location)
        .then(function (data) {
            if (isFinished) return;
            isFinished = true;
            clearTimeout(timeoutAlert);
            loadingModal.toggle(false);

            if (!data || data.length === 0) {
                // 2. DESBLOQUEIA O SCANNER 
                scannerManager.unlock();
                userWarnings.printUserWarning(`Nenhum item pendente para ${location}! Caso não apareça na sua tabela, foi encontrado por outro usuário.`);
                return;
            }
            self.addItensToNotFoundTable(data);
        })
        .catch(function (error) {
            if (isFinished) return;
            isFinished = true;
            clearTimeout(timeoutAlert);
            loadingModal.toggle(false);
            // 2. DESBLOQUEIA O SCANNER 
            scannerManager.unlock();
            console.error('Erro ao buscar itens não encontrados:', error);
            userWarnings.printUserWarning('Erro ao consultar servidor.');
        });
};

/**
 * Instância singleton do AssetsNotFound
 * @type {AssetsNotFound}
 */
export const assetsNotFound = new AssetsNotFound();

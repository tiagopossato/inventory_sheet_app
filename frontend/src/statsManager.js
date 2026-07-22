/**
 * @fileoverview StatsManager - Módulo de Gerenciamento de Estatísticas e Dashboard
 * 
 * Gerencia a exibição e atualização em tempo real das métricas do inventário.
 * Inclui estatísticas locais de sincronização e resumo geral do processo.
 * 
 * @module StatsManager
 * @version 1.0.0
 * @author Tiago Possato
 */

import { assetRepository } from "./assetRepository.js";
import { locationSelector } from "./locationSelector.js"

/**
 * @typedef {Object} StatElements
 * @property {string} total - ID do elemento para total de itens
 * @property {string} synced - ID do elemento para itens sincronizados
 * @property {string} pending - ID do elemento para itens pendentes
 * @property {string} failed - ID do elemento para itens com falha
 * @property {string} contextCard - ID do card de contexto
 * @property {string} contextContent - ID do conteúdo de contexto
 */

/**
 * @typedef {Object} LocationData
 * @property {string} name - Nome da localização
 * @property {number} totalAssets - Total de ativos na localização
 * @property {number} assetsFindedCount - Total de ativos encontrados
 * @property {number} missingAssets - Total de ativos faltantes
 */

/**
 * @typedef {Object} StatsManagerState
 * @property {LocationData[]} _lastLocationsData - Dados mais recentes das localizações
 */

/**
 * Classe principal do módulo StatsManager
 * @class
 * @public
 */
function StatsManager() {
    /**
     * ID do container principal das estatísticas
     * @type {string}
     * @private
     */
    this.containerId = 'stats-area';

    /**
     * Mapeamento dos elementos HTML das estatísticas
     * @type {StatElements}
     * @private
     */
    this.elements = {
        total: 'stat-total',
        synced: 'stat-synced',
        pending: 'stat-pending',
        failed: 'stat-failed',
        contextCard: 'location-context-card',
        contextContent: 'location-context-content'
    };

    /**
     * Estado interno do módulo
     * @type {StatsManagerState}
     * @private
     */
    this._lastLocationsData = [];

    // Bind de métodos para manter o contexto
    this._updateStats = this._updateStats.bind(this);
    this._setupEvents = this._setupEvents.bind(this);

    this._innerHtml();
    this._setupEvents(); // Configura o clique
    this._updateStats();
}

/**
 * Injeta a estrutura HTML do dashboard de estatísticas
 * @param {string} [parentId] - ID do elemento onde as stats devem ser renderizadas
 * @private
 */
StatsManager.prototype._innerHtml = function (parentId) {
    const parent = document.getElementById(parentId || this.containerId);
    if (!parent) return;

    parent.innerHTML = `
        <div class="stats-container">

            <div id="${this.elements.contextCard}" class="stat-card full-width">
                <div class="flex-align-center" style="margin-bottom: 8px;">
                    <span id="syncStatusIcon" class="is-fetching" aria-label="Sincronizando" role="status">🔁</span>
                    <span class="stat-label">Resumo Geral do processo de Inventário:</span>
                </div>
                <div id="${this.elements.contextContent}"></div>
            </div>

            <div class="stats-section-label">
                <span class="stat-label">Sincronização com a planilha</span>
            </div>

            <div class="stat-card">
                <span class="stat-label">Lidos (Dispositivo)</span>
                <span id="${this.elements.total}" class="stat-value" aria-live="polite">0</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Sincronizados</span>
                <span id="${this.elements.synced}" class="stat-value text-success" aria-live="polite">0</span>
            </div>
            <div class="stat-card" id="card-pending">
                <span class="stat-label">Pendentes</span>
                <span id="${this.elements.pending}" class="stat-value text-warning" aria-live="polite">0</span>
            </div>
            <div class="stat-card clickable" id="card-failed" role="button" tabindex="0">
                <span class="stat-label">Falhas 🔄</span>
                <span id="${this.elements.failed}" class="stat-value text-danger">0</span>
            </div>
        </div>
    `;
};

/**
 * Renderiza o conteúdo de contexto baseado nos dados das localizações
 * @private
 */
StatsManager.prototype.renderLocationContext = function () {
    const content = document.getElementById(this.elements.contextContent);
    if (!content) return;

    const locations = this._lastLocationsData;

    if (locations.length > 0) {

        const fragment = document.createDocumentFragment();

        // 2. Tabela
        const table = document.createElement('table');
        table.className = 'compact-table';

        const tbody = document.createElement('tbody');

        locations.forEach(loc => {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.className = 'stat-cell';

            /* ---------- Localidade ---------- */
            const nameDiv = document.createElement('div');
            nameDiv.className = 'clickable-location'; // Aplica todo o estilo visual
            nameDiv.setAttribute('role', 'button');
            nameDiv.setAttribute('tabindex', '0');
            nameDiv.setAttribute('aria-label', 'Selecionar local: ' + loc.name);
            nameDiv.innerHTML = `🔍 <span>${loc.name}</span>`;
            nameDiv.classList.add('stat-location-name');

            // Ação de selecionar localização
            const selectLocation = () => {
                locationSelector.setSelectedLocation(loc.name);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            nameDiv.onclick = selectLocation;
            nameDiv.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectLocation();
                }
            };

            /* ---------- Métricas ---------- */
            const metrics = document.createElement('div');
            metrics.className = 'stat-metrics';

            const total = document.createElement('span');
            total.innerHTML = '<strong>' + loc.totalAssets + '</strong> total';

            const found = document.createElement('span');
            found.innerHTML = `✅ <strong>${loc.assetsFindedCount}</strong> encontrados`;
            found.className = 'stat-found';

            const missing = document.createElement('span');
            missing.innerHTML = `❌ <strong>${loc.missingAssets}</strong> faltantes`;
            missing.className = 'stat-missing';

            metrics.appendChild(total);
            metrics.appendChild(found);
            metrics.appendChild(missing);

            td.appendChild(nameDiv);
            td.appendChild(metrics);
            tr.appendChild(td);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        fragment.appendChild(table);

        // 3. Injeta tudo de uma vez
        content.innerHTML = '';
        content.appendChild(fragment);
    }
};

/**
 * Configura os listeners de eventos globais
 * @private
 */
StatsManager.prototype._setupEvents = function () {
    const self = this;
    const statusIcon = document.getElementById('syncStatusIcon'); // O elemento do ícone

    // 1. Clique para reenvio de falhas
    const fCard = document.getElementById('card-failed');
    if (fCard) {
        fCard.onclick = () => assetRepository.retryFailed();
        fCard.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                assetRepository.retryFailed();
            }
        };
    }

    // 2. Eventos de atualização de dados locais (Sincronização de saída)
    ['syncCompleted', 'syncStarted', 'assetDataChanged', 'assetAdded'].forEach(function (evt) {
        window.addEventListener(evt, function () { self._updateStats(); });
    });

    // Atualiza o ícone de sync quando o ciclo de sincronização termina
    window.addEventListener('syncCompleted', function () {
        var icon = document.getElementById('syncStatusIcon');
        if (!icon) return;
        var stats = assetRepository.getStats();
        if (stats.total === 0 && stats.pending === 0) {
            icon.textContent = '⏸️';
            icon.setAttribute('aria-label', 'Ocioso');
            icon.classList.remove('is-fetching');
        }
    });

    // 3. Evento de atualização do Registro Remoto (Sincronização de entrada)
    /**
     * Evento disparado quando o registro remoto é atualizado
     * @event inventoryRegistryUpdated
     */
    window.addEventListener('inventoryRegistryUpdated', function (event) {
        self._lastLocationsData = event.detail.locations || [];
        self.renderLocationContext();
    });


    window.addEventListener('inventoryRegistryIsFetching', (e) => {
        const { isFetching } = e.detail;
        if (!statusIcon) return;

        if (isFetching) {
            // Roda o ícone de carregamento
            statusIcon.className = 'is-fetching';
            statusIcon.textContent = '🔁';
            statusIcon.setAttribute('aria-label', 'Sincronizando');
        } else {
            // Para o ícone e mostra o check de sucesso
            statusIcon.textContent = '✅';
            statusIcon.setAttribute('aria-label', 'Sincronizado');
            if (statusIcon.classList.contains('is-fetching')) {
                statusIcon.classList.remove('is-fetching');
            }
        }
    });

};

/**
 * Atualiza os valores dos cards de estatísticas locais
 * @private
 */
StatsManager.prototype._updateStats = function () {
    if (typeof assetRepository === 'undefined') return;

    const stats = assetRepository.getStats();

    // Atualiza números básicos
    document.getElementById(this.elements.total).textContent = stats.total;
    document.getElementById(this.elements.synced).textContent = stats.synced;
    document.getElementById(this.elements.pending).textContent = stats.pending;
    document.getElementById(this.elements.failed).textContent = stats.failed;

    // Destaques visuais
    document.getElementById('card-pending').classList.toggle('highlight-warning', stats.pending > 0);
    document.getElementById('card-failed').classList.toggle('highlight-danger', stats.failed > 0);
};

/**
 * Instância singleton do StatsManager
 * @type {StatsManager}
 */
export const statsManager = new StatsManager();

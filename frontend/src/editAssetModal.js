/**
 * @fileoverview EditAssetModal - Módulo de Gerenciamento da Interface de Edição de Ativos
 * 
 * Gerencia o modal de edição de ativos com formulário para atualização de estado,
 * vida útil e observações. Implementa padrão Singleton com auto-injeção de HTML.
 * 
 * @module EditAssetModal
 * @version 1.0.0
 * @author Tiago Possato
 */

import { assetRepository } from './assetRepository.js';

/**
 * @typedef {Object} FormFields
 * @property {HTMLInputElement} uid - Campo oculto para UID do item
 * @property {HTMLInputElement} code - Campo de tombamento (somente leitura)
 * @property {HTMLTextAreaElement} location - Campo de localização (somente leitura)
 * @property {HTMLSelectElement} state - Select de estado do bem
 * @property {HTMLSelectElement} ipvu - Select de vida útil estimada
 * @property {HTMLTextAreaElement} obs - Textarea de observações
 */

/**
 * @typedef {Object} AssetFormData
 * @property {string} uid - Identificador único do item
 * @property {string} code - Código de tombamento
 * @property {string} location - Localização do item
 * @property {number} state - Estado do bem (0-4)
 * @property {number} ipvu - Vida útil estimada em anos
 * @property {string} obs - Observações adicionais
 */

/**
 * Classe principal do módulo EditAssetModal
 * @class
 * @public
 */
function EditAssetModal() {
    /**
     * Injeta o HTML necessário no DOM
     * @private
     */
    this.innerHTML();

    /**
     * Referência ao elemento modal
     * @type {HTMLElement}
     * @private
     */
    this.modal = document.getElementById('assetDetailsModal');

    /**
     * Cache dos campos do formulário para performance
     * @type {FormFields}
     * @private
     */
    this.fields = {
        uid: document.getElementById('uidField'),
        code: document.getElementById('tombamentoField'),
        location: document.getElementById('locationField'),
        state: document.getElementById('estadoBem'),
        ipvu: document.getElementById('vidaUtil'),
        obs: document.getElementById('observacoes')
    };

    // Bind de métodos para manter o contexto
    this.open = this.open.bind(this);
    this.submit = this.submit.bind(this);
    this.close = this.close.bind(this);

    /**
     * Handlers de eventos para remoção posterior
     * @type {Function}
     * @private
     */
    this.handleCancel = null;
    this.handleSave = null;

    this.initEvents();
    this.close();
}

/**
 * Injeta o HTML necessário no final do body - Versão Tela Cheia (Fullscreen)
 * @private
 */
EditAssetModal.prototype.innerHTML = function () {
    if (document.getElementById('assetDetailsModal')) return;

    const modalHtml = `
        <div id="assetDetailsModal" class="modal-full">
            
            <div class="modal-header">
                <h2>Editar Item</h2>
            </div>
            
            <form id="editAssetForm" class="modal-body">
                <input type="hidden" id="uidField">

                <div class="form-group">
                    <label>Tombamento</label>
                    <input type="text" id="tombamentoField" class="input-modal-readonly" style="height: 40px;" readonly/>
                </div>

                <div class="form-group">
                    <label>Localização</label>
                    <textarea id="locationField" class="input-modal-readonly" readonly></textarea>
                </div>

                <div class="form-group">
                    <label>Estado do Bem</label>
                    <select id="estadoBem" class="input-modal-edit">
                        <option value="0">Péssimo</option>
                        <option value="1">Ruim</option>
                        <option value="2">Regular</option>
                        <option value="3">Bom</option>
                        <option value="4">Excelente</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Vida Útil Estimada</label>
                    <select id="vidaUtil" class="input-modal-edit">
                        <option value="0">0 anos</option>
                        <option value="1">1 ano</option>
                        <option value="2">2 anos</option>
                        <option value="5">5 anos</option>
                        <option value="8">8 anos</option>
                        <option value="10">10 anos</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Observações</label>
                    <textarea id="observacoes" class="input-modal-edit" rows="5" placeholder="Notas adicionais..."></textarea>
                </div>

                <div class="modal-footer-btns">
                    <button type="button" id="btnCancelEdit" class="btn-modal btn-modal-cancel">Cancelar</button>
                    <button type="button" id="btnSaveEdit" class="btn-modal btn-modal-save">Salvar Alterações</button>
                </div>
            </form>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

/**
 * Configura os listeners de eventos
 * @private
 */
EditAssetModal.prototype.initEvents = function () {
    const self = this;

    /**
     * Handler para o botão cancelar
     * @private
     */
    this.handleCancel = function () { self.close(); };

    /**
     * Handler para o botão salvar
     * @private
     */
    this.handleSave = function () { self.submit(); };

    document.getElementById('btnCancelEdit').addEventListener('click', this.handleCancel);
    document.getElementById('btnSaveEdit').addEventListener('click', this.handleSave);

    /**
     * Evento customizado para abrir o modal de edição
     * @event editItemRequested
     */
    window.addEventListener('editItemRequested', function (e) {
        self.open(e.detail.uid);
    });
};

/**
 * Remove os listeners de eventos
 * @private
 */
EditAssetModal.prototype.removeEvents = function () {
    if (this.handleCancel) {
        document.getElementById('btnCancelEdit').removeEventListener('click', this.handleCancel);
    }
    if (this.handleSave) {
        document.getElementById('btnSaveEdit').removeEventListener('click', this.handleSave);
    }
};

/**
 * Abre o modal preenchido com dados do item
 * @param {string} uid - Identificador único do item a ser editado
 * @public
 */
EditAssetModal.prototype.open = function (uid) {
    const item = assetRepository.getItem(uid);
    if (!item) {
        console.warn('EditAssetModal: Item não encontrado para UID:', uid);
        return;
    }

    // Preenche os campos do formulário
    this.fields.uid.value = item.uid || "";
    this.fields.code.value = item.code || "";
    this.fields.location.value = item.location || "";
    this.fields.state.value = item.state !== undefined ? String(item.state) : "3";
    this.fields.ipvu.value = item.ipvu !== undefined ? String(item.ipvu) : "0";
    this.fields.obs.value = item.obs || "";

    this.modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Trava o scroll do fundo

    this.initEvents();
};

/**
 * Salva as alterações e atualiza a interface
 * @public
 */
EditAssetModal.prototype.submit = function () {
    const uid = this.fields.uid.value;
    const newState = parseInt(this.fields.state.value, 10);
    const newIpvu = parseInt(this.fields.ipvu.value, 10);
    const newObs = this.fields.obs.value.trim();

    if (!uid) {
        console.error('EditAssetModal: UID não encontrado para salvar');
        return;
    }

    // Captura o item retornado pelo storage
    const success = assetRepository.updateItem(uid, newState, newIpvu, newObs);

    if (success) {
        //console.log('EditAssetModal: Item atualizado com sucesso');
    } else {
        console.error('EditAssetModal: Falha ao atualizar item');
    }

    this.close();
};

/**
 * Fecha o modal
 * @public
 */
EditAssetModal.prototype.close = function () {
    this.modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Destrava o scroll
    this.removeEvents();
};

/**
 * Instância singleton do EditAssetModal
 * @type {EditAssetModal}
 */
export const editAssetModal = new EditAssetModal();

/**
 * @fileoverview SendMessage - Módulo de Gerenciamento de Envio de Observações
 * 
 * Gerencia a interface e lógica para envio de observações/mensagens com suporte
 * offline. Implementa cache local e sincronização automática quando online.
 * 
 * @module SendMessage
 * @version 1.0.0
 * @author Tiago Possato
 */

/**
 * @typedef {Object} MessagePayload
 * @property {string} uid - Identificador único da mensagem
 * @property {string} location - Localização associada à mensagem
 * @property {string} message - Texto da observação (max 140 caracteres)
 */

/**
 * @typedef {Object} SyncResult
 * @property {string} uid - UID da mensagem sincronizada
 * @property {boolean} success - Indica se a sincronização foi bem-sucedida
 */

import { locationSelector } from './locationSelector.js';
import { backendService } from "./backendService.js"

/**
 * Classe principal do módulo SendMessage
 * @class
 * @public
 */
function SendMessage() {
    /**
     * Chave para armazenamento local das mensagens pendentes
     * @type {string}
     * @private
     */
    this.storageKey = 'pending_messages';

    /**
     * Injeta o HTML necessário no DOM
     * @private
     */
    this.injectHTML();

    /**
     * Configura os eventos do módulo
     * @private
     */
    this.setupEvents();

    /**
     * Tenta sincronizar mensagens pendentes ao iniciar
     * @private
     */
    this.sync();
}

/**
 * Injeta a estrutura HTML necessária para o modal de mensagens
 * @private
 */
SendMessage.prototype.injectHTML = function () {
    const container = document.getElementById('message-area');
    if (!container) return;

    // Botão para abrir o modal (inicialmente oculto)
    if (!document.getElementById('openMessageModalBtn')) {
        container.innerHTML += (
            '<button id="openMessageModalBtn" class="btn btn-gray location-btn" style="display:none;">' +
            'Enviar observação' +
            '</button>'
        );
    }

    if (document.getElementById('modalObs')) return;

    // Overlay interno exclusivo para este módulo
    const localOverlayHtml = `<div id="messageModalOverlay"></div>`;

    const html = `
        <div id="modalObs" class="modal-full">
            <div class="modal-header">
                <h2>Enviar observação</h2>
            </div>
            <form id="modalObsForm" class="modal-body">
                
                <div class="form-group">
                    <label class="text-small" id="obsLocationName"></label>
                    <textarea id="obsText" class="input-modal-edit" rows="5" maxlength="140" placeholder="Digite sua mensagem..."></textarea>
                    <div id="obsCharCount" class="char-count">0 / 140</div>
                </div>
                                
                <div class="modal-footer-btns">
                    <button type="button" id="btnCancelObs" class="btn-modal btn-modal-cancel">Cancelar</button>
                    <button type="button" id="btnSaveObs" class="btn-modal btn-modal-save">ENVIAR</button>
                </div>

            </form>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', localOverlayHtml);
    document.body.insertAdjacentHTML('beforeend', html);
};

/**
 * Configura os eventos do módulo (cliques, input, mudança de localização, etc.)
 * @private
 */
SendMessage.prototype.setupEvents = function () {
    const self = this;

    const textarea = document.getElementById('obsText');
    const charCount = document.getElementById('obsCharCount');
    const btn = document.getElementById('openMessageModalBtn');

    if (btn) {
        btn.onclick = function () {
            self.open();
        };
    }

    // Contador de caracteres em tempo real
    textarea.oninput = () => {
        charCount.textContent = `${textarea.value.length} / 140`;
    };

    document.getElementById('btnCancelObs').onclick = () => self.close();

    document.getElementById('btnSaveObs').onclick = () => {
        const text = textarea.value.trim();
        const location = locationSelector.getSelectedLocation();

        if (!text) {
            self.close();
            return;
        }

        const payload = {
            uid: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            location: location,
            message: text
        };

        self.saveAndSend(payload);
    };

    /**
     * Evento disparado quando a localização é alterada
     * @event locationChanged
     */
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

    /**
     * Evento disparado quando a conexão é restabelecida
     * @event online
     */
    window.addEventListener('online', () => {
        console.log("Conexão restabelecida. Sincronizando observações...");
        self.sync();
    });
};

/**
 * Exibe o botão de envio de observações
 * @public
 */
SendMessage.prototype.showButton = function () {
    const btn = document.getElementById('openMessageModalBtn');
    if (btn) btn.style.display = 'block';
};

/**
 * Oculta o botão de envio de observações
 * @public
 */
SendMessage.prototype.hideButton = function () {
    const btn = document.getElementById('openMessageModalBtn');
    if (btn) btn.style.display = 'none';
};

/**
 * Abre o modal de envio de observações
 * @public
 */
SendMessage.prototype.open = function () {
    const loc = locationSelector.getSelectedLocation();
    if (loc === locationSelector.NONE_SELECTED) {
        console.log("Selecione uma localização primeiro!");
        return;
    }

    document.getElementById('obsLocationName').textContent = `Local: ${loc}`;
    document.getElementById('modalObs').style.display = 'block';
    document.getElementById('messageModalOverlay').style.display = 'block';
    document.getElementById('obsText').focus();
};

/**
 * Fecha o modal de envio de observações
 * @public
 */
SendMessage.prototype.close = function () {
    document.getElementById('modalObs').style.display = 'none';
    document.getElementById('messageModalOverlay').style.display = 'none';
    document.getElementById('obsText').value = '';
    document.getElementById('obsCharCount').textContent = '0 / 140';
};

/**
 * Salva a mensagem localmente e tenta sincronizar imediatamente
 * @param {MessagePayload} payload - Dados da mensagem a ser enviada
 * @private
 */
SendMessage.prototype.saveAndSend = function (payload) {
    // 1. Salva no LocalStorage primeiro (Segurança Offline)
    const pending = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
    pending.push(payload);
    localStorage.setItem(this.storageKey, JSON.stringify(pending));

    this.close();
    this.sync(); // Tenta enviar imediatamente
};

/**
 * Sincroniza mensagens pendentes com o servidor
 * @private
 */
SendMessage.prototype.sync = function () {
    if (!navigator.onLine) return;
    const self = this;

    const pending = JSON.parse(localStorage.getItem(self.storageKey) || '[]');
    if (pending.length === 0) return;

    pending.forEach(item => {
        // Usar backendService com tratamento unificado
        backendService.saveMessage(item)
            .then(function (response) {
                self.removeFromStorage(response);
            })
            .catch(function (error) {
                console.error('Erro saveMessage GAS:', error);
            });
    });
};

/**
 * Remove uma mensagem do armazenamento local após sincronização bem-sucedida
 * @param {string} uid - Identificador único da mensagem a ser removida
 * @private
 */
SendMessage.prototype.removeFromStorage = function (uid) {
    try {
        const rawData = localStorage.getItem(this.storageKey);
        if (!rawData) return;

        let pending = JSON.parse(rawData);

        // Verifica se o parsing resultou em um array válido
        if (!Array.isArray(pending)) {
            throw new Error("Dados no localStorage não são um array.");
        }

        const initialLength = pending.length;
        pending = pending.filter(item => item.uid !== uid);

        // Só atualiza o storage se algo foi realmente removido
        if (pending.length < initialLength) {
            localStorage.setItem(this.storageKey, JSON.stringify(pending));
            console.log(`✅ Mensagem ${uid} sincronizada e removida do cache.`);
        }
    } catch (error) {
        console.error(`❌ Erro ao manipular localStorage para o UID ${uid}:`, error);

        // Opcional: Se os dados estiverem corrompidos, limpa a chave para evitar travamentos infinitos
        if (error instanceof SyntaxError) {
            console.warn("Limpando cache de mensagens corrompido.");
            localStorage.removeItem(this.storageKey);
        }
    }
};

/**
 * Instância singleton do SendMessage
 * @type {SendMessage}
 */
export const sendMessage = new SendMessage();

/**
 * @fileoverview AssetSyncManager - Orquestrador de Sincronização
 * Monitora o repositório e rede para enviar dados ao backend.
 */

import { backendService } from "./backendService.js";
import { assetRepository } from "./assetRepository.js";

/**
 * Constantes de configuração de sincronização
 */
const BATCH_SIZE = 10;
const SYNC_INTERVAL_MS = 2000;
const MAX_RETRIES = 5;
// A cada quantos ciclos itens FAILED são reenfileirados (evita que erros de rede temporários fiquem presos para sempre)
const FAILED_RETRY_CYCLES = 15; // ~30 s com SYNC_INTERVAL_MS = 2000

/**
 * Construtor do AssetSyncManager
 * @param {AssetRepository} repository - Instância do repositório local
 * @constructor
 */
function AssetSyncManager(repository) {
  this.repo = repository;
  this.timer = null;
  this.isSyncing = false;
  this.cycleCount = 0;

  this._setupListeners();
  // Tenta iniciar caso já tenha dados ao carregar a página
  this._startSyncLoop();
}

/**
 * Configura os listeners de eventos de rede e mudanças no repositório
 * @private
 */
AssetSyncManager.prototype._setupListeners = function () {
  const self = this;

  // Listener de rede
  window.addEventListener('online', function () {
    console.log('Online detectado. Reiniciando sync...');
    self.repo.retryFailed(); // Reseta os falhos
    self._startSyncLoop();
  });

  window.addEventListener('offline', function () {
    self._stopSyncLoop();
  });

  // Listener do repositório (quando novos dados são adicionados)
  window.addEventListener('repositoryChanged', function () {
    self._startSyncLoop();
  });
};

/**
 * Inicia o loop de sincronização periódica
 * @private
 */
AssetSyncManager.prototype._startSyncLoop = function () {
  const self = this;
  if (this.timer) return;

  // Dispara evento global de inicio (para UI)
  window.dispatchEvent(new CustomEvent('syncStarted'));

  // Tenta enviar imediatamente sem esperar o primeiro tick do interval
  self._processQueue();

  this.timer = setInterval(function () {
    self._processQueue();
  }, SYNC_INTERVAL_MS);
};

/**
 * Para o loop de sincronização
 * @private
 */
AssetSyncManager.prototype._stopSyncLoop = function () {
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
};

/**
 * Processa a fila de itens pendentes para envio
 * @private
 */
AssetSyncManager.prototype._processQueue = async function () {
  // 1. Guardrails
  if (this.isSyncing || !navigator.onLine) return;

  // Recuperação periódica: itens FAILED podem ter falhado por instabilidade de rede
  // passageira enquanto navigator.onLine permanecia true (ex.: Wi-Fi sem acesso à internet).
  // Reenfileirá-los a cada FAILED_RETRY_CYCLES ciclos garante que nenhuma leitura fique
  // presa indefinidamente dentro da mesma sessão.
  this.cycleCount++;
  if (this.cycleCount >= FAILED_RETRY_CYCLES) {
    this.cycleCount = 0;
    this.repo.retryFailed();
  }

  // 2. Obter lote
  const batch = this.repo.getPendingBatch(BATCH_SIZE);

  if (batch.length === 0) {
    this._stopSyncLoop();
    window.dispatchEvent(new CustomEvent('syncCompleted'));
    return;
  }

  // 3. Iniciar Sincronização
  this.isSyncing = true;
  const batchUids = batch.map(function (i) { return i.uid; });

  // Marca visualmente como 'voando' (em processamento)
  this.repo.markBatchInFlight(batchUids);

  try {
    // 4. Enviar para Backend
    const payload = batch.map(function (i) {
      return {
        uid: i.uid,
        code: parseInt(i.code, 10),
        location: i.location,
        state: i.state,
        ipvu: i.ipvu,
        obs: i.obs,
        source: i.source
      };
    });

    const savedUids = await backendService.saveCodeBatch(payload);

    if (!Array.isArray(savedUids)) throw new Error('Resposta inválida do backend');

    // 5. Sucesso: Atualiza repositório
    this.repo.processSyncSuccess(savedUids);

    // Verifica se algum item do lote não retornou ID (falha parcial)
    const failedInBatch = batchUids.filter(function (uid) {
      return savedUids.indexOf(uid) === -1;
    });

    if (failedInBatch.length > 0) {
      this.repo.processSyncRetry(failedInBatch, MAX_RETRIES);
    }

    window.dispatchEvent(new CustomEvent('batchSynced', {
      detail: { count: savedUids.length }
    }));

  } catch (error) {
    console.error('SyncManager: Falha no lote', error);
    // 6. Falha: Marca todos para retry
    this.repo.processSyncRetry(batchUids, MAX_RETRIES);
  } finally {
    this.isSyncing = false;
  }
};

// Inicializa o manager passando o repositório singleton
export const assetSyncManager = new AssetSyncManager(assetRepository);
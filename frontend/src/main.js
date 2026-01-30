/**
 * @fileoverview Main - Arquivo principal de inicialização da aplicação de inventário
 * 
 * Coordena o carregamento de módulos, configuração de eventos e inicialização do sistema.
 * Implementa carregamento condicional para diferentes ambientes (dev/homolog/prod).
 * 
 * @module Main
 * @version 1.0.0
 * @author Tiago Possato
 */
import './style.css';

/**
 * Carrega módulos de debug condicionalmente baseado no ambiente
 * Remove automaticamente em produção via compilação
 */
if (__IS_DEV__ || __IS_HOMOLOG__) {
  console.log("🐛 Modo DEBUG: Carregando módulo de debug...");
  import('./debug.js')
    .then((module) => {
      // Inicializa o DEBUG
      module.setupDebug();
    })
    .catch((err) => {
      console.error("Falha ao carregar o módulo de debug:", err);
    });
}

/**
 * Carrega mocks do Google Apps Script apenas em ambiente de desenvolvimento
 */
if (__IS_DEV__) {
  console.log("🔧 Modo DEV.🔌 Rodando Local: Carregando Mocks de Sistema...");
  import('./mockGAS.js')
}

// ============================================================================
// IMPORTAÇÕES DE MÓDULOS PRINCIPAIS
// ============================================================================

/**
 * Carregamento dos módulos
 * @typedef {Object} MainModules
 */
import { locationSelector } from './locationSelector.js'
import { scannerManager } from './scannerManager.js';
import { barcodeTable } from './barcodeTable.js'
import { assetRepository } from './assetRepository.js';
import { inventoryBaseline } from './inventoryBaseline.js';
import { processBarcode } from './processBarcode.js';
import { userWarnings } from './userWarnings.js'
import { backendService } from './backendService.js'
import { loadingModal } from './loadingModal.js'
import './assetsNotFound.js';
import './audioManager.js'
import './editAssetModal.js';
import './connectivityManager.js';
import './statsManager.js';
import './messageSendModal.js';
import './assetSyncManager.js';

// ============================================================================
// CONFIGURAÇÃO DE EVENTOS GLOBAIS
// ============================================================================

/**
 * Processa códigos escaneados pelo scanner ou inseridos manualmente
 * @event codeScanned
 * @listens window#codeScanned
 */
window.addEventListener('codeScanned', async function (e) {
  const codigo = e.detail.code;
  if (codigo === null || codigo === undefined) return;

  /**
   * @type {string}
   */
  const selectedLocation = locationSelector.getSelectedLocation();
  await processBarcode(codigo, selectedLocation);
  scannerManager.setFocus();
});

/**
 * Gerencia a visibilidade do scanner baseado na seleção de localização
 * @event locationChanged
 * @listens window#locationChanged
 */
window.addEventListener('locationChanged', function (e) {
  const novoLocal = e.detail.location;

  // Validação básica do parâmetro
  if (novoLocal === null || novoLocal === undefined) return;

  if (novoLocal === locationSelector.NONE_SELECTED) {
    scannerManager.hide();
  } else {
    scannerManager.show();
    scannerManager.setFocus();
  }
});

/**
 * Previne fechamento da página se houver dados pendentes de sincronização
 * @event beforeunload
 * @listens window#beforeunload
 */
window.addEventListener('beforeunload', function (e) {
  e.preventDefault();
  e.returnValue = '';

  const stats = assetRepository.getStats();
  if (stats.pending > 0) {
    userWarnings.printUserWarning('Você tem dados não enviados. Aguarde a sincronização antes de sair.');
  }
});

// ============================================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================================

/**
 * Inicializa a aplicação após o carregamento completo da página
 * @listens window#load
 */
window.addEventListener('load', async () => {
  console.log('🚀 Aplicação de inventário inicializando...');

  try {
    loadingModal.toggle(true, "Buscando dados");

    // Oculta o conteúdo principal durante o carregamento
    document.querySelector('main').style.display = 'none';

    // 1. CARREGAMENTO DOS DADOS (Híbrido: Estático ou Dinâmico)
    let inventoryData;
    let appSettings;

    // estático
    if (__HAS_INVENTORY_DATA__) {
      // Ambiente com dados estáticos (build time)
      inventoryData = JSON.parse(__INVENTORY_DATA__);
      // requisita somente as configurações
      appSettings = await backendService.getAppSettings();
    }
    //dinâmico
    if (!__HAS_INVENTORY_DATA__) {
      // Ambiente com dados dinâmicos (GAS runtime)
      // DISPARO PARALELO
      // DISPARO PARALELO: Otimiza o tempo de resposta
      const [settingsRes, inventoryRes] = await Promise.all([
        backendService.getAppSettings(),
        backendService.getInventoryData()
      ]);

      appSettings = settingsRes;
      inventoryData = inventoryRes;
    }

    console.log('⚙️ Configurações carregadas:', appSettings);

    // --- Estratégia de Manutenção (Kill Switch de Acesso) ---
    // Se a chave existir e for estritamente false, bloqueia o app
    if (appSettings && appSettings.inventory_open === false) {
      console.error('⚠️ Coleta de dados fechada.');

      // Bloqueio visual simples e eficaz
      document.body.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; font-family: sans-serif; background: #f8f9fa; color: #333;">
        <div style="font-size: 80px;">🔐</div>
        <h1 style="margin-top: 20px;">Inventário fechado</h1>
        <p style="max-width: 80%; color: #666;">O prazo para inventário está fechado.</p>
      </div>
      `;

      loadingModal.toggle(false);
      return; // Encerra a execução do listener 'load'
    }

     // Mostra o conteúdo principal depois do carregamento
    document.querySelector('main').style.display = 'block';

    // 2. EXECUTA ESTRATÉGIA DE LIMPEZA (Kill Switch)
    assetRepository.applyMaintenance(appSettings);

    inventoryBaseline.setAssetsDatabase(inventoryData["inventory"]);
    locationSelector.init(inventoryData["locations"]);
    // 4. Renderiza a tabela inicial
    barcodeTable.renderTable();

    console.log('✅ Aplicação inicializada com sucesso');

  } catch (error) {
    console.error('❌ Erro crítico na inicialização:', error);
    userWarnings.printUserWarning('Erro ao carregar dados. Recarregue a página.');
  } finally {
    loadingModal.toggle(false);
  }

});

/**
 * Atualiza a versão do build no footer após o carregamento do DOM
 * @event DOMContentLoaded
 * @listens document#DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('footer-version');
  if (!el) return;

  if (typeof __BUILD_VERSION__ !== 'undefined') {
    el.textContent = __BUILD_VERSION__;
    el.title = `Versão do build: ${__BUILD_VERSION__}`;
  }
});

//  Tratamento de erros globais

// Captura de erros não tratados
window.addEventListener('error', function (e) {
  console.error('Erro global capturado:', e.error);
});

// Captura de rejeições de promises não tratadas
window.addEventListener('unhandledrejection', function (e) {
  console.error('Promise rejeitada não tratada:', e.reason);
});
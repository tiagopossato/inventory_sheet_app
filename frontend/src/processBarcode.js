/**
 * @fileoverview ProcessBarcode - Módulo de Processamento de Códigos de Barras
 * 
 * Coordena o fluxo completo de validação e processamento de códigos de barras.
 * Inclui validações de formato, duplicidade, localização e integração com
 * múltiplos módulos do sistema.
 * 
 * @module ProcessBarcode
 * @version 1.0.0
 * @author Tiago Possato
 */

import { assetRepository } from './assetRepository.js';
import { barcodeTable } from './barcodeTable.js';
import { userWarnings } from './userWarnings.js';
import { audioManager } from './audioManager.js';
import { inventoryBaseline } from './inventoryBaseline.js';
import { remoteInventoryRegistry } from './remoteInventoryRegistry.js';
import { AppModal } from './appModal.js';
import { inputArea } from "./inputArea.js"
import { locationSelector } from './locationSelector.js';

/**
 * @typedef {Object} VerificationResult
 * @property {boolean|string} status - Resultado da verificação (true = válido, false = inválido, 'check' = precisa confirmação)
 * @property {string} [msg] - Mensagem de erro quando status é false
 * @property {string} [local] - Localização encontrada quando status é 'check'
 */

/**
 * @typedef {Object} ProcessResult
 * @property {boolean} success - Indica se o processamento foi bem-sucedido
 * @property {string} [message] - Mensagem descritiva do resultado
 */

/**
 * Processa a entrada de um novo código de barras através de um fluxo completo de validações
 * 
 * O fluxo inclui:
 * 1. Validação da localização selecionada
 * 2. Validação do formato do código de barras (regex)
 * 3. Verificação de duplicidade no armazenamento local
 * 4. Consulta na base de dados de bens patrimoniais
 * 5. Tratamento de localização divergente (com confirmação do usuário)
 * 6. Verificação de conflito de localização remota
 * 7. Adição ao armazenamento e atualização da interface
 * 
 * @param {string} rawValue - O valor cru lido pelo scanner/input
 * @param {string} selectedLocation - O local selecionado no dropdown de localização
 * @returns {Promise<boolean>} true se o código foi processado com sucesso, false caso contrário
 * 
 * @example
 * // Uso básico
 * const success = await processBarcode("2023000123", "Sala 101");
 * if (success) {
 *     console.log("Código processado com sucesso");
 * }
 * 
 * @throws {Error} Em caso de erro não tratado durante o processo
 */
export async function processBarcode(rawValue, selectedLocation, source = "unknown", bypassCheckLocation = false) {
    let observations = '';

    try {
        // 1. Validação de Local Selecionado
        if (!selectedLocation || selectedLocation === locationSelector.NONE_SELECTED) {
            userWarnings.printUserWarning("Selecione uma localização antes de bipar.");
            return false;
        }

        // 2. Validação de Formato (Regex)
        // Aceita anos de 1990 a 2030 seguidos de 6 dígitos
        const regex = /^(199[0-9]|20[0-2][0-9]|2030)\d{6}$/;
        if (!regex.test(rawValue)) {
            audioManager.playError();
            userWarnings.printUserWarning(`Tombamento inválido: ${rawValue}`);
            return false;
        }

        // 3. Validação de Duplicidade no Storage Local (Offline)
        if (await assetRepository.hasItem(rawValue, selectedLocation)) {
            audioManager.playWarning();
            userWarnings.printUserWarning(`${rawValue} já adicionado na lista local`);
            return false;
        }

        // 4. Verificação na Base de Dados de bens
        const retorno = await inventoryBaseline.verifyItem(rawValue, selectedLocation);

        // Tratamento de Respostas

        // 4.1 Bem não encontrado na base de dados
        if (retorno.status === false) {
            audioManager.playError();
            userWarnings.printUserWarning(retorno.msg);
            return false;
        }

        // 4.2 Alerta de Localização Divergente (Aviso, mas permite prosseguir)
        if (bypassCheckLocation === false && retorno.status === 'check') {
            audioManager.playWarning();
            // 1. BLOQUEIA O SCANNER
            inputArea.lock();
            try {
                const userConfirmed = await AppModal.confirm(
                    `⚠️ ATENÇÃO: LOCALIZAÇÃO DIVERGENTE`,
                    `Este bem deveria estar na localidade \n\n` +
                    `📍${retorno.local}\n\n` +
                    `Confirma que o código ${rawValue} está correto?`
                );
                if (!userConfirmed) {
                    userWarnings.printUserWarning(`Cancelado: Item deveria estar em ${retorno.local}`);
                    return false;
                }
            } finally {
                // 2. DESBLOQUEIA O SCANNER APÓS A DECISÃO (ou erro)
                // eslint-disable-next-line no-unused-vars
                try { inputArea.unlock(); } catch (e) { /* ignore */ }
            }
        }
        if (bypassCheckLocation === true && retorno.status === 'check') {
            userWarnings.printUserWarning(`AVISO: ${rawValue} inserido automaticamente. Deveria estar em ${retorno.local}.`);
            observations = `Verificação de localização ignorada`;
        }

        // 5. Verifica se o item já foi encontrado em outra localidade
        const foundLocation = await remoteInventoryRegistry.checkAssetLocation(rawValue);

        if (foundLocation && foundLocation !== selectedLocation) {
            audioManager.playWarning();
            // 1. BLOQUEIA O SCANNER
            inputArea.lock();
            try {
                const userConfirmed = await AppModal.confirm(
                    `⚠️ CONFLITO DE LOCALIZAÇÃO`,
                    `O bem patrimonial '${rawValue}' já está registrado em:\n` +
                    `📍 ${foundLocation}\n\n` +
                    `Você está tentando inserir em:\n` +
                    `📍 ${selectedLocation}\n\n` +
                    `Deseja prosseguir mesmo assim?`
                );
                if (!userConfirmed) {
                    userWarnings.printUserWarning(`Cancelado: Item ${rawValue} encontrado em ${foundLocation}`);
                    return false;
                }
            } finally {
                // 2. DESBLOQUEIA O SCANNER APÓS A DECISÃO (ou erro)
                // eslint-disable-next-line no-unused-vars
                try { inputArea.unlock(); } catch (e) { /* ignore */ }
            }
        }

        // 6. Sucesso: Adiciona ao Storage e atualiza Interface
        const newItem = await assetRepository.addItem(rawValue, selectedLocation, source, observations);

        if (newItem) {
            audioManager.playSuccess();
            // Adiciona à tabela.
            barcodeTable.renderTable(selectedLocation);
            if (bypassCheckLocation === false) {
                userWarnings.clearUserWarning();
            }
            return true;
        }

        return false;
    } catch (err) {
        // garante tratamento de qualquer erro assíncrono/rejeição
        // registra no console para depuração e informa usuário
        // eslint-disable-next-line no-unused-vars
        try { console.error('Error processing barcode', err); } catch (e) { /* ignore */ }
        // eslint-disable-next-line no-unused-vars
        try { audioManager.playError(); } catch (e) { /* ignore */ }
        // eslint-disable-next-line no-unused-vars
        try { userWarnings.printUserWarning('Erro ao processar código de barras. Tente novamente.'); } catch (e) { /* ignore */ }
        // tenta desbloquear scanner caso tenha ficado travado
        // eslint-disable-next-line no-unused-vars
        try { inputArea.unlock(); } catch (e) { /* ignore */ }
        return false;
    }
}

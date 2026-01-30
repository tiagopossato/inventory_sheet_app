/**
 * Módulo de Debug - Sistema de captura e exibição de logs em tempo real
 * @module debug
 * @version 1.0.0
 * @description Fornece uma interface visual para depuração com recursos avançados de log
 */

// Variável de controle interna (fechada no módulo)
let debugTextarea = null;

/**
 * Configura e inicializa o sistema de debug na página
 * @function setupDebug
 * @returns {void}
 * @throws {Error} Se ocorrer erro durante a inicialização
 * @example
 * import { setupDebug } from './debug.js';
 * setupDebug();
 */
export function setupDebug() {
    const container = document.querySelector('#debug-area');
    if (!container) {
        console.warn('Elemento #debug-area não encontrado. Sistema de debug não inicializado.');
        return;
    }

    try {
        container.innerHTML = `
            <div id="debug-container" style="margin-top: 30px; border-top: 5px solid #333; padding: 10px; background: #f0f0f0;">
                <h3 style="margin: 0 0 10px 0;" id="debug-heading" class="sr-only">Console de Debug</h3>
                <div style="margin-bottom: 5px; display: flex; gap: 10px;">
                    <button id="btn-clear-debug" style="padding: 8px 15px; background: #555; color: white; border: none; cursor: pointer;">Limpar Log</button>
                    <button id="btn-download-debug" style="padding: 8px 15px; background: #28a745; color: white; border: none; cursor: pointer;">📥 Baixar Log</button>
                </div>
                <textarea id="debug-console" 
                    style="width: 100%; height: 250px; background: #1e1e1e; color: #00ff00; font-family: monospace; font-size: 11px; padding: 10px; box-sizing: border-box; border: 1px solid #000;" 
                    readonly></textarea>
            </div>
        `;

        // Captura a referência APÓS criar o HTML
        debugTextarea = document.getElementById('debug-console');

        // Adiciona os eventos via JavaScript (evita erro de escopo do onclick)
        document.getElementById('btn-clear-debug').addEventListener('click', clearDebug);
        document.getElementById('btn-download-debug').addEventListener('click', downloadDebugLog);

        console.log("Sistema de Debug Iniciado com Sucesso.");
        console.log(`🚀 Build: ${__BUILD_VERSION__}`);
    } catch (error) {
        console.error('Erro ao inicializar sistema de debug:', error);
        throw new Error(`Falha na inicialização do debug: ${error.message}`);
    }
}

// Guarda referências aos métodos originais do console
/**
 * Referência original ao console.log
 * @type {Function}
 * @private
 */
const originalLog = console.log;

/**
 * Referência original ao console.error
 * @type {Function}
 * @private
 */
const originalError = console.error;

/**
 * Referência original ao console.warn
 * @type {Function}
 * @private
 */
const originalWarn = console.warn;

/**
 * Escreve mensagens formatadas na área de texto do debug
 * @function writeToScreen
 * @param {string} type - Tipo da mensagem ('LOG', 'ERROR', 'WARN')
 * @param {Array} args - Argumentos passados para o console
 * @returns {void}
 * @private
 */
function writeToScreen(type, args) {
    if (!debugTextarea) return;

    const msg = Array.from(args).map(arg => {
        try {
            return (typeof arg === 'object') ? JSON.stringify(arg, null, 2) : String(arg);
        } catch (e) {
            console.log('Erro ao converter objeto para string no debug:', e);
            return '[Objeto complexo/Circular]';
        }
    }).join(' ');

    const time = new Date().toLocaleTimeString();
    const prefix = `[${time}] [${type}]: `;

    debugTextarea.value += prefix + msg + "\n" + "-".repeat(40) + "\n";
    debugTextarea.scrollTop = debugTextarea.scrollHeight;
}

/**
 * Sobrescreve console.log para capturar e exibir logs
 * @function console.log
 * @param {...*} args - Argumentos a serem logados
 * @returns {void}
 */
console.log = function (...args) {
    originalLog.apply(console, args);
    writeToScreen('LOG', args);
};

/**
 * Sobrescreve console.error para capturar e exibir erros
 * @function console.error
 * @param {...*} args - Argumentos de erro a serem logados
 * @returns {void}
 */
console.error = function (...args) {
    originalError.apply(console, args);
    writeToScreen('ERROR', args);
};

/**
 * Sobrescreve console.warn para capturar e exibir alertas
 * @function console.warn
 * @param {...*} args - Argumentos de alerta a serem logados
 * @returns {void}
 */
console.warn = function (...args) {
    originalWarn.apply(console, args);
    writeToScreen('WARN', args);
};

/**
 * Limpa o conteúdo da área de debug após confirmação do usuário
 * @function clearDebug
 * @returns {void}
 * @private
 */
function clearDebug() {
    if (confirm("Tem certeza que deseja limpar todo o log?")) {
        if (debugTextarea) debugTextarea.value = '';
    }
}

/**
 * Gera e faz download do log atual como arquivo de texto
 * @function downloadDebugLog
 * @returns {void}
 * @private
 * @throws {Error} Se não houver conteúdo para download
 */
function downloadDebugLog() {
    if (!debugTextarea || !debugTextarea.value) {
        alert("O log está vazio.");
        return;
    }

    try {
        const filename = `debug_log_${new Date().getTime()}.txt`;
        const blob = new Blob([debugTextarea.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro ao baixar log:', error);
        alert('Erro ao baixar o arquivo de log.');
    }
}

/**
 * Handler global para captura de erros não tratados
 * @function window.onerror
 * @param {string} message - Mensagem de erro
 * @param {string} source - URL do script onde o erro ocorreu
 * @param {number} lineno - Número da linha onde o erro ocorreu
 * @returns {boolean} Retorna false para não prevenir o comportamento padrão
 */
window.onerror = function (message, source, lineno) {
    console.error(`ERRO CRÍTICO: ${message} (${source}:${lineno})`);
    return false;
};

/**
 * Informações de versão do build (variável global esperada)
 * @global
 * @type {string}
 */
// __BUILD_VERSION__ é esperada como variável global

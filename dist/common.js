/**
 * common.js — Utilitários Compartilhados
 * ======================================
 *
 * Funções auxiliares usadas por outros módulos do backend.
 * Inclui helpers para GAS HTML Templates e respostas JSON padronizadas.
 *
 * @module common
 * @author Tiago Possato
 */

// ============================================================
// HTML TEMPLATE HELPER
// ============================================================

/**
 * Inclui o conteúdo de um arquivo HTML como string dentro de um HTML Template.
 *
 * Esta função é chamada dentro de um HTML Template usando a sintaxe de
 * impressão de scriptlets:
 * ```
 * <?!= include_('Style'); ?>
 * ```
 *
 * @param {string} filename - Nome do arquivo .html no projeto (sem a extensão)
 * @returns {string} O conteúdo do arquivo HTML especificado
 */
function include_(filename) {
    return HtmlService
        .createHtmlOutputFromFile(filename)
        .getContent();
}

// ============================================================
// JSON HELPERS — Respostas padronizadas para API REST
// ============================================================

/**
 * Retorna resposta JSON de sucesso no formato `{ result, success: true }`.
 *
 * @param {*} data - Dados do resultado
 * @returns {ContentService.TextOutput} Resposta JSON com MIME type application/json
 */
function jsonSuccess_(data) {
    return ContentService
        .createTextOutput(JSON.stringify({ result: data, success: true }))
        .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Retorna resposta JSON de erro no formato `{ error, success: false }`.
 *
 * @param {string} message - Mensagem descritiva do erro
 * @returns {ContentService.TextOutput} Resposta JSON com MIME type application/json
 */
function jsonError_(message) {
    return ContentService
        .createTextOutput(JSON.stringify({ error: message, success: false }))
        .setMimeType(ContentService.MimeType.JSON);
}

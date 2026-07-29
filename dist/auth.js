/**
 * auth.js — Módulo de Autorização e Identidade
 * =============================================
 *
 * Gerencia a verificação de usuários autorizados e identidade de sessão
 * para o Google Apps Script. Todas as funções são privadas ao backend
 * (sufixo `_`) e chamadas exclusivamente por `public.js`.
 *
 * ## Aba "usuarios_autorizados" (planilha)
 *
 *   Col A: email do usuário
 *   Col B: nome de exibição
 *   Col C: ativo (TRUE/FALSE)
 *
 * @module auth
 * @author Tiago Possato
 */

// ============================================================
// AUTHORIZATION
// ============================================================

/**
 * Verifica se um email está na lista de usuários autorizados.
 * Lê a aba "usuarios_autorizados" (Col A: email, Col B: nome, Col C: ativo).
 * Apenas emails com Col C = TRUE são considerados autorizados.
 *
 * @param {string} email - Email a verificar (ex: "nome@ifc.edu.br")
 * @returns {boolean} `true` se o email existe e está ativo na planilha
 */
function checkAuthorization_(email) {
    if (!email) return false;

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName('usuarios_autorizados');
        if (!sheet) {
            Logger.log('checkAuthorization: aba usuarios_autorizados nao encontrada');
            return false;
        }

        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return false;

        // Col A (email), Col C (ativo)
        const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = 0; i < data.length; i++) {
            if (data[i][0] === email && data[i][2] === true) {
                return true;
            }
        }
        return false;
    } catch (e) {
        Logger.log('checkAuthorization error: ' + e.message);
        return false;
    }
}

/**
 * Valida a requisição do usuário atual da sessão GAS.
 * Usa `Session.getActiveUser().getEmail()` para identificar o usuário
 * e `checkAuthorization_()` para verificar se está autorizado.
 *
 * @throws {Error} Se o email não estiver na lista de autorizados
 */
function authenticateRequest_() {
    const userEmail = Session.getActiveUser().getEmail();
    if (!checkAuthorization_(userEmail)) {
        throw new Error('Acesso negado: ' + userEmail + ' não está na lista de usuários autorizados.');
    }
}



// ============================================================
// getUserName
// ============================================================

/**
 * Extrai o nome de usuário a partir do email da sessão ativa.
 * Retorna a parte antes do `@` ou `'anonimo'` se não houver email.
 *
 * @returns {string} Nome do usuário (ex: "tiago.possato" de "tiago.possato@ifc.edu.br")
 */
function getUserName_() {
  const userEmail = Session.getActiveUser().getEmail();
  return userEmail ? userEmail.split('@')[0] : 'anonimo';
}

import { google } from 'googleapis';

export class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.spreadsheetId = null;
  }

  /**
   * Configura autenticação e ID da planilha
   * @param {Object} credentials - Credenciais da Google API
   * @param {string} spreadsheetId - ID da planilha
   */
  async initialize(credentials, spreadsheetId) {
    try {
      console.log('Inicializando Google Sheets API...');

      // Validação das credenciais
      if (!credentials.private_key || !credentials.client_email) {
        throw new Error('Credenciais incompletas. private_key e client_email são obrigatórios.');
      }

      // Corrige a formatação da chave privada se necessário
      const fixedCredentials = {
        ...credentials,
        private_key: credentials.private_key.replace(/\\n/g, '\n')
      };

      const auth = new google.auth.GoogleAuth({
        credentials: fixedCredentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.auth = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.spreadsheetId = spreadsheetId;

      // Testa a conexão
      await this.testConnection();

      console.log('Google Sheets API inicializada com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar Google Sheets API:', error.message);
      throw error;
    }
  }

  /**
   * Testa a conexão com a planilha
   */
  async testConnection() {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'properties.title'
      });

      console.log(`Conectado à planilha: ${response.data.properties.title}`);
      return true;
    } catch (error) {
      console.error('Erro ao testar conexão:', error.message);
      throw error;
    }
  }

  /**
   * Obtém todas as abas da planilha
   * @returns {Array<Object>} Lista de abas
   */
  async getSheets() {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets.properties'
      });

      return response.data.sheets || [];
    } catch (error) {
      console.error('Erro ao obter abas da planilha:', error.message);
      return [];
    }
  }

  /**
   * Verifica se uma aba existe
   * @param {string} sheetName - Nome da aba
   * @returns {boolean} True se a aba existe
   */
  async sheetExists(sheetName) {
    try {
      const sheets = await this.getSheets();
      return sheets.some(sheet => sheet.properties.title === sheetName);
    } catch (error) {
      console.error('Erro ao verificar existência da aba:', error.message);
      return false;
    }
  }

  /**
   * Obtém dados de uma faixa específica
   * @param {string} range - Faixa no formato 'A1Notation'
   * @returns {Array<Array>} Dados da planilha
   */
  async getRangeData(range) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range
      });

      return response.data.values || [];
    } catch (error) {
      console.error(`Erro ao obter dados da faixa ${range}:`, error.message);
      return [];
    }
  }

  /**
   * Atualiza dados em uma faixa específica
   * @param {string} range - Faixa no formato 'A1Notation'
   * @param {Array<Array>} values - Dados para atualizar
   */
  async updateRangeData(range, values) {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'RAW',
        resource: { values: values }
      });

      return true;
    } catch (error) {
      console.error(`Erro ao atualizar faixa ${range}:`, error.message);
      return false;
    }
  }




  /**
   * Atualiza múltiplas faixas de uma vez
   * @param {Array<Object>} requests - Array de {range, values}
   * @returns {boolean} Sucesso da operação
   */
  async updateMultipleRanges(requests) {
    try {
      const batchUpdateRequest = {
        data: requests.map(req => ({
          range: req.range,
          values: req.values
        })),
        valueInputOption: 'RAW'
      };

      const response = await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: batchUpdateRequest
      });

      console.log(`✅ Batch update realizado: ${requests.length} atualizações`);
      return true;
    } catch (error) {
      console.error('❌ Erro no batch update:', error.message);
      return false;
    }
  }

  /**
   * Adiciona dados ao final da planilha
   * @param {string} range - Faixa no formato 'A1Notation'
   * @param {Array<Array>} values - Dados para adicionar
   * @returns {boolean} Sucesso da operação
   */
  async appendRangeData(range, values) {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: values }
      });

      console.log(`✅ Append realizado: ${values.length} linhas adicionadas`);
      return true;
    } catch (error) {
      console.error('❌ Erro no append:', error.message);
      return false;
    }
  }

}
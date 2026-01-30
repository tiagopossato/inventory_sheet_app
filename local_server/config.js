import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Carrega as variáveis do .env
dotenv.config();

/**
 * Configurações da aplicação
 * Carrega automaticamente as credenciais do arquivo credentials.json
 */

// Para suportar ES modules com __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Config {
  constructor() {
    this.credentials = null;
    this.spreadsheetId = null;
    this.loadConfig();
  }

  /**
   * Carrega as configurações do arquivo credentials.json
   */
  loadConfig() {
    try {
      // Tenta carregar o arquivo credentials.json
      const credentialsPath = path.join(__dirname, 'credentials.json');
      
      if (fs.existsSync(credentialsPath)) {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
        const credentialsData = JSON.parse(credentialsContent);
        
        this.credentials = credentialsData;
        console.log('✅ Credenciais carregadas do arquivo credentials.json');
      } else {
        console.warn('⚠️ Arquivo credentials.json não encontrado. Usando variáveis de ambiente.');
        this.loadFromEnv();
      }

      // Carrega o spreadsheetId das variáveis de ambiente
      this.spreadsheetId = process.env.MOCK_SPREADSHEET_ID;

      this.validateConfig();

    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error.message);
      this.loadFromEnv(); // Fallback para variáveis de ambiente
    }
  }

  /**
   * Carrega configurações das variáveis de ambiente
   */
  loadFromEnv() {
    this.credentials = {
      type: process.env.GOOGLE_TYPE || "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID || "seu-project-id",
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || "seu-private-key-id",
      private_key: process.env.GOOGLE_PRIVATE_KEY ? 
                  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : 
                  "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      client_email: process.env.GOOGLE_CLIENT_EMAIL || "seu-service-account@seu-project.iam.gserviceaccount.com",
      client_id: process.env.GOOGLE_CLIENT_ID || "seu-client-id",
      auth_uri: process.env.GOOGLE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
      token_uri: process.env.GOOGLE_TOKEN_URI || "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_URL || "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL || "",
      universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN || "googleapis.com",
    };
  }

  /**
   * Valida se as configurações mínimas estão presentes
   */
  validateConfig() {
    const errors = [];

    if (!this.credentials.private_key || this.credentials.private_key.includes('...')) {
      errors.push('Chave privada não configurada');
    }

    if (!this.credentials.client_email || this.credentials.client_email.includes('seu-service-account')) {
      errors.push('Email da service account não configurado');
    }

    if (!this.spreadsheetId || this.spreadsheetId.includes('seu-id-da-planilha')) {
      errors.push('ID da planilha não configurado');
    }

    if (errors.length > 0) {
      console.error('❌ Erros de configuração:', errors);
      console.log('\n📝 Por favor, configure:');
      console.log('1. credentials.json com suas credenciais da Google');
      console.log('2. Variável de ambiente SPREADSHEET_ID com o ID da sua planilha');
      console.log('\n💡 Dica: Veja o arquivo credentials.example.json');
    } else {
      console.log('✅ Configurações válidas');
    }
  }

  /**
   * Retorna as configurações para uso externo
   */
  getConfig() {
    return {
      credentials: this.credentials,
      spreadsheetId: this.spreadsheetId
    };
  }
}

// Cria instância única (singleton)
const configInstance = new Config();
const CONFIG = configInstance.getConfig();

export { CONFIG };

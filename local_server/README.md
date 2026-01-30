# Tutorial Completo: Como Obter Credenciais da Google Sheets API

## 📋 Índice
1. [Pré-requisitos](#pré-requisitos)
2. [Passo a Passo no Google Cloud Console](#passo-a-passo-no-google-cloud-console)
3. [Configuração do Projeto](#configuração-do-projeto)
4. [Download das Credenciais](#download-das-credenciais)
5. [Configuração Final](#configuração-final)

---

## 🎯 Pré-requisitos

- Conta Google (Gmail)
- Acesso ao [Google Cloud Console](https://console.cloud.google.com/)
- Planilha Google Sheets existente

---

## 🔧 Passo a Passo no Google Cloud Console

### 1. Acesse o Google Cloud Console
Vá para: [https://console.cloud.google.com/](https://console.cloud.google.com/)

![](https://i.imgur.com/1.png)

### 2. Crie um Novo Projeto
- Clique no seletor de projeto no topo
- Clique em **"Novo Projeto"**
- Nomeie o projeto (ex: `sistema-inventario`)
- Clique em **"Criar"**

![](https://i.imgur.com/2.png)

### 3. Ative a Google Sheets API
- No menu lateral, vá para **"APIs e Serviços"** > **"Biblioteca"**
- Pesquise por **"Google Sheets API"**
- Clique no resultado e depois em **"Ativar"**

![](https://i.imgur.com/3.png)

### 4. Crie uma Service Account
- Vá para **"APIs e Serviços"** > **"Credenciais"**
- Clique em **"Criar Credenciais"** > **"Conta de Serviço"**

![](https://i.imgur.com/4.png)

### 5. Configure a Service Account
 Depending on the data, different visualizations may be more or less appropriate. Common types include:
- **Nome da conta de serviço**: `inventario-service`
- **Descrição**: `Serviço para sistema de inventário`
- **ID da conta de serviço**: Deixe o padrão
- Clique em **"Criar e Continuar"**

![](https://i.imgur.com/5.png)

### 6. Conceda Permissões (Opcional)
- Na tela de permissões, selecione **"Proprietário"** ou **"Editor"**
- Clique em **"Continuar"**

![](https://i.imgur.com/6.png)

### 7. Finalize a Criação
- Pule a etapa de conceder acesso a usuários
- Clique em **"Concluído"**

![](https://i.imgur.com/7.png)

### 8. Crie uma Chave de API
- Na lista de contas de serviço, clique no email criado
- Vá para a aba **"Chaves"**
- Clique em **"Adicionar Chave"** > **"Criar Nova Chave"**
- Selecione **"JSON"**
- Clique em **"Criar"**

![](https://i.imgur.com/8.png)

---

## 💾 Download das Credenciais

### 9. Baixe o Arquivo JSON
- O download do arquivo JSON começará automaticamente
- Salve o arquivo como `credentials.json` na pasta do seu projeto

![](https://i.imgur.com/9.png)

### 10. Estrutura do Arquivo Baixado
Seu `credentials.json` terá esta estrutura:

```json
{
  "type": "service_account",
  "project_id": "seu-projeto-123456",
  "private_key_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "private_key": "-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n",
  "client_email": "inventario-service@seu-projeto-123456.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/inventario-service%40seu-projeto-123456.iam.gserviceaccount.com"
}
```

---

## 🔗 Configuração da Planilha

### 11. Obtenha o ID da Planilha
- Abra sua planilha no Google Sheets
- Olhe a URL: `https://docs.google.com/spreadsheets/d/SEU_ID_DA_PLANILHA/edit`
- Copie o ID que aparece entre `/d/` e `/edit`
- edite o arquivo `.env` na raiz do projeto, adicionando:
```
MOCK_SPREADSHEET_ID=SEU_ID_DA_PLANILHA
```

![](https://i.imgur.com/10.png)

### 12. Compartilhe a Planilha
- Na planilha, clique em **"Compartilhar"**
- Adicione o email da service account (o que está em `client_email`)
- Conceda permissão de **"Editor"**
- Clique em **"Compartilhar"**

![](https://i.imgur.com/11.png)

---

## ⚙️ Configuração Final

### 13. Estrutura Final do Projeto
Seu projeto deve ter estes arquivos:

```
local_server/
├── credentials.json          # Credenciais da Google (NÃO COMMITAR!)
├── server.js
└── package.json
```

---

## 🚨 Solução de Problemas Comuns

### Erro: "The caller does not have permission"
**Solução:** 
- Verifique se compartilhou a planilha com o email da service account
- Aguarde alguns minutos após compartilhar

### Erro: "Invalid credentials"
**Solução:**
- Verifique se o arquivo credentials.json está no formato correto
- Confirme que todas as chaves estão presentes

### Erro: "Unable to parse private key"
**Solução:**
- Verifique se a chave privada está com `\n` em vez de quebras de linha reais
- Use: `private_key.replace(/\\n/g, '\n')`

---

## 📞 Suporte Adicional

### Links Úteis:
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Service Accounts Guide](https://cloud.google.com/iam/docs/service-accounts)

### Comandos de Verificação:
```bash
# Verificar se o servidor está rodando
curl http://localhost:3000/api/health

```

---

## ✅ Checklist Final

- [ ] Projeto criado no Google Cloud Console
- [ ] Google Sheets API ativada
- [ ] Service Account criada
- [ ] Chave JSON baixada e renomeada para `credentials.json`
- [ ] Planilha compartilhada com o email da service account
- [ ] Arquivo `.env` criado com `MOCK_SPREADSHEET_ID`
- [ ] Servidor testado e funcionando
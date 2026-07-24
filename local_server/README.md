# Local Server — Mock do Google Apps Script

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────────────────┐
│                        npm run dev                                   │
│                                                                      │
│  ┌──────────────────────┐    ┌─────────────────────────────────────┐ │
│  │ Vite Dev Server      │    │ Mock Server (Express)               │ │
│  │ https://localhost:    │    │ https://localhost:3000              │ │
│  │   5173               │    │                                     │ │
│  │                      │    │ server.js                           │ │
│  │ frontend/            │    │   ├─ rotas REST (Joi validation)    │ │
│  │   index.html         │    │   ├─ CORS, rate-limit, timeout      │ │
│  │   src/               │    │   └─ inventory-service.js           │ │
│  │     mockGAS.js ──────┼───▶│        ├─ simula SpreadsheetApp     │ │
│  │       (fetch API)    │    │        ├─ simula LockService        │ │
│  │                      │    │        └─ importa inventory-logic   │ │
│  └──────────────────────┘    │                                     │ │
│                              │ backend/inventory-logic.js          │ │
│                              │   └─ funções PURAS (canônico)       │ │
│                              │                                     │ │
│                              │ google-sheets-service.js            │ │
│                              │   └─ Google Sheets API v4            │ │
│                              │       (service account)              │ │
│                              └──────────────┬──────────────────────┘ │
│                                             │                        │
│                                     ┌───────▼────────┐              │
│                                     │ Google Sheets   │              │
│                                     │ (planilha real) │              │
│                                     └────────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

### Fluxo de uma requisição

1. Frontend (`mockGAS.js`) detecta que NÃO está no GAS → substitui `google.script.run` por `fetch()`
2. `fetch('https://<host>:3000/api/save-batch', { body: ... })`
3. `server.js` → valida com Joi → chama `inventoryService.saveCodeBatch(items)`
4. `inventory-service.js` → I/O (lê Sheet via API) → **delega lógica para** `inventory-logic.js`
5. `inventory-logic.js` → função pura processa arrays → retorna resultado estruturado
6. Resposta HTTP → frontend atualiza UI

### Por que o mock server escreve na planilha REAL?

O mock server **não é um mock falso** — ele conecta na mesma planilha Google Sheets
usando uma Service Account. Isso permite testar o fluxo completo (leitura + escrita)
durante o desenvolvimento, com dados reais.

> ⚠️ **Cuidado**: `npm run dev` escreve na planilha de produção se
> `MOCK_SPREADSHEET_ID` apontar para ela. Use uma planilha de teste em homologação.

---

## ▶️ Como usar

```bash
# Subir apenas o mock server (porta 3000, HTTPS)
npm run mock_server

# Subir tudo (Vite + mock server)
npm run dev

# Acessar de outro dispositivo na rede
npm run mock_server -- --host
# Conecte de https://<IP-DA-MÁQUINA>:3000
```

---

## 🔗 Endpoints

| Método | Rota | Query/Body | Retorno |
|--------|------|-----------|---------|
| GET | `/api/health` | — | `{ status, timestamp }` |
| GET | `/api/inventory-data` | `?add_spec=true\|false` | `{ locations, inventory }` |
| GET | `/api/inventory-summary` | `?location=NOME` | `{ locations, assetsFinded }` |
| GET | `/api/not-found-items` | `?location=NOME` (obrigatório) | `[[tombamento], ...]` |
| GET | `/api/app-settings` | — | `{ chave: valor }` |
| POST | `/api/save-batch` | `{ items: [...] }` | `[uid, ...]` |
| POST | `/api/save-message` | `{ uid, location, message }` | `uid` |

### Exemplos

```bash
# Dados do inventário (com specName)
curl -sk https://localhost:3000/api/inventory-data?add_spec=true

# Resumo de uma localidade
curl -sk "https://localhost:3000/api/inventory-summary?location=A00%20-%20BLOCO%20A"

# Salvar leitura
curl -sk -X POST https://localhost:3000/api/save-batch \
  -H "Content-Type: application/json" \
  -d '{"items":[{"uid":"abc-123","code":"123456789","location":"Depósito","state":1,"ipvu":8,"source":"manual"}]}'

# Enviar observação
curl -sk -X POST https://localhost:3000/api/save-message \
  -H "Content-Type: application/json" \
  -d '{"uid":"abc-123","location":"Depósito","message":"Equipamento danificado"}'
```

---

## 🧪 Testes

```bash
# Unitários (funções puras, sem I/O)
node --test tests/inventory-logic.test.js

# Integração (requer mock_server rodando)
node --test tests/api.test.js

# Todos
node --test tests/
```

---

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
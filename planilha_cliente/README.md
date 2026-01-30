# Planilha cliente do aplicativo leitor de inventário

## Visão Geral
Sistema de inventário desenvolvido em Google Apps Script para controle de bens patrimoniais através de leitura de código de barras.

## Configuração

### ID de Deployment
```javascript
const deploymentId = ""; // Substitua pelo ID real do deployment da interface web
```

## Funções de Acesso à Biblioteca

### `doGet()`
**Propósito:** Handler para requisições HTTP GET da interface web

### `getInventoryData()`
**Propósito:** Retorna dados completos do inventário

### `getInventorySummary(targetLocation = null)`
**Propósito:** Retorna resumo do inventário para localização específica

### `getUserName()`
**Propósito:** Obtém nome do usuário atual

### `saveCodeBatch(items)`
**Propósito:** Salva lote de códigos de barras lidos

### `saveMessage(payload)`
**Propósito:** Salva mensagens no sistema

### `getNotFoundItens(targetLocation)`
**Propósito:** Retorna itens não encontrados em determinada localização

### `getAppSettings()`
**Propósito:** Retorna configurações da aplicação

### Funções do Menu da Planilha

#### `onOpen(e)`
**Propósito:** Cria menu personalizado no Google Sheets

**Ações:** Adiciona itens "Exibir link do leitor"

#### `openReader()`
**Propósito:** Exibe modal com QR Code e link direto para o aplicativo

**Funcionalidade:** Gera QR Code dinâmico usando QuickChart.io

#### `mostrarPromptDownload()`
**Propósito:** Gera e inicia download do inventário em formato JSON

**Nota:** Função atualmente comentada no código


# Documentação do Backend - Google Apps Script

## Estrutura de Arquivos

### `appsscript.json`
Arquivo de configuração do projeto Google Apps Script que define metadados, permissões e configurações da aplicação.

### `Código.js`
Arquivo principal contendo a lógica de negócio da aplicação.

### `main.js`
Ponto de entrada principal da aplicação, responsável por inicializar e coordenar as funcionalidades.

## Configuração e Deploy

### Permissões Necessárias
O script requer permissões para:
- Acesso a Google Sheets
- Execução como usuário autenticado
- Operações de leitura/escrita em planilhas

## Documentação das Funções

### Funções de Acesso à Biblioteca

#### `doGet()`
**Propósito:** Ponto de entrada para requisições HTTP GET da interface web

**Retorno:** `HtmlOutput` - Interface HTML da leitora de código de barras

**Parâmetros:** Utiliza título padrão "Leitora de código de barras"

#### `getInventoryData()`
**Propósito:** Obtém dados consolidados do inventário agrupados por localidade

**Retorno:** `Object` - Contém `locations` (metadados) e `inventory` (bens agrupados)

**Estrutura:**
```javascript
{
    locations: Array<{name: string, assetsCount: number}>,
    inventory: Array<{location: string, assets: number[]}>
}
```

#### `getInventorySummary(targetLocation)`
**Propósito:** Gera resumo do inventário baseado nas leituras realizadas

**Parâmetros:** `targetLocation` (opcional) - Filtra por localidade específica

**Retorno:** `Object` - Resumo com estatísticas e mapeamento de bens encontrados

**Estrutura:**
```javascript
{
    locations: Array<LocationSummary>,
    assetsFinded: Array<AssetMapping>
}
```

#### `getUserName()`
**Propósito:** Obtém o nome do usuário atual baseado no email

**Retorno:** `string` - Nome do usuário ou 'anonimo' se não identificado

#### `saveCodeBatch(items)`
**Propósito:** Salva/atualiza lote de itens na planilha "leituras" de forma segura

**Parâmetros:** `items` - Array de objetos com dados dos itens

**Retorno:** `Array<string>` - UIDs dos itens persistidos

**Características:** Operação idempotente com lock para evitar conflitos

#### `saveMessage(payload)`
**Propósito:** Salva observações na aba 'observacoes'

**Parâmetros:** `payload` - Objeto contendo UID, localidade e mensagem

**Retorno:** `string` - UID da mensagem salva

#### `getNotFoundItens(targetLocation)`
**Propósito:** Obtém lista de itens não encontrados filtrados por localidade

**Parâmetros:** `targetLocation` - Nome da localidade (obrigatório)

**Retorno:** `Array<Array<string>>` - Lista de [Tombamento, Descrição]

#### `getAppSettings()`
**Propósito:** Lê configurações da aba 'app_config'

**Retorno:** `Object` - Configurações em formato chave-valor

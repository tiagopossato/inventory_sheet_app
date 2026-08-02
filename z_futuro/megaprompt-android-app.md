# Megaprompt: App Android de Inventário Patrimonial com Google Sheets

> **Instrução para o Google AI Studio:** Use este documento como especificação completa para gerar um aplicativo Android nativo (Kotlin + Jetpack Compose). Cada seção contém regras de negócio exatas, algoritmos, estruturas de dados e contratos de API extraídos do código-fonte do app web existente. **Não invente regras — implemente exatamente o que está especificado.**

---

## 1. Visão Geral e Arquitetura

### 1.1 Propósito

Aplicativo mobile-first para contagem de inventário físico patrimonial via leitura de código de barras. Operadores escaneiam códigos de barras de bens patrimoniais em salas/locais, verificam se pertencem àquela localização, e os dados são sincronizados com uma planilha Google Sheets central.

### 1.2 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| UI | Kotlin + Jetpack Compose + Material Design 3 |
| Persistência local | Room Database (SQLite) |
| Rede | Retrofit 2 + OkHttp + Google Apps Script API |
| Autenticação | OAuth 2.0 (Google Sign-In) para Apps Script API |
| Sincronização | WorkManager (PeriodicWorkRequest) |
| Arquitetura | MVVM + Repository Pattern |
| DI | Hilt (Dagger) |
| Navegação | Jetpack Navigation Compose |
| Scanner | Keyboard wedge (OTG/Bluetooth) via dispatchKeyEvent |

### 1.3 Arquitetura de Dados

```
┌─────────────────────────────────────────────────┐
│                  App Android                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Scanner  │  │ UI Layer │  │  ViewModels   │  │
│  │ (OTG +   │  │ (Compose │  │  (StateFlow)  │  │
│  │  Manual) │  │  Screens)│  │               │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │             │               │           │
│       └──────┬──────┘               │           │
│              ↓                      ↓           │
│  ┌──────────────────────────────────────────┐   │
│  │            Repository Layer               │   │
│  │  AssetRepo  InventoryRepo  RegistryRepo  │   │
│  └──────┬──────────────┬────────────────────┘   │
│         ↓              ↓                        │
│  ┌──────────┐  ┌───────────────┐               │
│  │   Room   │  │  Retrofit +   │               │
│  │  (Local) │  │  GAS API      │               │
│  └──────────┘  └───────┬───────┘               │
└─────────────────────────┼──────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│         Google Apps Script API                   │
│  ┌──────────────────────────────────────────┐   │
│  │  getInventoryData  saveCodeBatch         │   │
│  │  getAppSettings    saveMessage           │   │
│  │  getInventorySummary  getNotFoundItens   │   │
│  └──────────────────────┬───────────────────┘   │
└─────────────────────────┼──────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│           Google Sheets (Planilha)               │
│  inventario │ leituras │ observacoes │ app_config│
│  localidades│ nao_encontrados_geral              │
└─────────────────────────────────────────────────┘

> **Nota sobre abas da planilha:** A aba `localidades` contém um resumo pré-computado (nome, totalAssets, assetsFindedCount, missingAssets) mantido por processos externos à planilha — o app apenas faz leitura. A aba `nao_encontrados_geral` contém itens que não foram encontrados em localidades específicas e é gerenciada manualmente na planilha.
```

### 1.4 Fluxo Principal de Uso

1. Operador abre o app → autentica com Google OAuth
2. App carrega configurações (`app_config`) e inventário base
3. Se `inventory_open === false` → tela de bloqueio. Fim.
4. Operador seleciona uma localização no dropdown
5. Operador escaneia códigos de barras (scanner OTG ou input manual)
6. Cada código passa pelo pipeline de validação
7. Itens válidos são salvos localmente (Room) e sincronizados com Sheets
8. Dashboard mostra progresso: total, sincronizados, pendentes, falhas
9. Operador pode editar estado/ipvu/obs de cada item
10. Operador pode ver itens não encontrados e adicioná-los
11. Operador pode enviar observações sobre a localização

---

## 2. Backend — Google Apps Script (IMUTÁVEL)

**IMPORTANTE:** O backend NÃO será modificado. O app Android deve se comunicar com ele via Google Apps Script API (`script.projects.deployments.create` e `scripts.run`).

### 2.1 Configuração do Projeto GAS

```json
{
  "timeZone": "America/Sao_Paulo",
  "webapp": { "executeAs": "USER_ACCESSING", "access": "ANYONE" },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

### 2.2 Funções Expostas (6 endpoints)

O app Android deve chamar estas funções via Apps Script API REST (`POST https://script.googleapis.com/v1/scripts/{scriptId}:run`).

#### 2.2.1 `getInventoryData(addSpec = true)`
- **Descrição:** Retorna localizações e inventário completo
- **Parâmetro:** `addSpec` — se true, inclui `name` (especificação) em cada asset
- **Planilha:** Aba `inventario`, colunas D-L a partir da linha 2
- **Retorno:**
```json
{
  "locations": [
    { "name": "A00 - BLOCO A", "assetsCount": 42 }
  ],
  "inventory": [
    {
      "location": "A00 - BLOCO A",
      "assets": [
        { "code": "2024000123", "name": "COMPUTADOR DELL OPTIPLEX" }
      ]
    }
  ]
}
```
- **Dados brutos da planilha:**
  - Coluna D (índice 0): Nome da localidade
  - Coluna F (índice 2): Número de tombamento (parseInt)
  - Coluna L (índice 8): Especificação (trim, max 140 caracteres)
- **Regras:** Localidades ordenadas por `localeCompare('pt-BR')`. Linhas com local vazio ou asset NaN são ignoradas.

#### 2.2.2 `getAppSettings(params)`
- **Descrição:** Configurações chave-valor com cache de 60s
- **Parâmetro:** `{ _forceRefresh: true/false }` para furar o cache
- **Planilha:** Aba `app_config`, colunas A-B a partir da linha 2
- **Retorno:**
```json
{
  "inventory_open": false,
  "min_valid_date": "2026-01-01",
  "app_version": "2026.07.26-001"
}
```
- **Tipagem automática:**
  - Valores `Date` → ISO string `YYYY-MM-DD`
  - Strings `"true"`/`"TRUE"` → boolean `true`
  - Strings `"false"`/`"FALSE"` → boolean `false`
  - Demais → string ou number original

#### 2.2.3 `getInventorySummary(targetLocation = null)`
- **Descrição:** Resumo de leituras agrupadas por localidade
- **Parâmetro:** `targetLocation` — string opcional para filtrar
- **Planilhas:** Aba `leituras` (colunas B-D) + Aba `localidades` (colunas A-D)
- **Retorno:**
```json
{
  "locations": [
    { "name": "Sala 101", "totalAssets": 50, "assetsFindedCount": 42, "missingAssets": 8 }
  ],
  "assetsFinded": [
    { "location": "Sala 101", "assets": [2024000123, 2024000124] }
  ]
}
```
- **Regras:** `groupLeiturasByLocation` agrupa códigos por localidade. Locations ordenadas por `localeCompare('pt-BR', {numeric: true})`.

#### 2.2.4 `saveCodeBatch(items)`
- **Descrição:** Salva/atualiza um lote de leituras. **IDEMPOTENTE** — se UID já existe, atualiza a linha; senão, faz append.
- **Parâmetro:** Array de objetos:
```json
[
  {
    "uid": "m2k3n4o5p6q7",
    "code": "2024000123",
    "location": "Sala 101",
    "state": 3,
    "ipvu": 8,
    "obs": "Danificado na quina",
    "source": "otg"
  }
]
```
- **Planilha:** Aba `leituras`, 9 colunas (A-I):
  - A: `uid` (string)
  - B: `data` (dd/MM/yyyy HH:mm:ss, horário do servidor)
  - C: `code` (string)
  - D: `location` (string)
  - E: `user` (email sem @domínio)
  - F: `state` (number)
  - G: `ipvu` (number)
  - H: `obs` (string)
  - I: `source` (string)
- **Lock:** `LockService.getScriptLock()` com timeout 30s. Se ocupado, lança erro "Servidor ocupado. Tente novamente."
- **Cache UID→linha:** O backend mantém índice em memória para evitar ler a planilha inteira a cada chamada. Se cache ficar stale (UID na linha cacheada diferente do esperado), invalida e recria.
- **Retorno:** Array de strings — todos os UIDs processados com sucesso
- **IMPORTANTE:** O app deve enviar `code` como **string**, não number, para preservar zeros à esquerda. A entidade `Asset.code` no Room é `String`, e o campo `code` no JSON deve ser string ao chamar `saveCodeBatch`.

#### 2.2.5 `saveMessage(payload)`
- **Descrição:** Salva observação com deduplicação. Se UID já existe, retorna sem escrever.
- **Parâmetro:** `{ uid, location, message }`
- **Planilha:** Aba `observacoes`, 5 colunas: UID, Data, Location, Aferidor, Message
- **Retorno:** `uid` (string)

#### 2.2.6 `getNotFoundItens(targetLocation)`
- **Descrição:** Lista itens não encontrados para uma localidade
- **Parâmetro:** `targetLocation` — obrigatório
- **Planilha:** Aba `nao_encontrados_geral`, colunas A-C a partir da linha 3 (A=localidade, B=tombamento, C=(não usado))
- **Retorno:** `[["2024000999"], ["2024000888"]]` — array de arrays com 1 elemento (tombamento)
- **Timeout no frontend original:** 25 segundos

### 2.3 Como chamar a Apps Script API (OAuth 2.0)

O app Android deve:
1. Usar Google Sign-In para obter token OAuth
2. Escopo necessário: `https://www.googleapis.com/auth/script.external_request` e `https://www.googleapis.com/auth/spreadsheets`
3. Chamar `POST https://script.googleapis.com/v1/scripts/{SCRIPT_ID}:run`
4. Body:
```json
{
  "function": "getInventoryData",
  "parameters": [true],
  "devMode": false
}
```
5. A resposta vem no campo `response.result`

**NOTA:** O SCRIPT_ID deve ser configurável (extraído de `appsscript.json` ou via variável de ambiente/build config).

---

## 3. Modelo de Dados Local (Room Database)

### 3.1 Entidade: Asset

Tabela: `assets` — itens escaneados pelo operador

```kotlin
@Entity(tableName = "assets")
data class Asset(
    @PrimaryKey
    val uid: String,                    // Date.now().toString(36) + random
    val code: String,                   // Código de barras como string para preservar zeros à esquerda
    val location: String,               // trimmed, max 200 chars
    val source: String,                 // "otg" | "manual_input" | "not_found_list" | "unknown", max 24 chars
    val state: Int,                     // 0-4 (default: 3 = Bom)
    val ipvu: Int,                      // 0, 1, 2, 5, 8, 10 (default: 8)
    val obs: String,                    // max 140 chars, default ""
    val status: AssetStatus,            // PENDING | IN_FLIGHT | SYNCED | FAILED
    val retryCount: Int,                // default 0
    val createdAt: Long,                // System.currentTimeMillis()
    val updatedAt: Long                 // System.currentTimeMillis()
)

enum class AssetStatus {
    PENDING,    // Aguardando sincronização
    IN_FLIGHT,  // Sincronização em andamento
    SYNCED,     // Sincronizado com sucesso
    FAILED      // Falhou após máximo de tentativas
}
```

### 3.2 Entidade: RegistryEntry

Tabela: `registry` — cache de leituras remotas (cross-user)

```kotlin
@Entity(tableName = "registry")
data class RegistryEntry(
    @PrimaryKey
    val code: String,                   // Código normalizado (trim + uppercase)
    val location: String,               // Localização onde foi encontrado
    val updatedAt: Long                 // Timestamp da última atualização
)
```

### 3.3 Entidade: PendingMessage

Tabela: `pending_messages` — observações pendentes de envio

```kotlin
@Entity(tableName = "pending_messages")
data class PendingMessage(
    @PrimaryKey
    val uid: String,                    // "msg_" + timestamp + "_" + random
    val location: String,
    val message: String                 // max 140 chars
)
```

### 3.4 Entidade: InventoryLocation

Tabela: `inventory_locations` — localizações disponíveis

```kotlin
@Entity(tableName = "inventory_locations")
data class InventoryLocation(
    @PrimaryKey
    val name: String,                   // Nome da localidade
    val assetsCount: Int                // Quantidade de bens na localidade
)
```

### 3.5 Entidade: InventoryAsset

Tabela: `inventory_assets` — base mestre de bens por localidade

```kotlin
@Entity(
    tableName = "inventory_assets",
    indices = [Index("code")],
    foreignKeys = [ForeignKey(
        entity = InventoryLocation::class,
        parentColumns = ["name"],
        childColumns = ["location"],
        onDelete = ForeignKey.CASCADE
    )]
)
data class InventoryAsset(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val code: String,                   // Número de tombamento (string para preservar zeros à esquerda)
    val location: String,               // FK → inventory_locations.name
    val name: String                    // Especificação (max 140 chars)
)
```

### 3.6 DAO — Operações Principais

#### AssetDao

```kotlin
@Dao
interface AssetDao {
    @Query("SELECT * FROM assets ORDER BY createdAt DESC")
    fun getAll(): Flow<List<Asset>>

    @Query("SELECT * FROM assets WHERE location = :location ORDER BY createdAt DESC")
    fun getByLocation(location: String): Flow<List<Asset>>

    @Query("SELECT * FROM assets WHERE code = :code AND location = :location LIMIT 1")
    suspend fun findByCodeAndLocation(code: String, location: String): Asset?

    @Query("SELECT * FROM assets WHERE uid = :uid LIMIT 1")
    suspend fun findByUid(uid: String): Asset?

    @Query("SELECT * FROM assets WHERE status = 'PENDING' LIMIT :batchSize")
    suspend fun getPendingBatch(batchSize: Int): List<Asset>

    @Query("SELECT COUNT(*) FROM assets")
    suspend fun totalCount(): Int

    @Query("SELECT COUNT(*) FROM assets WHERE status = :status")
    suspend fun countByStatus(status: String): Int

    @Query("UPDATE assets SET status = 'IN_FLIGHT' WHERE uid IN (:uids)")
    suspend fun markInFlight(uids: List<String>)

    @Query("UPDATE assets SET status = 'SYNCED', retryCount = 0, updatedAt = :now WHERE uid IN (:uids)")
    suspend fun markSynced(uids: List<String>, now: Long)

    @Query("""
        UPDATE assets SET
          status = CASE WHEN retryCount + 1 >= :maxRetries THEN 'FAILED' ELSE 'PENDING' END,
          retryCount = retryCount + 1,
          updatedAt = :now
        WHERE uid IN (:uids) AND status = 'IN_FLIGHT'
    """)
    suspend fun markRetry(uids: List<String>, maxRetries: Int, now: Long)

    @Query("UPDATE assets SET status = 'PENDING', retryCount = 0, updatedAt = :now WHERE status = 'FAILED'")
    suspend fun retryAllFailed(now: Long): Int

    @Query("DELETE FROM assets WHERE createdAt < :minDate")
    suspend fun deleteOlderThan(minDate: Long): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(asset: Asset)

    @Update
    suspend fun update(asset: Asset)

    @Query("UPDATE assets SET state = :state, ipvu = :ipvu, obs = :obs, status = 'PENDING', retryCount = 0, updatedAt = :now WHERE uid = :uid")
    suspend fun updateItem(uid: String, state: Int, ipvu: Int, obs: String, now: Long): Int
}

#### RegistryDao — Cache de leituras remotas (cross-user)

```kotlin
@Dao
interface RegistryDao {
    @Query("SELECT * FROM registry WHERE code = :code LIMIT 1")
    suspend fun findByCode(code: String): RegistryEntry?

    @Query("SELECT location FROM registry WHERE code = :code LIMIT 1")
    suspend fun findLocationByCode(code: String): String?

    @Query("SELECT * FROM registry")
    suspend fun getAll(): List<RegistryEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<RegistryEntry>)

    @Query("DELETE FROM registry")
    suspend fun clearAll()

    @Query("DELETE FROM registry WHERE updatedAt < :minTimestamp")
    suspend fun deleteOlderThan(minTimestamp: Long): Int
}
```

#### MessageDao — Observações pendentes de envio

```kotlin
@Dao
interface MessageDao {
    @Query("SELECT * FROM pending_messages")
    suspend fun getAll(): List<PendingMessage>

    @Query("SELECT * FROM pending_messages WHERE uid = :uid LIMIT 1")
    suspend fun findByUid(uid: String): PendingMessage?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(message: PendingMessage)

    @Delete
    suspend fun delete(message: PendingMessage)

    @Query("DELETE FROM pending_messages WHERE uid = :uid")
    suspend fun deleteByUid(uid: String)

    @Query("SELECT COUNT(*) FROM pending_messages")
    suspend fun count(): Int
}
```

#### InventoryLocationDao — Localizações disponíveis

```kotlin
@Dao
interface InventoryLocationDao {
    @Query("SELECT * FROM inventory_locations ORDER BY name COLLATE LOCALIZED ASC")
    fun getAll(): Flow<List<InventoryLocation>>

    @Query("SELECT * FROM inventory_locations WHERE name = :name LIMIT 1")
    suspend fun findByName(name: String): InventoryLocation?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(locations: List<InventoryLocation>)

    @Query("DELETE FROM inventory_locations")
    suspend fun clearAll()

    @Query("SELECT COUNT(*) FROM inventory_locations")
    suspend fun count(): Int
}
```

#### InventoryAssetDao — Base mestre de bens por localidade

```kotlin
@Dao
interface InventoryAssetDao {
    @Query("SELECT * FROM inventory_assets WHERE code = :code LIMIT 1")
    suspend fun findByCode(code: String): InventoryAsset?

    @Query("SELECT * FROM inventory_assets WHERE location = :location")
    suspend fun getByLocation(location: String): List<InventoryAsset>

    @Query("SELECT name FROM inventory_assets WHERE code = :code LIMIT 1")
    suspend fun getAssetName(code: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(assets: List<InventoryAsset>)

    @Query("DELETE FROM inventory_assets")
    suspend fun clearAll()
}
```

---

## 4. Interface do Usuário — Telas (Jetpack Compose)

### 4.1 Princípios de Design

- **Material Design 3** com tema dinâmico (Material You)
- **Mobile-first** — otimizado para telefones, suporte a tablets com layouts adaptativos
- **Português (pt-BR)** para todo texto visível ao usuário
- **Alto contraste** e alvos de toque ≥ 48dp
- **Suporte a landscape e portrait**

### 4.2 Tela Principal (`MainScreen`)

Estrutura vertical com scroll:

```
┌─────────────────────────────────┐
│ [Banner Offline - vermelho]     │  ← Só visível quando offline
├─────────────────────────────────┤
│ [Dropdown de Localização     ▼] │  ← LocationSelector
├─────────────────────────────────┤
│ [Input manual de código      ]  │  ← TextField + botão Limpar
│ ☐ Ignorar verificação de loc?  │  ← Checkbox bypass
├─────────────────────────────────┤
│ ⚠ Mensagem de aviso             │  ← Snackbar/toast (12.5s auto-dismiss)
├─────────────────────────────────┤
│ [Não encontrados] [Enviar obs]  │  ← Botões condicionais
├─────────────────────────────────┤
│ Tabela de Itens Escaneados      │
│ ┌─────────────────────────────┐ │
│ │ St  Patrimônio   Desc   Ação│ │
│ │ ✅ 2024000123  PC DELL  [✏]│ │  ← Paginada, 10 por página
│ │ ⏳ 2024000124  MONITOR  [✏]│ │
│ │ ❌ 2024000125  TECLADO  [✏]│ │
│ └─────────────────────────────┘ │
│ Itens: 3  Página 1/1  [Ant][Próx]│
├─────────────────────────────────┤
│ 📊 Dashboard de Stats           │
│ ┌─────────────────────────────┐ │
│ │ 🔁 Resumo Geral             │ │
│ │ Sala 101  50 total ✅42 ❌8 │ │
│ │ Sala 102  30 total ✅28 ❌2 │ │
│ ├─────────────────────────────┤ │
│ │ Lidos: 42  Sinc: 40         │ │
│ │ Pendentes: 1  Falhas: 1 🔄  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### Comportamentos:

1. **Dropdown de localização:**
   - Primeira opção: "Selecione uma localização" (valor sentinela: `-1`)
   - Demais opções: `"Sala 101 [42 itens]"` — mostra nome + contagem de assets
   - Ao selecionar: habilita scanner, mostra tabela filtrada, mostra botões de ação
   - Ao voltar para "Selecione...": esconde scanner e botões, limpa filtro

2. **Input manual:**
   - `TextField` com `keyboardType = NumberPassword` (para evitar sugestões)
   - Placeholder: "Código (10 dig)"
   - Ao pressionar Enter: trim, valida duplicata (debounce 3s), dispara pipeline
   - Botão "Limpar" ao lado para resetar o campo
   - **Scanner lock:** Quando um modal de confirmação está aberto, o input é desabilitado (`enabled = false`)

3. **Checkbox "Ignorar verificação de localização?":**
   - Quando marcado, suprime o modal de confirmação de localização divergente
   - O item ainda é processado, mas com aviso silencioso e source marcado com "+bypassCheckLocation"

4. **Botões de ação** (só visíveis quando localização válida selecionada):
   - "Não encontrados" → abre `NotFoundScreen`
   - "Enviar observação" → abre `MessageScreen`

5. **Tabela paginada:**
   - 10 itens por página
   - Colunas: Status (ícone), Patrimônio (code), Descrição curta (nome do asset), Ação (botão Editar ✏)
   - Ícones de status: ✅ SYNCED, 🔄 IN_FLIGHT, ❌ FAILED, ⏳ PENDING
   - Célula de localização é clicável → muda o dropdown de localização
   - Ordenação: mais recentes primeiro (por `createdAt DESC`)
   - "Anterior" / "Próximo" para navegar entre páginas

6. **Dashboard de Stats:**
   - Card "Resumo Geral": ícone de sincronização (🔁 girando ao carregar, ✅ quando idle) + tabela de localizações com total/encontrados/faltantes
   - Linha clicável por localização → seleciona a localização e rola para o topo
   - Cards de sincronização: Total Lidos, Sincronizados (verde), Pendentes (amarelo, destaque se > 0), Falhas (vermelho, destaque se > 0)
   - Card de Falhas é clicável → chama `retryAllFailed()`

### 4.3 Tela de Edição (`EditScreen`)

Bottom sheet ou tela cheia (modal) com formulário:

```
┌─────────────────────────────────┐
│ Editar Item                     │
├─────────────────────────────────┤
│ Tombamento                      │
│ ┌─────────────────────────────┐ │
│ │ 2024000123        (readonly)│ │
│ └─────────────────────────────┘ │
│ Especificação                   │
│ COMPUTADOR DELL OPTIPLEX  (RO)  │
│ Localização                     │
│ Sala 101                   (RO) │
│                                 │
│ Estado do Bem                [▼]│
│ [ Bom (3)                  ]    │
│                                 │
│ Vida Útil Estimada          [▼] │
│ [ 8 anos                   ]    │
│                                 │
│ Observações                     │
│ ┌─────────────────────────────┐ │
│ │ Notas adicionais...         │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Cancelar]    [Salvar Alterações]│
└─────────────────────────────────┘
```

#### Valores do select "Estado do Bem":
| Valor | Label |
|---|---|
| 0 | Péssimo |
| 1 | Ruim |
| 2 | Regular |
| 3 | Bom (default) |
| 4 | Excelente |

#### Valores do select "Vida Útil Estimada":
| Valor | Label |
|---|---|
| 0 | 0 anos |
| 1 | 1 ano |
| 2 | 2 anos |
| 5 | 5 anos |
| 8 | 8 anos (default) |
| 10 | 10 anos |

#### Regras:
- Campos readonly: tombamento, especificação (busca do `inventoryBaseline.getAssetName(code)`), localização
- Ao salvar: chama `assetRepository.updateItem(uid, state, ipvu, obs)`
- Ao salvar, o status do item volta automaticamente para **PENDING** (com `retryCount = 0`) para que seja ressincronizado com a planilha. O item aparecerá como ⏳ na tabela até o próximo ciclo de sync.
- Se falhar: Snackbar "Falha ao salvar alterações. Tente novamente.", mantém tela aberta
- Se sucesso: fecha tela, item volta para status PENDING para ressincronizar

### 4.4 Tela de Itens Não Encontrados (`NotFoundScreen`)

Modal full-screen:

```
┌─────────────────────────────────┐
│ Itens Não Encontrados   [FECHAR]│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ #  Tombo    Descrição  Ação │ │
│ │ 1  2024000999  MONITOR  [Adc]│ │
│ │ 2  2024000888  TECLADO  [Adc]│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

#### Comportamento:
1. Busca itens via `getNotFoundItens(location)` com timeout de 25s
2. Mostra loading durante a busca ("⏳ Consultando planilha ...")
3. Se lista vazia: Snackbar "Nenhum item pendente para {local}! Caso não apareça na sua tabela, foi encontrado por outro usuário."
4. Se offline: Snackbar "Sem conexão com a internet. Verifique sua conectividade."
5. Botão "Adicionar" em cada linha: abre diálogo de confirmação "Deseja marcar o item {code} como encontrado?". Se confirmado, dispara o pipeline como se fosse um scan (source = "not_found_list"). Remove a linha da tabela.
6. Se tabela ficar vazia após remoções, fecha o modal
7. Scanner é **bloqueado** enquanto o modal está aberto

### 4.5 Tela de Observação (`MessageScreen`)

Modal ou bottom sheet:

```
┌─────────────────────────────────┐
│ Enviar observação               │
├─────────────────────────────────┤
│ Local: Sala 101                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Digite sua mensagem...      │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│ 0 / 140                         │
│                                 │
│ [Cancelar]              [ENVIAR]│
└─────────────────────────────────┘
```

#### Regras:
- Contador de caracteres em tempo real (0 / 140)
- Max 140 caracteres
- Se vazio e clicar ENVIAR: apenas fecha
- Salva localmente primeiro (Room `pending_messages`), depois tenta sync
- Se offline: salva localmente, tenta enviar quando conexão restaurar

### 4.6 Diálogo de Confirmação (`ConfirmDialog`)

Diálogo customizado (não `AlertDialog` padrão — implementação própria):

```
┌──────────────────────────────────┐
│                                  │
│  ⚠️ ATENÇÃO: LOCALIZAÇÃO        │
│  DIVERGENTE                      │
│                                  │
│  Este bem deveria estar na       │
│  localidade                      │
│                                  │
│  📍 Sala 102                     │
│                                  │
│  Confirma que o código           │
│  2024000123 está correto?        │
│                                  │
│  [Cancelar]    [Confirmar]       │
└──────────────────────────────────┘
```

#### Regras:
- Apenas um diálogo por vez (proteção contra duplicação)
- Scanner é bloqueado enquanto visível
- Scanner é desbloqueado no `finally` (garantido)
- Título e corpo suportam quebras de linha (`\n`)

### 4.7 Banner de Offline

- Fixo no topo, fundo vermelho
- Texto: **"OFFLINE: Dados salvos localmente."**
- Visível apenas quando `!isOnline`
- Dispara eventos para pausar/retomar sincronização

### 4.8 Tela de Bloqueio (Kill Switch)

Quando `appSettings.inventory_open === false`:

```
┌──────────────────────────────────┐
│                                  │
│             🔐                   │
│                                  │
│     Inventário fechado           │
│                                  │
│  O prazo para inventário está    │
│  fechado.                        │
│                                  │
└──────────────────────────────────┘
```

- Remove toda a UI principal
- Não carrega nada além desta tela
- Verificado logo após carregar appSettings na inicialização

### 4.9 Loading

- Overlay com fundo semi-transparente
- Texto central: "⏳ Consultando planilha ..." (customizável)
- Usado durante: inicialização, busca de itens não encontrados

---

## 5. Pipeline de Processamento de Barcode

### 5.1 Algoritmo Completo

```kotlin
suspend fun processBarcode(
    rawValue: String,
    selectedLocation: String,
    source: String = "unknown",
    bypassCheckLocation: Boolean = false
): ProcessResult {
    // STEP 1: Validar localização selecionada
    if (selectedLocation == NONE_SELECTED || selectedLocation.isBlank()) {
        return ProcessResult.Error("Selecione uma localização antes de bipar.")
    }

    // STEP 2: Validar formato (Regex)
    val regex = Regex("^(199[0-9]|20[0-2][0-9]|2030)\\d{6}$")
    if (!regex.matches(rawValue)) {
        playError()
        return ProcessResult.Error("Tombamento inválido: $rawValue")
    }

    // STEP 3: Verificar duplicidade local
    val code = rawValue  // Mantém como String (código de barras pode ter zeros à esquerda)
    if (assetRepo.hasItem(code, selectedLocation)) {
        playWarning()
        return ProcessResult.Error("$rawValue já adicionado na lista local")
    }

    // STEP 4: Verificar na base mestre
    val result = inventoryBaseline.verifyItem(code, selectedLocation)
    when {
        // 4.1: Não encontrado na base
        result is VerifyResult.NotFound -> {
            playError()
            return ProcessResult.Error(result.message)
        }
        // 4.2: Localização divergente
        result is VerifyResult.WrongLocation -> {
            if (!bypassCheckLocation) {
                lockScanner()
                try {
                    val confirmed = confirmDialog(
                        title = "⚠️ ATENÇÃO: LOCALIZAÇÃO DIVERGENTE",
                        message = "Este bem deveria estar na localidade \n\n" +
                                  "📍${result.foundLocation}\n\n" +
                                  "Confirma que o código $rawValue está correto?"
                    )
                    if (!confirmed) {
                        return ProcessResult.Error(
                            "Cancelado: Item deveria estar em ${result.foundLocation}"
                        )
                    }
                } finally {
                    unlockScanner()
                }
            } else {
                showWarning("AVISO: $rawValue inserido automaticamente. Deveria estar em ${result.foundLocation}.")
                source += "+bypassCheckLocation"
            }
        }
        // 4.3: Localização correta — continua
        is VerifyResult.Ok -> { /* prossegue */ }
    }

    // STEP 5: Verificar conflito de localização remota
    val foundLocation = remoteRegistry.checkAssetLocation(code)
    if (!remoteRegistry.isReady) {
        showWarning("Verificação remota indisponível. Item salvo localmente.")
    }
    if (foundLocation != null && foundLocation != selectedLocation) {
        lockScanner()
        try {
            val confirmed = confirmDialog(
                title = "⚠️ CONFLITO DE LOCALIZAÇÃO",
                message = "O bem patrimonial '$rawValue' já está registrado em:\n" +
                          "📍 $foundLocation\n\n" +
                          "Você está tentando inserir em:\n" +
                          "📍 $selectedLocation\n\n" +
                          "Deseja prosseguir mesmo assim?"
            )
            if (!confirmed) {
                return ProcessResult.Error(
                    "Cancelado: Item $rawValue encontrado em $foundLocation"
                )
            }
        } finally {
            unlockScanner()
        }
    }

    // STEP 6: Adicionar ao repositório local (code é String para preservar zeros à esquerda)
    val item = assetRepo.addItem(rawValue, selectedLocation, source)
    if (item != null) {
        playSuccess()
        if (!bypassCheckLocation) {
            clearWarning()
        }
        return ProcessResult.Success
    }

    return ProcessResult.Error("Erro ao processar código de barras. Tente novamente.")
}
```

### 5.2 Função `verifyItem` (InventoryBaseline)

```kotlin
suspend fun verifyItem(assetCode: String, selectedLocation: String): VerifyResult {
    if (data == null) {
        return VerifyResult.NotFound("Base de dados não carregada.")
    }
    val foundLocation = getLocation(assetCode)
    return when {
        foundLocation == null ->
            VerifyResult.NotFound("Código $assetCode não encontrado na base.")
        foundLocation == selectedLocation ->
            VerifyResult.Ok
        else ->
            VerifyResult.WrongLocation(foundLocation)
    }
}

fun getLocation(assetCode: String): String? {
    if (data == null) return null
    for (item in data) {
        if (item.assets.any { it.code == assetCode }) {
            return item.location
        }
    }
    return null
}
```

### 5.3 Regex de Validação

```
Padrão: ^(199[0-9]|20[0-2][0-9]|2030)\d{6}$
```

- Anos aceitos: 1990–1999, 2000–2029, 2030
- Seguidos de exatamente 6 dígitos
- Total: 10 dígitos
- **Exemplos válidos:** `1995012345`, `2024000123`, `2030999999`
- **Exemplos inválidos:** `1989000000` (ano < 1990), `2031000000` (ano > 2030), `202400001` (9 dígitos)

### 5.4 Verificação de Duplicidade

Duplicata = mesmo `code` + mesma `location`. Se o item já existe no Room com esse par, é duplicata.

---

## 6. Sistema de Sincronização (ForegroundService + Coroutines)

### 6.1 Constantes

| Constante | Valor |
|---|---|
| `BATCH_SIZE` | 10 |
| `SYNC_INTERVAL_MS` | 2.000 (2 segundos) |
| `MAX_RETRIES` | 5 |
| `FAILED_RETRY_CYCLES` | 15 (~30 segundos) |

### 6.2 Arquitetura

> **IMPORTANTE:** `WorkManager.PeriodicWorkRequest` tem intervalo mínimo de 15 minutos no Android, o que é inviável para sincronização a cada 2 segundos. A arquitetura abaixo usa **ForegroundService** para o loop de sync contínuo, com WorkManager como mecanismo de reativação secundário.

```
┌──────────────────────────────────────────────────────────────────┐
│                     SyncForegroundService                         │
│  (service em foreground com notificação persistente)              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  CoroutineScope(Dispatchers.IO)                       │        │
│  │                                                       │        │
│  │  while (isActive) {                                   │        │
│  │      processQueue()  ←─── loop a cada 2s             │        │
│  │      delay(SYNC_INTERVAL_MS)                          │        │
│  │  }                                                    │        │
│  └──────────────────────────────────────────────────────┘        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ↓                                       ↓
┌───────────────────┐              ┌──────────────────────────────┐
│ ConnectivityEvent  │              │ WorkManager (secundário)     │
│ Receiver           │              │                              │
│                    │              │ OneTimeWorkRequest           │
│ Dispara restart    │              │ com NetworkType.CONNECTED    │
│ do service quando  │              │ Reativa o service se o app  │
│ rede volta         │              │ estiver morto e rede voltar │
└───────────────────┘              └──────────────────────────────┘
```

#### Detalhamento:

1. **SyncForegroundService** (ForegroundService):
   - Iniciado quando o app abre e uma localização é selecionada
   - Executa coroutine loop com `while(isActive) { processQueue(); delay(2000) }`
   - Notificação persistente: "Sincronizando inventário..."
   - Parado quando o usuário sai do app (opção: continuar em background)

2. **ConnectivityEventReceiver** (BroadcastReceiver):
   - Escuta `CONNECTIVITY_ACTION` / `ConnectivityManager.NetworkCallback`
   - Quando a rede volta: `retryFailed()` + reinicia o ForegroundService

3. **WorkManager** (secundário, opcional):
   - Agenda `OneTimeWorkRequest` com `NetworkType.CONNECTED` como rede-viu
   - Única função: reativar o ForegroundService se o app foi morto e rede voltou
   - **Não usado para o loop de sync periódico**

### 6.3 Fluxo de Sincronização

```
SyncForegroundService.processQueue()
    │
    ├─ GUARDA 1: if (isSyncing) → return
    ├─ GUARDA 2: if (!isOnline()) → return (ConnectivityManager)
    │
    ├─ Health Check LEVE (não chama GAS):
    │   └─ ConnectivityManager.getActiveNetwork().isConnected() + 
    │      try ICMP/tcp ping curto (opcional)
    │   └─ Se falhar → return (sem consumir GAS quota)
    │
    ├─ cycleCount++
    │   └─ se >= 15: retryFailed(); cycleCount = 0
    │
    ├─ getPendingBatch(10)
    │   └─ batch vazio? → emite SyncCompleted, NUCA (não para o service)
    │
    ├─ markInFlight()
    │
    ├─ saveCodeBatch() via Retrofit
    │   ├─ SUCESSO → processSyncSuccess(uids retornados)
    │   │            uids NÃO retornados → processSyncRetry(faltantes, 5)
    │   └─ FALHA → processSyncRetry(todos, 5)
    │
    └─ finally: isSyncing = false
```

**Diferenças chave do web app original:**
- O loop **nunca para** enquanto o service está rodando (diferente do web app que para ao esvaziar a fila)
- O Health Check **não chama `getAppSettings`** para economizar GAS quota
- A detecção de rede usa `ConnectivityManager`, não `navigator.onLine`

### 6.4 Máquina de Estados

```
PENDING ──markInFlight()──→ IN_FLIGHT
                               │
              ┌────────────────┴────────────────┐
              ↓                                 ↓
         SYNCED                            retryCount++
         (sucesso)                              │
                                    ┌───────────┴───────────┐
                                    ↓                       ↓
                              retryCount < 5          retryCount >= 5
                                    ↓                       ↓
                               PENDING                  FAILED
                              (re-tenta)          (para tentativas)
                                                         │
                                              ┌──────────┴──────────┐
                                              │ retryAllFailed()     │
                                              │ (a cada 15 ciclos   │
                                              │  ou clique manual)   │
                                              └──────────┬──────────┘
                                                         ↓
                                                      PENDING
```

### 6.5 Reinicialização na Sessão

Ao iniciar o app, todos os itens com status `IN_FLIGHT` ou `FAILED` devem ser resetados para `PENDING`. Isso trata sessões anteriores que foram interrompidas durante sincronização.

```kotlin
// Executar no init do Repository
@Query("UPDATE assets SET status = 'PENDING', retryCount = 0 WHERE status IN ('IN_FLIGHT', 'FAILED')")
suspend fun resetStaleItems(): Int
```

### 6.6 Health Check (Economia de GAS Quota)

**IMPORTANTE:** O web app original chama `getAppSettings({_forceRefresh: true})` a cada 2 segundos para verificar conectividade real. No Android isso consumiria toda a quota diária do GAS em minutos. Em vez disso:

```kotlin
suspend fun checkConnectivity(): Boolean {
    // Health check LEVE: não chama GAS
    // Usa apenas Android ConnectivityManager
    val connectivityManager = context.getSystemService<ConnectivityManager>()
    val network = connectivityManager.activeNetwork ?: return false
    val caps = connectivityManager.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}

// Health check PESADO (GAS): chamado apenas quando:
// 1. App inicia (depois do check LEVE)
// 2. Rede volta (depois do check LEVE)
// 3. A cada 5 minutos de sync ativo (timer separado)
suspend fun checkConnectivityHeavy(): Boolean {
    return try {
        gasApi.getAppSettings(mapOf("_forceRefresh" to true))
        true
    } catch (e: Exception) {
        false
    }
}
```

### 6.7 Ciclo de Vida do ForegroundService

```kotlin
class SyncForegroundService : Service() {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isSyncing = false
    private var cycleCount = 0

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())
        scope.launch {
            while (isActive) {
                processQueue()
                delay(SYNC_INTERVAL_MS)
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
```

---

## 7. Registro Remoto de Inventário (Cross-User)

### 7.1 Propósito

Prevenir que dois operadores registrem o mesmo bem em localizações diferentes. Mantém cache local de todos os códigos já escaneados (por qualquer operador) e suas localizações.

### 7.2 Configuração

| Parâmetro | Valor |
|---|---|
| Intervalo de polling | 30 segundos |
| TTL do cache local | 10 minutos (600.000ms) |

### 7.3 Fluxo

```
Timer (30s) ou evento locationChanged/syncCompleted
    │
    ↓
┌──────────────────────┐
│ isFetching?          │──sim──→ agenda próximo
│ !isOnline?           │──sim──→ agenda próximo
└──────────┬───────────┘
           ↓ não
┌──────────────────────┐
│ getInventorySummary  │
│ (selectedLocation)   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ Valida resposta:      │
│ assetsFinded = Array? │──não──→ loga erro, mantém cache antigo
│ locations = Array?    │
└──────────┬───────────┘
           ↓ sim
┌──────────────────────┐
│ Reconstrói cache:     │
│ Map<code, location>  │
│ de assetsFinded[]    │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│ ready = true          │
│ lastUpdated = now     │
│ salva no Room         │
│ emite evento updated  │
└──────────────────────┘
```

### 7.4 Normalização de Código

```kotlin
fun normalizeCode(value: String): String {
    return value.trim().uppercase()
}
```

### 7.5 API Pública

```kotlin
// Verifica em qual localização um código foi encontrado (por qualquer operador)
suspend fun checkAssetLocation(code: String): String? {
    if (!isReady) return null
    return registryDao.findLocationByCode(code)
}

// Verifica se um código já foi escaneado em qualquer lugar
suspend fun hasBeenScanned(code: String): Boolean {
    return registryDao.findLocationByCode(code) != null
}
```

### 7.6 TTL do Cache

Se o cache local tiver mais de 10 minutos, é descartado e reconstruído do zero na próxima sincronização.

---

## 8. Fluxo de Inicialização do App

### 8.1 Sequência Completa

```kotlin
// 1. Mostrar loading
showLoading("Buscando dados")

// 2. Autenticar com Google OAuth
val credential = googleSignIn()

// 3. Carregar configurações e inventário (paralelo se dados não embutidos)
val (settings, inventoryData) = coroutineScope {
    val settingsDeferred = async { gasApi.getAppSettings() }
    val inventoryDeferred = async { gasApi.getInventoryData(true) }
    settingsDeferred.await() to inventoryDeferred.await()
}

// 4. Kill Switch — verificar ANTES de qualquer outra coisa
if (settings["inventory_open"] == false) {
    hideLoading()
    showBlockedScreen()  // "Inventário fechado"
    return
}

// 5. Aplicar manutenção (limpeza por versão e data mínima)
assetRepo.applyMaintenance(settings)

// 6. Inicializar base mestre de inventário
inventoryBaseline.setData(inventoryData["inventory"])

// 7. Inicializar dropdown de localizações
locationSelector.init(inventoryData["locations"])

// 8. Renderizar UI principal
showMainScreen()

// 9. Iniciar sincronização (WorkManager)
syncManager.start()

// 10. Iniciar polling do registro remoto
remoteRegistry.start()

hideLoading()
```

### 8.2 Manutenção (applyMaintenance)

```kotlin
suspend fun applyMaintenance(
    settings: Map<String, Any?>,
    onVersionChanged: suspend () -> Unit  // Callback para recarregar dados
) {
    val appVersion = settings["app_version"] as? String ?: return
    val minValidDate = settings["min_valid_date"] as? String ?: return
    val minTimestamp = parseIsoDate(minValidDate) ?: return

    // 1. Verificar mudança de versão
    val localVersion = prefs.getAppVersion()
    if (localVersion == null) {
        prefs.setAppVersion(appVersion)
    } else if (localVersion != appVersion) {
        // Versão mudou → limpeza completa
        clearAllData()              // Limpa Room + DataStore
        prefs.setAppVersion(appVersion)
        // ⚠️ RECARREGAR dados da API após limpeza
        onVersionChanged()          // Dispara re-fetch de inventory + settings
        return
    }

    // 2. Remover itens mais antigos que a data mínima
    val removedCount = assetDao.deleteOlderThan(minTimestamp)
    if (removedCount > 0) {
        Log.i("Maintenance", "Removidos $removedCount itens antigos")
    }
}
```

**⚠️ Após `clearAllData()`**, é obrigatório recarregar os dados do zero:
```kotlin
// No fluxo de inicialização:
val (settings, inventoryData) = withContext(Dispatchers.IO) {
    async { gasApi.getAppSettings() } to
    async { gasApi.getInventoryData(true) }
}
// Só então re-popular o Room:
inventoryLocationDao.insertAll(inventoryData.locations)
inventoryAssetDao.insertAll(inventoryData.inventory.flatMap { loc ->
    loc.assets.map { asset -> InventoryAsset(code = asset.code, location = loc.location, name = asset.name) }
})
```

### 8.3 Tratamento de Quota Excedida (Storage Full)

Se o Room atingir limite de armazenamento:
1. Ordenar itens: PENDING/FAILED primeiro (prioridade), SYNCED por último
2. Manter apenas os 100 mais recentes
3. Se itens PENDING foram perdidos: mostrar aviso crítico
4. Se falha catastrófica: limpar tudo

---

## 9. Scanner de Código de Barras

### 9.1 Scanner OTG/Bluetooth (Keyboard Wedge)

O Android trata scanners OTG/Bluetooth como teclados físicos. A captura é feita via `dispatchKeyEvent` na Activity:

```kotlin
// Na MainActivity
private val scannerBuffer = StringBuilder()
private var lastKeyTime = 0L
private val scannerDebounceMs = 50L
private val minScanLength = 5

override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.action == KeyEvent.ACTION_DOWN) {
        val currentTime = System.currentTimeMillis()

        // Heurística: se intervalo > 50ms, é digitação humana → limpa buffer
        if (currentTime - lastKeyTime > scannerDebounceMs) {
            scannerBuffer.clear()
        }
        lastKeyTime = currentTime

        when {
            // Enter: finaliza leitura
            event.keyCode == KeyEvent.KEYCODE_ENTER -> {
                // Remove caracteres não numéricos do final
                while (scannerBuffer.isNotEmpty() && !scannerBuffer.last().isDigit()) {
                    scannerBuffer.deleteCharAt(scannerBuffer.length - 1)
                }

                if (scannerBuffer.length >= minScanLength) {
                    val code = scannerBuffer.toString()
                    scannerBuffer.clear()
                    // Consome o evento para não ir para o input manual
                    viewModel.onBarcodeScanned(code, source = "otg")
                    return true  // Evento consumido
                }

                scannerBuffer.clear()
            }
            // Teclas de controle: ignora
            event.isCtrlPressed || event.isAltPressed ||
            event.keyCode == KeyEvent.KEYCODE_SHIFT_LEFT ||
            event.keyCode == KeyEvent.KEYCODE_SHIFT_RIGHT -> {
                // ignora
            }
            // Teclas com mais de 1 char (F1, etc): ignora
            event.unicodeChar.toChar().toString().length > 1 -> {
                // ignora
            }
            // Caractere normal: acumula
            else -> {
                val char = event.unicodeChar.toChar()
                // Se o buffer já tem conteúdo, bloqueia o caractere do input focado
                if (scannerBuffer.isNotEmpty()) {
                    // Não deixa propagar para o campo de texto
                }
                scannerBuffer.append(char)
            }
        }
    }
    return super.dispatchKeyEvent(event)
}
```

### 9.2 Input Manual

- `TextField` com `keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)`
- Debounce de 3 segundos: mesmo código submetido 2x em 3s é rejeitado
- Ao submeter: limpa o campo, dispara `codeScanned` com source `"manual_input"`
- Foco automático após processamento (se source for `manual_input`)

### 9.3 Debounce do Input Manual

```kotlin
private val recentCodes = mutableMapOf<String, Long>()
private val debounceWindowMs = 3000L

fun isDuplicateInWindow(code: String): Boolean {
    val now = System.currentTimeMillis()
    // Limpa expirados
    recentCodes.entries.removeIf { now - it.value > debounceWindowMs }
    // Verifica
    val lastTime = recentCodes[code]
    if (lastTime != null && (now - lastTime) < debounceWindowMs) {
        return true  // Duplicata dentro da janela
    }
    recentCodes[code] = now
    return false
}
```

---

## 10. Feedback do Usuário

### 10.1 Áudio (SoundPool)

Três perfis de som (use arquivos .ogg ou .mp3 pré-gravados, ou gere tons via AudioTrack):

| Tipo | Repetições | Duração (s) | Frequência (Hz) |
|---|---|---|---|
| SUCESSO | 1 | 0.1 | 880 |
| AVISO | 2 | 0.2 | 555 |
| ERRO | 2 | 0.15 | 1333 |

Alternativa Android: usar `ToneGenerator` ou sons de notificação do sistema para simplicidade.

### 10.2 Vibração (Vibrator)

| Tipo | Padrão (ms) |
|---|---|
| SUCESSO | sem vibração |
| AVISO | `[200, 300, 200]` (vibra 200ms, pausa 300ms, vibra 200ms) |
| ERRO | `[300, 200, 300]` |

```kotlin
val vibrator = context.getSystemService(Vibrator::class.java)
val pattern = longArrayOf(0, 300, 200, 300) // delay, vibra, pausa, vibra
vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
```

### 10.3 Alertas Visuais (Snackbar/Toast)

- **Snackbar** para avisos temporários (preferido sobre Toast no Material Design 3)
- Auto-dismiss após **12.5 segundos** (12500ms)
- Apenas um aviso por vez — novo aviso substitui o anterior
- Cor de fundo: amber/warning (`#fff8e1`), borda esquerda vermelha
- Exibido abaixo da área do scanner, acima da tabela

---

## 11. Regras de Negócio Adicionais

### 11.1 Proteção contra Fechamento Acidental

Se houver itens PENDING (não sincronizados), mostrar diálogo de confirmação ao pressionar back:

```kotlin
// No BackHandler do Compose ou onBackPressed da Activity
val stats = assetRepo.getStats()
if (stats.pending > 0) {
    showConfirmDialog(
        title = "Itens não sincronizados",
        message = "Existem ${stats.pending} itens aguardando sincronização. Deseja sair mesmo assim?"
    )
}
```

### 11.2 Bloqueio do Scanner

O scanner (input manual e OTG) deve ser **bloqueado** durante:
- Diálogos de confirmação (AppModal)
- Edição de item
- Busca de itens não encontrados

O desbloqueio deve ocorrer no `finally` (garantido) para evitar que o scanner fique travado permanentemente.

```kotlin
fun lockScanner() {
    isScannerLocked = true
}

fun unlockScanner() {
    isScannerLocked = false
}

// No dispatchKeyEvent e no submit do input manual:
if (isScannerLocked) return
```

### 11.3 Bypass de Verificação de Localização

Checkbox "Ignorar verificação de localização?" disponível na tela principal:
- Quando ativo: suprime o diálogo de confirmação de localização divergente
- O item é aceito automaticamente
- Um aviso silencioso é mostrado informando a divergência
- O campo `source` do item é sufixado com `"+bypassCheckLocation"`

### 11.4 Limpeza de Itens Antigos

Na inicialização, itens com `createdAt < min_valid_date` (da config `app_config`) são removidos. Se `app_version` mudou desde a última execução, **todo o armazenamento local é limpo** (nova versão pode ter schema diferente).

### 11.5 Ordenação

- Localizações: `localeCompare('pt-BR', {numeric: true})`
- Itens na tabela: `createdAt DESC` (mais recentes primeiro)

### 11.6 Tratamento de Erro Global

Capturar exceções não tratadas no pipeline de barcode:
- Logar o erro
- Tocar som de erro
- Mostrar Snackbar: "Erro ao processar código de barras. Tente novamente."
- Garantir que o scanner seja desbloqueado
- Retornar `false` (não crashar)

---

## 12. Comportamento Offline-First

### 12.1 Princípios

- **Todas as escritas são locais primeiro** — o Room é a fonte da verdade
- A sincronização é assíncrona e não bloqueia o operador
- O app funciona 100% offline para leitura de códigos **desde que o inventário já tenha sido carregado alguma vez**
- Dados são sincronizados automaticamente quando a conexão voltar

### 12.2 Sequência de Boot Offline

**Problema conhecido:** O web app original precisa carregar online na primeira inicialização para baixar o inventário mestre. Se o Room estiver vazio e não houver rede, nenhum scan é aceito.

**Solução no Android:**

```
App inicia → sem cache Room + sem rede:
    │
    ├─ 1. Tentar carregar do Room
    │     └─ inventory_locations vazia? → sem dados locais
    │
    ├─ 2. Tentar buscar da API
    │     └─ Sem rede → falha
    │
    ├─ 3. Mostrar tela de erro com opções:
    │     ├─ "Tentar novamente" → retry da API
    │     └─ "Usar dados offline" → só se existir cache Room válido
    │
    └─ Se cache Room existe e é válido (TTL < 24h):
          └─ Usar dados locais, mostrar banner "Dados offline — última atualização: HH:mm"
```

**Cache persistente de inventário:** O Room mantém `inventory_locations` e `inventory_assets` entre sessões. Na inicialização:
1. Se Room tem dados → usar imediatamente (offline-first)
2. Se Room tem dados E rede disponível → atualizar em background (stale-while-revalidate)
3. Se Room está vazio → **obrigatório ter rede** para o primeiro carregamento

### 12.3 Indicadores de Status

| Local | Indicador | Condição |
|---|---|---|
| Topo da tela | Banner vermelho "OFFLINE" | `!isNetworkConnected` |
| Stats | Card "Pendentes" em amarelo | `pending > 0` |
| Stats | Card "Falhas" em vermelho | `failed > 0` |
| Stats | Ícone de sync girando | `isFetching` |
| Tabela | Ícone ⏳ no item | status = PENDING |
| Tabela | Ícone 🔄 no item | status = IN_FLIGHT |
| Tabela | Ícone ❌ no item | status = FAILED |
| Tabela | Ícone ✅ no item | status = SYNCED |

### 12.4 Retomada de Conexão

Quando `ConnectivityManager` detecta `online`:
1. `retryAllFailed()` — todos os FAILED voltam para PENDING
2. `SyncForegroundService` é reiniciado via `ConnectivityEventReceiver`
3. WorkManager `OneTimeWorkRequest` é cancelado (o service já reassumiu)
4. Mensagens pendentes são enviadas
5. Registro remoto volta a fazer polling

### 12.5 Verificação Real de Conectividade

**Health Check em duas camadas (economia de GAS quota):**

1. **Leve (todo ciclo):** `ConnectivityManager` verifica se há conectividade de rede ativa com capacidade de internet
2. **Pesado (apenas no boot e a cada 5 min):** chamada real `getAppSettings({_forceRefresh: true})` para confirmar que o GAS está respondendo

Wi-Fi conectado sem internet é detectado pelo health check leve (NET_CAPABILITY_INTERNET).

---

## 13. Arquitetura Android

### 13.1 Estrutura de Pacotes

```
com.ifc.inventoryapp/
├── data/
│   ├── local/
│   │   ├── AppDatabase.kt          // Room database
│   │   ├── dao/
│   │   │   ├── AssetDao.kt
│   │   │   ├── RegistryDao.kt
│   │   │   ├── MessageDao.kt
│   │   │   ├── InventoryLocationDao.kt
│   │   │   └── InventoryAssetDao.kt
│   │   ├── entity/
│   │   │   ├── Asset.kt
│   │   │   ├── RegistryEntry.kt
│   │   │   ├── PendingMessage.kt
│   │   │   ├── InventoryLocation.kt
│   │   │   └── InventoryAsset.kt
│   │   └── prefs/
│   │       └── AppPreferences.kt    // DataStore
│   ├── remote/
│   │   ├── GasApi.kt               // Retrofit interface
│   │   ├── GasAuthInterceptor.kt   // OAuth token
│   │   └── dto/
│   │       ├── InventoryDataResponse.kt
│   │       ├── AppSettingsResponse.kt
│   │       ├── InventorySummaryResponse.kt
│   │       ├── SaveBatchRequest.kt
│   │       ├── SaveMessageRequest.kt
│   │       └── NotFoundItemsResponse.kt
│   └── repository/
│       ├── AssetRepository.kt
│       ├── InventoryRepository.kt
│       ├── RegistryRepository.kt
│       └── MessageRepository.kt
├── domain/
│   ├── model/
│   │   ├── ProcessResult.kt
│   │   ├── VerifyResult.kt
│   │   └── AssetStats.kt
│   └── usecase/
│       ├── ProcessBarcodeUseCase.kt
│       ├── SyncBatchUseCase.kt
│       └── ApplyMaintenanceUseCase.kt
├── ui/
│   ├── theme/
│   │   └── Theme.kt
│   ├── navigation/
│   │   └── NavGraph.kt
│   ├── main/
│   │   ├── MainScreen.kt
│   │   └── MainViewModel.kt
│   ├── edit/
│   │   ├── EditScreen.kt
│   │   └── EditViewModel.kt
│   ├── notfound/
│   │   ├── NotFoundScreen.kt
│   │   └── NotFoundViewModel.kt
│   ├── message/
│   │   ├── MessageScreen.kt
│   │   └── MessageViewModel.kt
│   └── components/
│       ├── ConfirmDialog.kt
│       ├── LoadingOverlay.kt
│       ├── OfflineBanner.kt
│       ├── StatsDashboard.kt
│       ├── BarcodeTable.kt
│       ├── LocationDropdown.kt
│       └── ScannerInput.kt
├── sync/
│   ├── SyncWorker.kt
│   └── SyncManager.kt
├── scanner/
│   └── BarcodeScannerHandler.kt
├── di/
│   └── AppModule.kt                // Hilt module
├── MainActivity.kt
└── InventoryApp.kt                 // Application class
```

### 13.2 DI (Hilt Module)

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "inventory.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    @Singleton
    fun provideGasApi(): GasApi {
        val authInterceptor = GasAuthInterceptor()  // injeta token OAuth
        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
        return Retrofit.Builder()
            .baseUrl("https://script.googleapis.com/v1/scripts/${BuildConfig.SCRIPT_ID}/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(GasApi::class.java)
    }
}
```

### 13.3 Navegação

```kotlin
@Composable
fun NavGraph(navController: NavHostController) {
    NavHost(navController, startDestination = "main") {
        composable("main") { MainScreen(navController) }
        composable("edit/{uid}") { EditScreen(navController, uid = it.arguments?.getString("uid")) }
        composable("notfound") { NotFoundScreen(navController) }
        composable("message") { MessageScreen(navController) }
    }
}
```

### 13.4 ViewModel Pattern (exemplo)

```kotlin
@HiltViewModel
class MainViewModel @Inject constructor(
    private val assetRepo: AssetRepository,
    private val inventoryRepo: InventoryRepository,
    private val registryRepo: RegistryRepository,
    private val processBarcodeUseCase: ProcessBarcodeUseCase,
    private val syncManager: SyncManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        // Observar assets
        viewModelScope.launch {
            assetRepo.observeAll().collect { assets ->
                _uiState.update { it.copy(assets = assets, stats = assetRepo.getStats()) }
            }
        }
        // Observar registro remoto
        viewModelScope.launch {
            registryRepo.observeLocations().collect { locations ->
                _uiState.update { it.copy(remoteLocations = locations) }
            }
        }
    }

    fun onBarcodeScanned(code: String, source: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true) }
            try {
                val result = processBarcodeUseCase(
                    code = code,
                    selectedLocation = _uiState.value.selectedLocation,
                    source = source,
                    bypassCheckLocation = _uiState.value.bypassLocationCheck
                )
                _uiState.update { it.copy(
                    warningMessage = result.message,
                    scannerLocked = false
                )}
            } finally {
                _uiState.update { it.copy(isProcessing = false) }
            }
        }
    }
}
```

---

## 14. Checklist de Edge Cases

### 14.1 Inicialização

- [ ] App inicia sem conexão → carrega dados do Room, mostra banner offline
- [ ] App inicia sem conexão + Room vazio (primeira vez) → tela de erro "Sem conexão", botão "Tentar novamente"
- [ ] `inventory_open === false` → tela de bloqueio, nada mais carrega
- [ ] `app_version` mudou desde última execução → limpeza total do Room + recarregar dados da API
- [ ] Primeira execução (sem dados locais) → carrega tudo da API
- [ ] Falha ao carregar `getAppSettings` → mostrar erro, permitir retry
- [ ] Falha ao carregar `getInventoryData` → mostrar erro, permitir retry
- [ ] Timeout na inicialização → erro com opção de retry
- [ ] Planilha sem localizações → dropdown mostra "Nenhuma localização encontrada"
- [ ] Cache Room antigo (> 24h) → aviso de dados desatualizados, refresh em background
- [ ] Mudança de versão → `clearAllData()` recarrega inventory + settings automaticamente

### 14.2 Scanner

- [ ] Código com menos de 5 caracteres (OTG) → ignorado
- [ ] Código com menos de 10 dígitos (formato) → rejeitado com "Tombamento inválido"
- [ ] Código com ano fora do range 1990-2030 → rejeitado
- [ ] Código duplicado (mesmo code + location) → rejeitado com aviso
- [ ] Código submetido manualmente 2x em 3 segundos → rejeitado (debounce)
- [ ] Código não encontrado na base mestre → rejeitado com "não encontrado na base"
- [ ] Código de localização divergente → diálogo de confirmação
- [ ] Código de localização divergente + bypass ativo → aceito com aviso
- [ ] Código já registrado remotamente em outra localização → diálogo de conflito
- [ ] Registro remoto indisponível (offline) → aviso, item salvo localmente
- [ ] Scanner bloqueado durante modal → input ignorado
- [ ] Digitação humana vs scanner → diferenciado pelo timing (50ms)
- [ ] Buffer do scanner com caracteres não numéricos no final → removidos antes de processar

### 14.3 Sincronização

- [ ] Batch de 10 itens enviado com sucesso
- [ ] Falha no batch → retry com exponential backoff
- [ ] Máximo de 5 retentativas atingido → status FAILED
- [ ] Itens FAILED reenfileirados a cada 15 ciclos (~30s)
- [ ] Sincronização pausada quando offline
- [ ] Sincronização retomada quando online (com retryFailed)
- [ ] Health check leve (ConnectivityManager) → rápido, não consome GAS quota
- [ ] Health check pesado (GAS) → chamado apenas no boot e a cada 5 minutos
- [ ] Servidor ocupado (lock timeout) → retry
- [ ] Resposta inválida do backend → tratada como falha
- [ ] Falha parcial (alguns uids não retornaram) → apenas os faltantes vão para retry
- [ ] Sessão anterior interrompida → IN_FLIGHT/FAILED resetados para PENDING
- [ ] ForegroundService inicia ao selecionar localização
- [ ] ForegroundService para ao desselecionar localização
- [ ] ForegroundService reinicia via ConnectivityEventReceiver quando rede volta
- [ ] ForegroundService recria notificação persistente se destruído pelo sistema

### 14.4 Edição

- [ ] Estado inválido (< 0 ou > 4) → rejeitado
- [ ] IPVU inválido → rejeitado
- [ ] Observações > 140 caracteres → truncado
- [ ] UID não encontrado → aviso, sem crash
- [ ] Falha ao salvar → Snackbar, mantém tela aberta
- [ ] Item editado volta para status PENDING

### 14.5 Itens Não Encontrados

- [ ] Lista vazia → mensagem informativa
- [ ] Timeout de 25s → aviso de timeout
- [ ] Offline → aviso de sem conexão
- [ ] Adicionar item da lista → diálogo de confirmação, depois pipeline normal
- [ ] Tabela fica vazia após adições → fecha modal

### 14.6 Observações

- [ ] Texto vazio → fecha sem enviar
- [ ] Texto > 140 caracteres → truncado
- [ ] Offline → salvo localmente, enviado ao reconectar
- [ ] Mensagens pendentes enviadas em lote ao reconectar

### 14.7 Armazenamento

- [ ] Quota excedida → limpeza conservadora (manter últimos 100, priorizar PENDING/FAILED)
- [ ] Itens PENDING perdidos na limpeza → aviso crítico
- [ ] Falha catastrófica → limpeza total
- [ ] Itens antigos (< min_valid_date) → removidos na manutenção

### 14.8 UI/UX

- [ ] Selecionar localização → mostra scanner, tabela filtrada, botões
- [ ] Desselecionar localização → esconde scanner e botões, limpa filtro
- [ ] Trocar de localização → reseta paginação para página 1
- [ ] Clicar na localização na tabela → muda dropdown, scrolla para topo
- [ ] Pressionar back com itens pendentes → diálogo de confirmação
- [ ] Avisos com auto-dismiss em 12.5s
- [ ] Novo aviso substitui anterior (apenas 1 por vez)

---

## 15. Todas as Strings de Interface (Português pt-BR)

### 15.1 Mensagens de Validação/Erro

| String | Contexto |
|---|---|
| `Selecione uma localização antes de bipar.` | Scan sem localização |
| `Tombamento inválido: {code}` | Regex falhou |
| `{code} já adicionado na lista local` | Duplicata local |
| `Código {code} não encontrado na base.` | Não está no inventário |
| `Base de dados não carregada.` | InventoryBaseline sem dados |
| `Verificação remota indisponível. Item salvo localmente.` | Registry offline |
| `Cancelado: Item deveria estar em {local}` | Usuário cancelou divergência |
| `Cancelado: Item {code} encontrado em {local}` | Usuário cancelou conflito |
| `AVISO: {code} inserido automaticamente. Deveria estar em {local}.` | Bypass ativo |
| `Erro ao processar código de barras. Tente novamente.` | Erro inesperado |
| `Falha ao salvar alterações. Tente novamente.` | updateItem falhou |
| `ATENÇÃO: Armazenamento cheio. {n} itens removidos.` | Quota excedida |
| `{n} leituras NÃO SALVAS foram perdidas!` | Pending perdido na limpeza |
| `Erro ao carregar dados. Recarregue a página.` | Erro na inicialização |

### 15.2 Diálogos de Confirmação

| Título | Corpo |
|---|---|
| `⚠️ ATENÇÃO: LOCALIZAÇÃO DIVERGENTE` | `Este bem deveria estar na localidade \n\n📍{local}\n\nConfirma que o código {code} está correto?` |
| `⚠️ CONFLITO DE LOCALIZAÇÃO` | `O bem patrimonial '{code}' já está registrado em:\n📍{foundLocation}\n\nVocê está tentando inserir em:\n📍{selectedLocation}\n\nDeseja prosseguir mesmo assim?` |
| `Confirmar Adição` | `Deseja marcar o item {code} como encontrado?` |

### 15.3 Labels de Interface

| String | Local |
|---|---|
| `Selecione uma localização` | Dropdown default |
| `{name} [{count} itens]` | Opção do dropdown |
| `Código (10 dig)` | Placeholder input manual |
| `Limpar` | Botão clear input |
| `Ignorar verificação de localização?` | Checkbox bypass |
| `Não encontrados` | Botão |
| `Enviar observação` | Botão |
| `Itens encontrados por este dispositivo` | Título da tabela |
| `Status` / `Patrimônio` / `Descrição curta` / `Local` / `Ação` | Headers da tabela |
| `Editar` | Botão da linha |
| `Anterior` / `Próximo` | Paginação |
| `Itens: {n}` | Info paginação |
| `Página {n}` | Info paginação |
| `Resumo Geral do processo de Inventário:` | Stats card |
| `Sincronização com a planilha` | Stats section |
| `Lidos (Dispositivo)` / `Sincronizados` / `Pendentes` / `Falhas 🔄` | Cards stats |
| `{n} total` / `✅ {n} encontrados` / `❌ {n} faltantes` | Stats por local |
| `Editar Item` | Título modal |
| `Tombamento` / `Especificação` / `Localização` | Labels readonly |
| `Estado do Bem` | Label select |
| `Péssimo` / `Ruim` / `Regular` / `Bom` / `Excelente` | Opções estado |
| `Vida Útil Estimada` | Label select |
| `0 anos` / `1 ano` / `2 anos` / `5 anos` / `8 anos` / `10 anos` | Opções IPVU |
| `Observações` | Label textarea |
| `Notas adicionais...` | Placeholder |
| `Cancelar` / `Salvar Alterações` / `Confirmar` | Botões |
| `Itens Não Encontrados` | Título modal |
| `FECHAR` | Botão |
| `Adicionar` | Botão por linha |
| `#` / `Tombo` / `Descrição` / `Ação` | Headers tabela não encontrados |
| `Enviar observação` | Título modal |
| `Local: {loc}` | Label local |
| `Digite sua mensagem...` | Placeholder |
| `ENVIAR` | Botão |
| `⏳ Consultando planilha ...` | Loading |
| `Buscando dados` | Loading inicial |
| `OFFLINE: Dados salvos localmente.` | Banner |
| `Inventário fechado` / `O prazo para inventário está fechado.` | Kill switch |
| `Sem conexão com a internet. Verifique sua conectividade.` | Offline |
| `Nenhum item pendente para {loc}! Caso não apareça na sua tabela, foi encontrado por outro usuário.` | NotFound vazio |
| `Selecione uma localização primeiro!` | NotFound sem local |
| `Erro ao consultar servidor.` | NotFound erro |
| `Tempo esgotado. Verifique sua conexão com a planilha.` | NotFound timeout |
| `Nenhuma localização encontrada.` | Dropdown vazio |

### 15.4 Mensagens de Log (não visíveis ao usuário)

| String | Contexto |
|---|---|
| `Online detectado. Reiniciando sync...` | Connectivity |
| `Dispositivo entrou em modo OFFLINE.` | Connectivity |
| `Dispositivo está ONLINE.` | Connectivity |
| `Conexão restabelecida. Sincronizando observações...` | Messages |

---

## 16. Configuração do Projeto Android

### 16.1 build.gradle.kts (app) — Dependências

```kotlin
dependencies {
    // Compose
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Retrofit + OkHttp
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.51.1")
    ksp("com.google.dagger:hilt-compiler:2.51.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.hilt:hilt-work:1.2.0")

    // Google Auth
    implementation("com.google.android.gms:play-services-auth:21.2.0")
    implementation("com.google.auth:google-auth-library-oauth2-http:1.23.0")

    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.1.1")
}
```

### 16.2 Permissões no AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### 16.3 Build Config

```kotlin
android {
    defaultConfig {
        buildConfigField("String", "SCRIPT_ID", "\"${properties["GAS_SCRIPT_ID"]}\"")
    }
}
```

---

## Notas Finais para o Google AI Studio

1. **Este documento contém a especificação COMPLETA.** Não é necessário inventar regras de negócio, fluxos, ou validações. Tudo está documentado aqui.

2. **Priorize a funcionalidade sobre a estética.** O app precisa funcionar corretamente com todos os edge cases listados na Seção 14. O visual Material Design 3 é importante, mas secundário.

3. **Offline-first é mandatório.** O app deve funcionar perfeitamente sem internet. A sincronização é um processo em background que não bloqueia o operador.

4. **Mantenha os textos em português (pt-BR).** Todas as strings de interface estão na Seção 15. Use-as exatamente como especificado.

5. **Gere o código completo.** Inclua todos os arquivos: entities, DAOs, Retrofit interface, DTOs, Repositories, UseCases, ViewModels, Screens, Composable components, Hilt modules, Worker, e AndroidManifest.

6. **O SCRIPT_ID do GAS deve ser configurável** via `BuildConfig` ou settings, não hardcoded.

7. **Trate erros graciosamente.** Nenhum erro deve crashar o app. Use try/catch com fallback para Snackbar informativo.

# Sugestões — Servidor Local de Testes

> Extraído do `TODO.md` raiz em 2026-07-22.
> Mover para `local_server/TODO.md` quando o acesso for liberado.

---

## 1. Segurança

### 1.1 CORS aberto no servidor local
`local_server/server.js` linha 143: `cors({ origin: '*', credentials: true })`. Aceitável para dev, mas perigoso se o servidor for exposto na rede local sem querer.

**Sugestão:** Restringir a origens específicas quando fora de desenvolvimento, ou documentar com destaque que isso só é seguro em localhost.

### 1.2 Pasta `local_server/certs/` no repositório
Contém `cert.pfx`, `cert.crt`, `cert.pem`, `key.pem`. Verificar se estão no `.gitignore`.

**Sugestão:** Garantir que `certs/*` está coberto pelo `.gitignore` para evitar commit acidental de chaves privadas.

---

## 2. Manutenção

### 2.1 Duplicação de código com `backend/main.js`
`local_server/gas-simulation.js` tem implementações quase idênticas às de `backend/main.js` para `getInventoryData`, `getInventorySummary`, `saveCodeBatch`, `saveMessage`, `getNotFoundItens` e `getAppSettings`. Toda correção de bug precisa ser feita em dois lugares.

**Sugestão:** Extrair a lógica de negócio pura para `shared/inventory-logic.js`, deixando cada ambiente cuidar apenas da camada de I/O (SpreadsheetApp vs Sheets API).

### 2.2 Blocos grandes de código comentado
`local_server/gas-simulation.js` linhas 88-142 e 310-361 contêm código comentado.

**Sugestão:** Remover. O git já guarda o histórico.

### 2.3 Chave da service account expira
Dev que criou a conta sai da empresa. Chave expira. Servidor local para de funcionar e ninguém sabe regenerar.

**Sugestão:** Documentar rotação de chaves no README, mensagem de erro clara no `local_server/config.js`.

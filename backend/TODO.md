# Backend — Status e Pendências

> Atualizado: 2026-07-24 após revisão completa do backend.

## ✅ Já implementado

- **Arquitetura limpa**: `main.js` = thin I/O adapter, `inventory-logic.js` = funções puras
- **Módulo canônico**: `inventory-logic.js` é o single source of truth (Node importa, GAS escopo global)
- **Lock real**: `local_server` tem mutex assíncrono (antes era no-op)
- **CORS**: restrito por ambiente (localhost / rede local / produção)
- **Sanitização**: sem HTML-escape nos query params (bug corrigido)
- **Erros**: `errorResponse` helper não vaza stack em produção
- **Testes**: 51 testes (unitários + integração) em `tests/`
- **const/let**: sem `var` no código (ESLint `--fix`)
- **JSDoc**: documentado em todos os arquivos principais
- **Colunas**: constantes nomeadas em vez de números mágicos
- **Deploy**: `deploy.js` remove `export` de `inventory-logic.js` para compatibilidade GAS
- **Cache `getAppSettings`**: implementado com TTL de 60s em ambos ambientes. `checkConnectivity()` usa `_forceRefresh` para furar cache e testar rede real.
- **Índice UID→linha no `saveCodeBatch`**: cache incremental com validação. Lê planilha inteira só no cold start — depois apenas 1 célula por UID para validar.

---

## 🔄 Ciclo de manutenção

1. Alterar lógica em `backend/inventory-logic.js` (módulo canônico)
2. Rodar `node --test tests/` para validar
3. `npm run dev` para testar integração local
4. `npm run deploy:homolog` para staging
5. `npm run deploy` para produção

# Backend — Status e Pendências

## 🔄 Ciclo de manutenção

1. Alterar lógica em `backend/inventory-logic.js` (módulo canônico)
2. Rodar `node --test tests/` para validar
3. `npm run dev` para testar com Vite dev server
4. `npm run deploy:homolog` para staging
5. `npm run deploy` para produção

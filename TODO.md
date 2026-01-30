- [X] acertar altura dos selects no modal de editar item no celular
- [X] Lógica de status na tabela está com problema, não atualiza direito o ícone
- [ TESTAR MAIS ] Lógica de reenvio de itens não salvos não parece estar funcionando na inicialização
- [X] Melhorar a exibição das estatísticas, com mais informações relevantes para o usuário
- [X] Adicionar um formulário para enviar observações gerais.

# TODO - Code Review & Fixes

## Critical Issues
- [X] Verify all `mockGAS.js` mock functions match actual Google Apps Script API signatures
- [X] Ensure error handling in `processBarcode.js` catches all promise rejections
- [ ] Check `barcodeStorage.js` for XSS vulnerabilities when storing/retrieving user input
- [X] Validate barcode format validation in `scannerManager.js` before database operations

## Inconsistencies
- [ ] Standardize error handling patterns across all modules (use consistent try-catch vs promises)
- [X] Ensure all module dependencies are explicitly declared (check circular dependencies)
- [X] Verify all HTML elements referenced in JavaScript exist in `index.html`
- [X] Check `locationSelector.js` for null/undefined element references
- [X] Validate that `audio.js` handles missing audio resources gracefully

## Code Quality
- [ ] Add JSDoc comments to all exported functions in each module
- [X] Ensure consistent naming conventions (camelCase for variables/functions)
- [X] Remove or complete all `debug.js` logging statements
- [X] Add input validation for all user-facing forms
- [X] Verify `editAssetModal.js` properly cleans up event listeners

## Data Integrity
- [X] Validate data before sending to `inventoryBaseline.js`
- [X] Implement retry logic for failed database operations
- [X] Add data validation in `assetsNotFound.js` handler
- [X] Verify `remoteInventoryRegistry.js` handles duplicate entries correctly

## Testing
- [ ] Test offline functionality and data syncing
- [ ] Verify memory leaks in event listeners (especially modals)
- [ ] Test concurrent operations in `barcodeTable.js`

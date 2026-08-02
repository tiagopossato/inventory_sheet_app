---
target: frontend/index.html
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-07-22T18-55-16Z
slug: frontend-index-html
---
# Design Critique: App Inventário IFC

**Target:** `frontend/index.html` (slug: `frontend-index-html`)

Method: dual-agent (A: ab67845de44afad2b · B: a7728c3f5c8eb30fe)

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sync status é binário (spinner/check) sem progresso por item ou batch; sem estimativa de tempo restante |
| 2 | Match Between System / Real World | 3 | Cabeçalho "Stat" em inglês destoa do app 100% pt-BR; demais rótulos são adequados ao contexto de patrimônio |
| 3 | User Control and Freedom | 2 | Sem undo em qualquer ação; auto-submit de 10 dígitos dispara sem janela de revisão; sem confirmação para bypass de localização |
| 4 | Consistency and Standards | 3 | Card "Falhas 🔄" usa emoji no label enquanto os outros 3 cards usam texto puro; campos readonly alternam entre `<input>` e `<div>` |
| 5 | Error Prevention | 2 | Auto-submit aceita qualquer sequência de 10 dígitos sem validação de formato ou checksum; bypass de localização persiste até desmarcar manualmente |
| 6 | Recognition Rather Than Recall | 3 | Números de tombamento exibidos sem formatação (10 dígitos corridos); links de localização não explicam que funcionam como filtro global |
| 7 | Flexibility and Efficiency of Use | 2 | Sem atalhos de teclado, sem edição em lote, sem opção de densidade de tabela, itens-por-página fixo em 10 |
| 8 | Aesthetic and Minimalist Design | 3 | Grid de stats dividido em dois containers com label órfã entre eles quebra o ritmo visual; densidade de emoji na tabela de contexto |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | 1 | Falhas de sync mostram só ❌ sem diagnóstico; `updateItem()` retorna false e o modal fecha como se tivesse salvado; erros só vão para console.log |
| 10 | Help and Documentation | 1 | Zero onboarding, zero tooltips, zero ajuda contextual; checkbox "Ignorar verificação de localização?" sem explicação; primeiro acesso é descoberto por tentativa e erro |
| **Total** | | **23/40** | **Acceptable** — base sólida, gaps críticos em recuperação de erro e ajuda |

---

## Design Specificity Verdict

**LLM assessment:** O app é genuinamente autoral para seu contexto IFC — a terminologia (Tombamento, Estado do Bem, Vida Útil), as cores semânticas mapeadas ao domínio de inventário (encontrado/faltante/pendente), e o modelo de interação (auto-submit por tamanho de código, localização como filtro primário) são específicos deste produto. O North Star "Caderno de Campo" do DESIGN.md captura com precisão a atmosfera funcional. Porém, a casca visual — cards, tabelas, modals full-screen, paginação — seria intercambiável com qualquer app mobile web de entrada de dados. A especificidade real está no modelo de interação, não na biblioteca de componentes. O DESIGN.md é mais específico que a implementação — um bom problema para se ter.

**Deterministic scan:** O detector (`detect.mjs`) encontrou 2 violações, ambas no `<noscript>` do `index.html`: as cores `#f8d7da` e `#721c24` (paleta de alerta bootstrap) não estão documentadas no DESIGN.md. **Falso positivo**: estas cores aparecem exclusivamente no fallback para JavaScript desabilitado, onde nenhum CSS é carregado. São funcionalmente necessárias como estilos inline e devem ser documentadas como exceção reconhecida no DESIGN.md, não removidas.

**Browser inspection:** Não disponível neste ambiente. A avaliação visual é baseada em análise de código fonte.

---

## Overall Impression

Este é um app de inventário **sólido e funcional** construído por um desenvolvedor que entende profundamente o domínio. O scan loop é rápido, o sistema de cores semânticas é disciplinado, e a arquitetura offline-first é honesta com o usuário. O DESIGN.md captura essas qualidades com precisão cirúrgica.

O problema central não é o que está quebrado — é o que está **silencioso**. Falhas de save fecham o modal como sucesso. Erros de sync mostram um emoji sem diagnóstico. O auto-submit engole qualquer sequência de 10 dígitos sem piscar. Um operador confiante pode passar horas escaneando, editando, e enviando observações sem perceber que nada foi salvo. A confiança que o design inspira (cores claras, feedback tátil, transições rápidas) torna as falhas silenciosas mais perigosas, não menos.

O maior gap é a **ausência de rede de segurança**: sem undo, sem confirmação para ações irreversíveis, sem diagnóstico de erro, sem onboarding. Para um sistema cujo propósito é integridade de dados de patrimônio público, cada falha silenciosa é uma violação do Product Principle #2 ("Reliability over features").

---

## What's Working

1. **Sistema de cores semânticas com disciplina rara.** Azul = ação, verde = sucesso, vermelho = perigo, laranja = atenção. Esta regra é aplicada consistentemente em botões, cards de estatística, highlights condicionais, e anéis de foco. Em condições de campo com luz variável, a cor comunica estado antes que o texto seja lido. O DESIGN.md codifica isso nas Named Rules ("A Regra do Significado Único") — a implementação as honra.

2. **Scan loop otimizado para velocidade.** O auto-submit ao atingir 10 caracteres elimina um toque por leitura. O filtro por localização reduz a tabela ao contexto relevante. Links de localização clicáveis na tabela e no dashboard criam atalhos de navegação entre contexto e detalhe. O input com `inputmode="numeric"` e `autocomplete="nope"` mostra atenção a cada detalhe da experiência de digitação em mobile. Este loop é a versão mais rápida de si mesmo.

3. **Arquitetura offline-first visível e honesta.** O banner offline (fixo no topo, vermelho, z-index 9000), o ícone de sync (🔁 girando → ✅ confirmado), os contadores de pendentes/falhas com anéis de destaque nos cards, e o clique no card de falhas para reenviar — tudo isso comunica o estado dos dados sem exigir que o operador entenda LocalStorage, batch sync, ou exponential backoff. O usuário vê "3 pendentes" e sabe que algo ainda não foi salvo. Isso constrói confiança mesmo durante falhas de conectividade.

---

## Priority Issues

### [P0] Save silencioso no modal de edição
**What:** `editAssetModal.submit()` chama `assetRepository.updateItem()`, mas ignora o retorno. Se `updateItem` retorna `false`, o modal fecha normalmente — o operador acredita que salvou, mas os dados foram perdidos. **Why it matters:** Corrompe a trilha de auditoria. O estado de conservação e a vida útil estimada são dados críticos para o inventário patrimonial. Um save fantasma é pior que um erro visível. **Fix:** Verificar o retorno de `updateItem()`. Se `false`, disparar `userWarnings.printUserWarning('Falha ao salvar. Tente novamente.')` e NÃO fechar o modal. Manter o formulário aberto com os dados intactos para retry. **Suggested command:** `/impeccable harden`

### [P0] Auto-submit sem validação de código
**What:** O input de código de barras dispara `codeScanned` ao atingir 10 caracteres, sem nenhuma validação de formato, checksum, ou verificação contra o inventário mestre. Qualquer sequência de 10 dígitos — número de telefone, digitação acidental, leitura duplicada de scanner — é processada como leitura legítima. **Why it matters:** Leituras fantasmas poluem a planilha de inventário e exigem limpeza manual. Em um dia de pico com 20 operadores, dezenas de leituras inválidas podem ser registradas antes que alguém perceba. **Fix:** Adicionar validação pós-disparo: verificar se o código existe no `inventoryBaseline` (já carregado em memória). Se não existir, mostrar warning "Código não encontrado no inventário" e não adicionar ao repositório. Opcionalmente, adicionar um debounce de 300ms para evitar disparos duplos. **Suggested command:** `/impeccable harden`

### [P1] Falhas de sync sem diagnóstico
**What:** Itens com status FAILED mostram ❌ na tabela e incrementam o contador "Falhas". Não há informação sobre a causa: timeout de rede? Erro 500 do GAS? Quota excedida? Token expirado? O operador não sabe se deve reenviar, esperar, reconectar, ou chamar suporte. **Why it matters:** Sem diagnóstico, falhas se acumulam. O clique no card de falhas reenvia às cegas — se a causa for quota exhaustion, reenviar piora o problema. O operador perde confiança no sistema quando não consegue entender por que seus dados não estão chegando na planilha. **Fix:** Armazenar `error.message` (ou um código de erro) junto com cada item FAILED no `assetRepository`. Expor essa informação em um tooltip na tabela, ou em um modal de detalhes acessível pelo clique no card de falhas. No mínimo, substituir o `console.error` genérico por `userWarnings.printUserWarning` com a mensagem real do erro. **Suggested command:** `/impeccable harden`

### [P1] Cabeçalho "Stat" em inglês
**What:** A tabela de leituras (`barcodeTable.js` linha 65) usa `Stat` como cabeçalho da coluna de status. Todo o resto do app está em português. **Why it matters:** Para um operador não-técnico que não fala inglês (a base inteira de usuários do IFC), "Stat" é uma palavra sem significado. A coluna carrega informação crítica de status de sincronização — ambiguidade aqui corrói a confiança nos dados. **Fix:** Alterar para "Status" em `barcodeTable.js` linha 65. **Suggested command:** `/impeccable clarify`

### [P1] Grid de stats com label órfã entre containers
**What:** `statsManager.js._innerHtml()` cria dois `.stats-container` separados — um para o card de resumo, outro para os 4 cards de métricas — com um `<div class="flex-align-center">Sincronização com a planilha</div>` flutuando entre eles. **Why it matters:** O espaçamento ao redor dessa label é inconsistente com o gap interno dos grids (8px). Em telas menores, a quebra estrutural fica evidente. Também complica futuras mudanças de layout responsivo — a label não participa do grid. **Fix:** Unificar em um único `.stats-container`. Colocar o card de resumo como `grid-column: 1 / -1`, a label de seção como outra row full-width estilizada consistentemente, e os 4 cards abaixo. **Suggested command:** `/impeccable layout`

### [P2] Sem undo para edições ou scans acidentais
**What:** Nenhuma ação de modificação de dados (editar asset, enviar observação, scan com bypass) pode ser desfeita. **Why it matters:** Operadores trabalhando rápido no campo cometem erros — selecionar "Excelente" em vez de "Bom", ou esquecer o bypass ligado. Sem undo, erros vão para a planilha e exigem correção manual no Google Sheets, quebrando o princípio de que "the spreadsheet is the source of truth" (a planilha agora contém dados errados que precisam ser garimpados). **Fix:** Adicionar um toast de undo de 5 segundos após ações destrutivas: "Alterações salvas. Desfazer?". Armazenar o estado anterior em memória e restaurar no callback de undo. **Suggested command:** `/impeccable harden`

### [P2] Zero onboarding para primeiro acesso
**What:** Um operador novo abre o app e vê: um select de localização, um input de texto, um checkbox "Ignorar verificação de localização?", cards de estatística zerados, uma tabela vazia, e botões "Não encontrados" e "Enviar observação". Nenhuma saudação, nenhum passo-a-passo, nenhuma dica. O checkbox de bypass é particularmente perigoso — um novato que o ativa sem entender a consequência gera leituras sem verificação de localização. **Why it matters:** O inventário anual depende de 5-20 pessoas, muitas usando o app pela primeira vez. Cada operador confuso é um risco de dados incorretos. O custo de treinamento presencial para 20 pessoas é alto; o app deveria reduzir, não aumentar, essa necessidade. **Fix:** Adicionar um overlay de primeiro acesso (3 passos, uma única vez, armazenado em localStorage): (1) Selecione uma localização, (2) Escaneie ou digite um código, (3) Verifique o resultado na tabela. Adicionar um ícone (i) com tooltip ao lado do checkbox de bypass. **Suggested command:** `/impeccable onboard`

### [P3] Densidade de emoji na tabela de contexto
**What:** Cada linha da tabela de resumo por localização exibe 4 emojis (🔍 📦 ✅ ❌). O ✅ e ❌ duplicam significado já transmitido pelas classes `stat-found` (verde) e `stat-missing` (vermelho). **Why it matters:** Em um sistema que se define como "funcional e direto", a densidade de emoji cria ruído visual que compete com a leitura dos números. Também viola sutilmente o princípio de que cor = sinal — se a cor já comunica, o emoji é redundante. **Fix:** Remover 📦 (redundante com "total"). Manter ✅ e ❌ apenas se servirem usuários com daltonismo (já que as cores verde/vermelho são problemáticas para ~8% dos homens). O 🔍 é aceitável como ícone de ação. **Suggested command:** `/impeccable distill`

---

## Persona Red Flags

### Alex (Power User — operador experiente que já fez 3 inventários)
- Nenhum atalho de teclado para focar o input de código de barras
- Sem edição em lote: não pode aplicar "Estado = Bom" a todos os itens do filtro atual
- Itens por página fixo em 10 — sem opção de 25, 50, ou "todos"
- Sem navegação direta para página específica — apenas Anterior/Próximo sequencial
- Nenhuma exportação dos dados da sessão para conferência offline
- O auto-submit força um ritmo que Alex não controla — ele não pode revisar antes de confirmar

### Jordan (First-Timer — professor designado para ajudar no inventário)
- Tela inicial sem nenhuma orientação: o que fazer primeiro? Onde clicar?
- Checkbox "Ignorar verificação de localização?" sem explicação do que isso significa ou quando usar
- Input de código visível mesmo sem localização selecionada — Jordan pode digitar códigos achando que está funcionando
- Cabeçalho "Stat" é jargão incompreensível
- Nenhum feedback de "você fez certo!" após o primeiro scan bem-sucedido
- Se Jordan errar, não há botão de ajuda, FAQ, ou instrução de recuperação

### Casey (Distracted Mobile — operador escaneando com uma mão enquanto caminha)
- Botão "Limpar" ao lado do input é pequeno para toque com polegar em movimento
- Auto-submit pode disparar de digitação acidental no bolso ou leitura parcial do scanner
- Stats e tabela sempre visíveis abaixo do input — ao caminhar, a página rola e muda sob o polegar
- Sem confirmação visual forte de scan registrado além da mudança numérica sutil — fácil de perder em luz solar intensa
- Checkbox de bypass sem indicador visual persistente quando ativo — Casey pode ativar, esquecer, e escanear 20 itens sem verificação
- O modal full-screen de edição bloqueia o scroll do body (`overflow: hidden`) — se Casey recebe uma notificação e sai do app, volta para um modal aberto sem contexto

---

## Minor Observations

**Do Assessment A:**
- Link de versão no footer (`#footer-version`) mostra "---" até o JS popular — link quebrado visível no carregamento
- `#scanDelayOverlay` existe no CSS com `pointer-events: none` — não pode bloquear interação, propósito ambíguo
- `tombamentoField` é `<input readonly>` mas `specField` e `locationField` são `<div class="input-modal-readonly">` — semântica HTML inconsistente para dados somente-leitura
- `#cameraPlaceholder` não diz o que o operador deve fazer — um texto "Aponte a câmera para o código de barras" ajudaria
- `statsManager` usa `onclick` no card de falhas mas `addEventListener` para eventos de janela — padrões de binding inconsistentes
- Botões `openMessageModalBtn` e `notFoundBtn` injetados via `innerHTML +=` que força reparse completo do container
- Paginação usa `onclick = function()` nas setas mas `locationCell.onclick = ...` nas células — inconsistência de padrão

**Do Assessment B (Detector):**
- **3 modals sem ARIA dialog:** `assetDetailsModal` (editAssetModal.js), `assetNotFoundModal` (assetsNotFound.js), `modalObs` (messageSendModal.js) — todos sem `role="dialog"`, `aria-modal="true"`, ou `aria-labelledby`
- **6 `<section>` com `aria-labelledby` órfãos:** `index.html` referencia IDs (`location-heading`, `scanner-heading`, etc.) que não existem no DOM — screen readers não anunciam esses landmarks
- **3 touch targets abaixo de 44px:** `.clickable-location` (padding vertical 2px), `.cell-link` (sem min-height), `.stat-metrics` (fonte 12px com gap 6px)
- **2 estilos inline hardcoded:** `statsManager.js` (margin-bottom: 8px), `debug.js` (11 estilos inline, fonte 11px abaixo do piso de 12px)
- **1 redundância:** `#offlineBanner` tem `style="display:none"` inline + `display:none` no CSS — o inline é desnecessário

---

## Questions to Consider

1. O bypass de localização é sempre visível e está a um toque de distância. Em uma ferramenta desenhada para confiabilidade e integridade de auditoria, um bypass de verificação de localização deveria ser um toggle persistente, ou deveria ser um modo temporário que se auto-desativa após N scans ou um timeout?

2. O auto-submit de 10 caracteres foi projetado para velocidade, mas elimina qualquer janela de revisão. Em um cenário real de campo, qual é o custo real de um scan acidental (uma leitura errada na planilha que precisa ser encontrada e deletada) versus o tempo economizado ao remover um Enter por scan em centenas de itens?

3. O North Star do DESIGN.md é "O Caderno de Campo". Cadernos de campo têm começo (data, local, nome do inspetor) e fim (assinatura, totais). O app não tem nem ritual de início de sessão nem resumo de fechamento. Adicionar um fluxo leve de "Iniciar contagem" / "Finalizar contagem" melhoraria a jornada emocional e a integridade dos dados, ou adicionaria atrito ao loop de escaneamento?

---
name: App Inventário IFC
description: Scanner de patrimônio mobile-first para contagem de inventário físico no Instituto Federal Catarinense
colors:
  primary: "#007bff"
  primary-hover: "#0056b3"
  primary-light: "rgba(0, 123, 255, 0.1)"
  success: "#198754"
  success-dark: "#188038"
  success-light: "#e8f5e9"
  danger: "#dc3545"
  danger-dark: "#d93025"
  danger-light: "#fff5f5"
  warning-text: "#c26400"
  warning-bg: "#ffc107"
  warning-light: "#fffaf5"
  warning-border: "#ffeeba"
  warning-dark-text: "#856404"
  warning-active-bg: "#fff8e1"
  white: "#ffffff"
  gray-50: "#f8f9fa"
  gray-100: "#f5f5f5"
  gray-200: "#eeeeee"
  gray-300: "#dddddd"
  gray-400: "#cccccc"
  gray-500: "#999999"
  gray-600: "#777777"
  gray-700: "#666666"
  gray-800: "#333333"
  black: "#000000"
  bg: "#f4f4f4"
  overlay: "rgba(0, 0, 0, 0.6)"
  overlay-light: "rgba(0, 0, 0, 0.4)"
  modal-header: "#88b6c2"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "normal"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
  mono:
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-800}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  stat-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-800}"
    rounded: "{rounded.md}"
    padding: "12px"
  input-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.gray-800}"
    rounded: "{rounded.sm}"
    height: "44px"
---

# Design System: App Inventário IFC

## Overview

**Creative North Star: "O Caderno de Campo"**

O App Inventário IFC é uma prancheta digital: metódica, confiável, funcional. Cada elemento na tela tem uma tarefa específica — nada existe por decoração. A interface é uma ferramenta de trabalho que opera em movimento, sob luz variável, em celulares pessoais de equipes não-técnicas. A linguagem visual recusa adorno e abraça a clareza como valor estético supremo.

A atmosfera é **funcional e direta**. Não há gradientes, ilustrações, ou micro-interações decorativas. A beleza do sistema está na precisão: cores semânticas que comunicam estado instantaneamente (azul = ação, verde = ok, vermelho = alerta, laranja = atenção), tipografia do sistema que garante legibilidade máxima em qualquer dispositivo, e uma grelha de 4px que impõe ritmo sem que o operador perceba. A interface desaparece para que o patrimônio apareça.

Os componentes são **industriais e robustos**: bordas visíveis (1px sólida), cantos controlados (4px), altura mínima de toque de 44px, e contraste alto entre superfície e conteúdo. Como equipamento de fábrica, cada botão e input foi dimensionado para operação em condições reais — dedos sujos, luminosidade variável, pressa. O feedback tátil visual (scale:active a 0.97) confirma cada interação sem depender de animações complexas.

**Key Characteristics:**
- Paleta cromática semântica: cada cor carrega significado funcional (ação, sucesso, perigo, atenção)
- Sistema de espaçamento com base 4px, idêntico ao grid do navegador
- Alvos de toque de 44px (WCAG AAA para mobile)
- Tipografia exclusivamente do sistema operacional — zero fontes web, zero tempo de carregamento
- Flat por padrão; sombras raras e exclusivamente estruturais (modals, overlay)
- Transições rápidas (100-200ms ease) — a interface responde, não desfila
- Estados visuais binários: highlight-warning e highlight-danger como anéis coloridos nos cards

## Colors

A paleta é organizada por função, não por matiz. Cada cor existe para sinalizar um estado do sistema ou uma ação disponível. Não há cor "de marca" no sentido tradicional — o azul primário é operacional, não aspiracional.

### Primary
- **Azul Operacional** (#007bff): Ação principal, links, foco de teclado, estados ativos. Presente em botões primários (`.btn-primary`), células clicáveis (`.cell-link`), localizações interativas (`.clickable-location`), e no anel de `:focus-visible` global. Seu hover (#0056b3) escurece ~15% sem mudar de tom. Sua versão clara (`rgba(0,123,255,0.1)`) serve como background de hover em elementos de navegação.

### Semantic
- **Verde de Confirmação** (#198754): Sucesso, sincronizado, encontrado. Botão de salvar em modals (`.btn-modal-save`), texto de métricas positivas (`.text-success`), badge de status SYNCED. A versão escura (#188038) aparece em métricas de itens encontrados (`.stat-found`). O fundo claro (#e8f5e9) não é usado diretamente como token, mas o padrão de "verde = confirmado" é sistêmico.
- **Vermelho de Alerta** (#dc3545): Perigo, falha, offline, erro. Botão de ação destrutiva (`.btn-red`, `.btn-danger-full`), banner offline (`#offlineBanner`), badge FAILED, highlight de card com falhas (`.highlight-danger`). O fundo claro (#fff5f5) acompanha cards em estado de erro. A versão escura (#d93025) aparece em métricas de itens faltantes (`.stat-missing`).
- **Laranja de Atenção** (#c26400 / #ffc107): Atenção, pendente, advertência. Card de itens pendentes (`.highlight-warning`), badge PENDING, área de aviso ativa (`#warning-area.warning-active`). O fundo de card em alerta usa `warning-light` (#fffaf5), enquanto a área de aviso ativa usa `warning-active-bg` (#fff8e1) — um tom mais quente e saturado que se destaca mesmo sob luz solar. A borda (#ffeeba) e o texto escuro (#856404) completam o contêiner de advertência.

### Neutral
- **Branco** (#ffffff): Fundo de cards, inputs, modals, tabelas. A superfície de conteúdo padrão.
- **Cinza Fundo** (#f4f4f4): Background da página (`body`). Separa-se sutilmente do branco dos cards.
- **Cinza 50** (#f8f9fa): Cabeçalho de tabela, fundo de popup-header. Um off-white funcional.
- **Cinza 100** (#f5f5f5): Fundo de botão cancelar, hover leve. Quase branco, mas distinto.
- **Cinza 200** (#eeeeee): Cabeçalho de tabela (th), fundo de paginação, fundo de footer. A primeira camada cinza visível.
- **Cinza 300** (#dddddd): Bordas de tabela, borda de input readonly. A borda padrão para separação interna.
- **Cinza 400** (#cccccc): Bordas de input, select, e contêineres de tabela. A borda externa visível.
- **Cinza 500** (#999999): Borda de botão base, placeholder visual. Contraste médio.
- **Cinza 600–700** (#777777, #666666): Texto secundário, metadados, legendas.
- **Cinza 800** (#333333): Texto principal, títulos, corpo. O "preto" funcional do sistema.
- **Preto** (#000000): Fundo da área de câmera/scanner. Uso restrito ao contexto de vídeo.

### Surface & Overlay
- **Modal Header** (#88b6c2): Azul acinzentado claro, exclusivo do cabeçalho de modals full-screen. Uma cor de atmosfera, não semântica — identifica visualmente o contexto modal sem competir com as cores de ação.
- **Overlay** (rgba(0,0,0,0.6)): Backdrop de modal de confirmação (AppModal). Escuro o suficiente para bloquear o fundo.
- **Overlay Light** (rgba(0,0,0,0.4)): Backdrop de overlay de loading e not-found. Mais leve que o de confirmação.

### Named Rules
**A Regra da Cor Única.** A cor primária azul aparece em no máximo 15% dos pixels de qualquer tela. Sua raridade é o que a torna informativa — se tudo é azul, nada é ação.

**A Regra do Significado Único.** Nenhuma cor semântica compartilha significado. Verde = sucesso e apenas sucesso. Vermelho = perigo e apenas perigo. Laranja = atenção e apenas atenção. Um botão vermelho nunca deve significar "salvar"; um card verde nunca deve indicar "pendente".

**A Regra do Cinza Estrutural.** Os 10 passos de cinza (white a black) formam a espinha dorsal do sistema. Nenhum elemento estrutural — borda, fundo, separador — usa cor cromática. Cinza é a arquitetura; cor é o sinal.

## Typography

**Display Font:** Nenhuma — o sistema usa exclusivamente fontes nativas do sistema operacional.
**Body Font:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
**Mono Font:** `'Consolas', 'Monaco', 'Courier New', monospace` (apenas no console de debug)

**Character:** A tipografia é inteiramente delegada ao sistema operacional. Zero fontes web, zero requisições de rede, zero FOUT (Flash of Unstyled Text). Em iOS, renderiza com San Francisco; em Android, com Roboto; em Windows, com Segoe UI. A personalidade tipográfica é nativa da plataforma, não do aplicativo. Esta é uma decisão de performance e confiabilidade — o app funciona offline e cada kilobyte importa.

### Hierarchy
- **Headline** (800, 1.5rem/24px, 1.2): Valor principal do contador em modo foco (`.focus-count`), valor de estatística (`.stat-value`). Uso restrito a números grandes de dashboard. Peso 900 no modo foco para máximo impacto numérico.
- **Title** (700, 1.25rem/20px, 1.3): Títulos de modal (h2 em `.modal-header`), labels de seção. Também h1 da aplicação (centralizado). Transmite hierarquia sem ocupar altura excessiva.
- **Body** (400, 1rem/16px, 1.5): Texto corrido em modals, labels de formulário, conteúdo de tabela. 16px é o piso para evitar zoom automático no iOS ao focar inputs. Linhas de texto raramente excedem 40-50 caracteres em mobile.
- **Label** (700, 0.75rem/12px, uppercase implícito via `.stat-label`): Rótulos de cards de estatística, cabeçalhos de coluna de tabela compacta, o texto "Stat" na tabela de leituras. Apenas `.stat-label` aplica `text-transform: uppercase` explicitamente; labels de formulário mantêm case normal.
- **Small** (400, 0.75rem/12px): Texto auxiliar: contador de caracteres, legenda de footer, metadados de versão. Cor mais clara (gray-600/700).
- **Mono** (400, 0.875rem/14px): Exclusivo para o console de debug (`.debug-console`). Fonte verde sobre fundo escuro (`.color-debug-text` sobre `.color-debug-bg`).

### Named Rules
**A Regra da Fonte Zero.** Nenhuma fonte é carregada da web. A tipografia usa exclusivamente a pilha de fontes do sistema operacional. Isto não é uma limitação — é uma garantia de performance offline e legibilidade nativa.

**A Regra do Peso como Sinal.** Peso 400 para corpo (neutro), 700 para títulos e labels (estrutura), 800-900 para números grandes (impacto). A variação de peso é o principal diferenciador hierárquico — não tamanho, não cor.

## Layout

O layout é single-column, full-width, com padding de 8px no body. Todo conteúdo flui verticalmente em uma única coluna que ocupa 100% da largura da viewport. Não há sidebar, não há grid multi-coluna no mobile.

A largura é contida apenas indiretamente: elementos como `.control-row`, `#videoArea`, `.stats-container`, e `select.w-100` aplicam `max-width: 100%; width: 100%` — eles preenchem a tela mas não a excedem. O container de modal de confirmação (`.app-modal-box`) é a única exceção, com `max-width: 400px; width: 90%`.

O dashboard de estatísticas usa grid de 2 colunas no mobile (`.stats-container`: `grid-template-columns: repeat(2, 1fr)`) e salta para 4 colunas em telas acima de 600px. O card de resumo geral (`.stat-card.full-width`) sempre ocupa a largura total (`grid-column: 1 / -1`).

Espaçamento vertical entre seções é definido por margens nos elementos: `var(--space-sm)` entre cards de estatística, `var(--space-lg)` abaixo do container de stats. O ritmo vertical é consistente — múltiplos de 4px ou 8px — sem colapso de margens acidental.

Modals full-screen ocupam 100vw × 100svh (usando a unidade `svh` para evitar problemas com barras de navegação mobile). O corpo do modal usa `overflow-y: auto` com `-webkit-overflow-scrolling: touch` para scroll suave no iOS.

O footer é um bloco fixo ao final do fluxo (`flex-shrink: 0` dentro do body flex column), com fundo cinza 200 e borda superior.

### Breakpoints
- **Mobile padrão:** < 600px — grid de stats 2 colunas, altura de câmera 180px
- **≥ 600px:** grid de stats salta para 4 colunas
- **≥ 768px:** altura da área de câmera sobe para 400px, altura mínima de input/select sobe para 44px (redundante, já é 44px em mobile)

### Spacing Rhythm
A escala de espaçamento (`--space-xs` a `--space-3xl`) segue múltiplos de 4px: 4, 8, 12, 16, 20, 24, 32. O passo de 12px é o único desvio do grid de 8px padrão — aparece em padding de cards (`.stat-card`) e botões (`.btn`).

## Elevation & Depth

O sistema é **flat por padrão**. Superfícies são separadas por cor de fundo (body `#f4f4f4` vs card `#ffffff`) e bordas (`1px solid`), não por sombras. A hierarquia espacial é cromática, não luminosa.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 3px rgba(0,0,0,0.06)`): Aplicado exclusivamente a `.stat-card`. Uma sombra tão sutil que é quase imperceptível — serve mais como anti-aliasing visual entre o card branco e o fundo cinza do que como indicação de elevação.
- **Modal** (`box-shadow: 0 4px 15px rgba(0,0,0,0.3)`): Exclusivo de `.app-modal-box`. A única sombra que afirma presença — o modal de confirmação paira sobre o overlay escuro. Sua função é exclusivamente estrutural: separar o diálogo de confirmação do fundo bloqueado.
- **Highlight rings** (`box-shadow: 0 0 0 2px <color>`): Anel de 2px sem blur que contorna cards em estado de atenção (`.highlight-warning`: laranja) ou erro (`.highlight-danger`: vermelho). Não é elevação — é sinalização. Funciona como uma borda externa que não afeta o box-model.

### Named Rules
**A Regra do Flat por Padrão.** Superfícies são planas em repouso. Sombras aparecem exclusivamente como resposta a estado: `.app-modal-box` (sobreposição de diálogo), `.highlight-warning`/`.highlight-danger` (anel de alerta), `:focus-visible` (anel de acessibilidade). Se não há estado extraordinário, não há sombra.

**A Regra do Overlay como Profundidade.** A separação entre o aplicativo e um modal não é feita com sombra — é feita com overlay escuro (rgba 0.6 ou 0.4). O fundo recua; o modal não "flutua", ele substitui o contexto.

## Shapes

A linguagem de formas é utilitária e contida. Os cantos são arredondados em três passos fixos: 4px (sm) para botões e inputs, 8px (md) para cards e contêineres, 12px (lg) reservado para uso futuro. Nenhum elemento usa border-radius acima de 12px — não há pílulas, círculos, ou formas orgânicas.

Bordas são sólidas (`solid`), 1px, e seguem a escala de cinza: gray-400 para bordas externas (inputs, selects, contêineres de tabela), gray-300 para bordas internas (células de tabela), gray-200 para separadores leves (cabeçalho de modal). Nenhuma borda usa cor cromática.

O modal de confirmação (`.app-modal-box`) é a forma mais característica do sistema: um retângulo centrado com cantos 8px, sombra pronunciada, e animação de entrada que combina fade com scale (0.9 → 1). O overlay simultâneo transiciona opacidade (0 → 1) em 200ms.

Tabelas usam `border-collapse: collapse` universalmente, com bordas de 1px em todas as células. Cantos de contêiner de tabela são arredondados apenas no topo (`border-radius: 8px 8px 0 0` no `.table-header-container`) para integração visual com a tabela sem borda superior.

### Named Rules
**A Regra dos Cantos Discretos.** Nenhum raio de borda excede 12px. O arredondamento suaviza a forma sem torná-la "amigável" — este é um sistema industrial, não convidativo. 4px é o raio padrão; 8px sinaliza um contêiner; 12px é o máximo absoluto.

## Components

### Buttons
- **Shape:** Cantos 4px (`--radius-sm`), altura mínima 44px (`--control-height`), padding lateral 12px (`--space-md`). Texto em uppercase, peso bold, tamanho 0.75rem.
- **Primary (.btn-primary):** Fundo azul operacional, texto branco, borda azul. Ação principal de formulário, chamada de atenção.
- **Danger (.btn-red, .btn-danger-full):** Fundo vermelho, texto branco. Ação destrutiva. `.btn-danger-full` ocupa 100% de largura com altura 130% do padrão.
- **Success (.btn-green, .btn-modal-save):** Fundo verde, texto branco. Ação de salvar/confirmar em modals.
- **Ghost (.btn, .btn-modal-cancel):** Fundo branco, texto cinza-800, borda cinza-500. Ação secundária ou cancelar.
- **Edit (.btn-edit):** Fundo azul, texto branco, sem borda, padding reduzido. Exclusivo para o botão "Editar" nas linhas da tabela.
- **Hover:** `filter: brightness(0.95)` na maioria dos botões; `.btn-edit` usa 0.9. Transição 100ms ease.
- **Active:** `transform: scale(0.97)` com transição 100ms ease. Feedback tátil universal.
- **Focus:** Anel azul 2px com 2px offset. Visível apenas em navegação por teclado (`:focus-visible`).
- **Disabled:** Opacidade 0.5, cursor not-allowed, pointer-events none, sem hover/active.

### Cards
- **Stat Card (.stat-card):** Fundo branco, padding 12px, cantos 8px, altura mínima 70px. Flex column centrado. Sombra 0 1px 3px (quase imperceptível). Contém label (uppercase, small, cinza-700) e valor (1.5rem, peso 800).
- **Full-width variant (.stat-card.full-width):** Ocupa todas as colunas do grid (`grid-column: 1 / -1`), altura mínima 100px, texto alinhado à esquerda. Usado para o card de resumo geral.
- **Highlight Warning (.stat-card.highlight-warning):** Anel laranja 2px + fundo laranja claro. Ativado quando `stats.pending > 0`.
- **Highlight Danger (.stat-card.highlight-danger):** Anel vermelho 2px + fundo vermelho claro. Ativado quando `stats.failed > 0`.

### Tables
- **Data Table (.data-table):** `border-collapse: collapse`, fonte 0.875rem. Th: padding 8px, bold, borda gray-400, texto à esquerda. Td: padding 8px, borda gray-300.
- **Barcode Table (#barcode-table):** Cabeçalho com fundo gray-200 e borda gray-400. Container com header cinza-50 e borda arredondada 8px 8px 0 0. Célula de localização clicável (`.cell-link`: azul, sublinhado, pointer). Coluna de status com emoji centralizado. Botão "Editar" compacto na coluna de ação.
- **Compact Table (.compact-table):** Usada dentro do card de resumo. Texto menor, cabeçalho uppercase cinza-600, células separadas por borda gray-100. Sem borda externa — a tabela é conteúdo do card.
- **Pagination:** Container cinza-200 com borda gray-400, mesma largura da tabela, sem border-top. Botões de paginação quadrados (mín. 44px), desabilitados com opacidade 0.4.

### Inputs & Fields
- **Text/Number/Textarea:** Fonte 16px (piso para evitar zoom iOS), borda 1px gray-400, cantos 4px, fundo branco, altura 44px. Padding lateral 8px. Focus: anel azul 2px + 2px offset.
- **Select:** 100% largura, padding 8px, fonte 16px, cantos 4px, borda gray-400, altura 44px. `white-space: normal` para quebra de texto em options longas.
- **Readonly (.input-modal-readonly):** Fundo gray-100, borda gray-300, texto gray-600, pointer-events none. Dados de inventário que não podem ser alterados.
- **Edit (.input-modal-edit):** Borda gray-400, altura 48px. Campos editáveis dentro de modals.

### Modals
- **Full-Screen (.modal-full, .modal-fullscreen, .full-screen):** 100vw × 100svh, fundo branco, z-index 2000, flex column, animação fadeIn (opacity 0→1 + translateY 10px→0 em 200ms). Header com fundo modal-header (#88b6c2), padding 8px, border-bottom gray-200, título centralizado. Body com padding 20px, scroll vertical.
- **Dialog (.app-modal-overlay + .app-modal-box):** Overlay fixo com rgba preto 0.6, z-index 9999, flex centrado. Box com 90% largura (max 400px), padding 20px, cantos 8px, sombra 0 4px 15px, animação scale 0.9→1. Título em vermelho (danger) por padrão. Ações alinhadas à direita com gap 8px.
- **Overlay simples (#notFoundOverlay, #messageModalOverlay):** Fundo rgba preto 0.4, z-index 1900, display none por padrão. Usado como camada de fundo para modals full-screen que precisam bloquear interação com a página.

### Navigation
- **Clickable Location (.clickable-location):** Texto azul, pointer, padding 2px 4px, cantos 4px. Hover: fundo azul claro + underline + translateX(4px). Active: scale(0.98). Usado para nomes de localização no card de resumo — cada localidade é um link que redefine o filtro global.
- **Cell Link (.cell-link):** Texto azul, pointer, sublinhado. Hover: azul hover (#0056b3). Usado na coluna de localização da tabela de leituras para navegação rápida entre contextos.

### Special
- **Offline Banner (#offlineBanner):** Fixo no topo, 100% largura, fundo danger, texto branco, padding 8px, z-index 9000. Visível apenas quando offline.
- **Warning Area (#warning-area):** Texto centralizado, altura mínima 1.2em. Estado ativo (`.warning-active`): fundo amarelo claro, texto warning escuro, padding 8px, borda esquerda 3px laranja.
- **Loading Overlay (#loadingOverlay):** Fixo, full-screen, fundo rgba preto 0.4, z-index 9999, cursor wait. Bloqueia toda interação durante operações assíncronas críticas.
- **Sync Icon (#syncStatusIcon):** Emoji 🔁 com animação de rotação infinita (`animation: app-icon-spin 1s linear infinite`) durante fetch. Troca para ✅ quando sincronizado. Cor azul durante rotação.
- **Footer (.app-footer):** Padding 16px, fundo gray-200, borda superior gray-400, texto cinza-700, 0.75rem, centralizado. Contém build version com link.

## Do's and Don'ts

### Do:
- **Do** usar cores exclusivamente com seu significado semântico: azul para ação, verde para sucesso, vermelho para perigo, laranja para atenção
- **Do** manter altura mínima de 44px em todos os elementos interativos (botões, inputs, selects)
- **Do** usar a pilha de fontes do sistema operacional — nunca carregar fontes web
- **Do** aplicar `filter: brightness(0.95)` como hover de botão e `transform: scale(0.97)` como feedback de toque
- **Do** usar a escala de cinza para estrutura (bordas, fundos, separadores) e cores cromáticas apenas para sinalização
- **Do** usar `:focus-visible` (não `:focus`) para anéis de foco — mouse users não devem ver outline
- **Do** usar `height: 100svh` (não `100vh`) em modals full-screen para evitar corte em barras de navegação mobile
- **Do** respeitar `prefers-reduced-motion: reduce` — todas as animações e transições devem parar

### Don't:
- **Don't** usar sombras como elemento decorativo. Sombra só aparece em modals (separação estrutural) e highlights (sinalização de estado)
- **Don't** exceder 12px de border-radius em qualquer elemento
- **Don't** usar gradientes, blur, ou backdrop-filter — a estética é plana e sólida
- **Don't** introduzir novas cores cromáticas além das quatro semânticas (azul, verde, vermelho, laranja)
- **Don't** usar texto com menos de 12px (0.75rem) exceto em contexto de debug
- **Don't** usar `text-transform: uppercase` fora de `.stat-label` e `.btn` — uppercase é ênfase estrutural, não estilo
- **Don't** carregar ícones como dependência externa. Emoji Unicode e SVG inline são as únicas fontes de ícones aceitáveis

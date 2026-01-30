/**
 * Executa quando o usuário abre o aplicativo web pela URL.
 * Essa função é responsável por servir o arquivo HTML principal (index.html).
 */
function doGet(event, title='Aplicativo leitor', faviconUrl='https://videira.ifc.edu.br/wp-content/themes/ifc/img/ifc.png') {
  return HtmlService
    // 1. Cria um template a partir do arquivo 'index.html'.
    // Isso permite que o código Apps Script (como <?!= include() ?>) seja executado.
    //.createTemplateFromFile('index') // Se usar template, alterar minify para false no arquivo vite.config.js

    // 2. Avalia (processa) o template, executando qualquer código Apps Script embutido.
    //.evaluate()

    .createHtmlOutput(getHtmlContent())

    // 3. Define o título que aparece na aba do navegador.
    .setTitle(title)

    // 4. Define o ícone de favoritos (favicon) da aplicação.
    .setFaviconUrl(faviconUrl)

    // 5. Configura o modo sandbox de segurança. IFRAME é o modo mais seguro e moderno.
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    
    // 6. Adiciona a meta tag viewport, essencial para garantir que a interface seja
    // responsiva e se adapte corretamente a telas de celular.
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


/**
 * Inclui o conteúdo de um arquivo HTML como string dentro de um HTML Template.
 *
 * Esta função é chamada dentro de um HTML Template usando a sintaxe de impressão de scriptlets:
 * Exemplo: <?!= include('Style'); ?>
 *
 * @param {string} filename O nome do arquivo .html no projeto (sem a extensão).
 * @returns {string} O conteúdo do arquivo HTML espec
 */
function include(filename) {
  return HtmlService
    // 1. Cria um objeto HtmlOutput a partir do arquivo nomeado.
    .createHtmlOutputFromFile(filename)

    // 2. Extrai o conteúdo HTML/texto do objeto.
    // É esse conteúdo que é injetado no lugar do scriptlet <?!= include(...) ?>.
    .getContent();
}
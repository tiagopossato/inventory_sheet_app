/**
 * @OnlyCurrentDoc
 */

const deploymentId = ""; // Substitua pelo ID real do deployment da interface web

/* FUNÇÕES PARA ACESSO DA BIBLIOTECA */
const interfaceTitle = "Leitora de código de barras"
function doGet(evt) { return InterfaceLeitora.doGet(evt, title = interfaceTitle); }
function getInventoryData() { return InterfaceLeitora.getInventoryData(); }
function getInventorySummary(targetLocation = null) { return InterfaceLeitora.getInventorySummary(targetLocation); }
function getUserName() { return InterfaceLeitora.getUserName(); }
function saveCodeBatch(items) { return InterfaceLeitora.saveCodeBatch(items); }
function saveMessage(payload) { return InterfaceLeitora.saveMessage(payload); }
function getNotFoundItens(targetLocation) { return InterfaceLeitora.getNotFoundItens(targetLocation); }
function getAppSettings() { return InterfaceLeitora.getAppSettings(); }
/* fim das funções para acesso da biblioteca */

/* -----MENU DA PLANIHA--------- */

/**
 * Cria o menu personalizado no Google Sheets.
 */
function onOpen(e) {
  const menu = SpreadsheetApp.getUi().createMenu("APP Inventário");
  menu
    .addItem('Exibir link do leitor', 'openReader')
    // .addItem('Gerar e Baixar JSON do inventário base', 'mostrarPromptDownload')
    .addToUi();
}

/**
 * Exibe uma janela modal com o link direto para o aplicativo.
 */
function openReader() {
  const url = `https://script.google.com/a/macros/ifc.edu.br/s/${deploymentId}/exec`;

  // Usando QuickChart.io (API Externa estável)
  // Parâmetros: width, height e data (URL codificada)
  const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=200&margin=1`;

  const htmlContent = `
    <style>
      body { margin: 0; padding: 20px; font-family: 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa; }
      .container { 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        justify-content: center; 
        background: white;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      .qr-code {
        margin: 10px 0 20px 0;
        mix-blend-mode: multiply; /* Melhora visualização em fundos brancos */
      }
      .btn {
        background-color: #1a73e8;
        color: white;
        padding: 14px 20px;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
        text-align: center;
        width: 90%;
        display: block;
        box-sizing: border-box;
        transition: background 0.2s;
      }
      .btn:hover { background-color: #1557b0; }
      .url-text { 
        font-size: 10px; 
        color: #999; 
        margin-top: 20px; 
        word-break: break-all; 
        text-align: center;
      }
      p { color: #5f6368; font-size: 14px; margin-bottom: 5px; text-align: center; }
    </style>
    <div class="container">
      <p>Aponte a câmera do smartphone para o código:</p>
      
      <img src="${qrCodeUrl}" class="qr-code" alt="QR Code" width="180" height="180">
      
      <a href="${url}" target="_blank" class="btn" onclick="google.script.host.close()">ABRIR NO COMPUTADOR</a>
      
      <div class="url-text">Link direto: ${url}</div>
    </div>
  `;

  const html = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(400)
    .setHeight(480)
    .setTitle('Acesso ao Inventário');

  SpreadsheetApp.getUi().showModalDialog(html, '🚀 QR Code Gerado');
}

function mostrarPromptDownload() {
  const dadosJson = getInventoryData();
  const stringJson = JSON.stringify(dadosJson);

  Logger.log(stringJson);

  // Usamos um template literal para injetar os dados de forma segura
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <body>
        <p>Iniciando download...</p>
        <script>
          (function() {
            try {
              const data = ${stringJson};
              const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
              const url = window.URL.createObjectURL(blob);
              
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = 'inventario.json';
              
              // Garante que o body existe antes de anexar
              document.body.appendChild(a);
              a.click();
              
              // Pequeno delay para garantir que o navegador processe o download antes de fechar
              setTimeout(() => {
                window.URL.revokeObjectURL(url);
                google.script.host.close();
              }, 500);
            } catch (e) {
              alert("Erro ao gerar download: " + e.message);
            }
          })();
        </script>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(300)
    .setHeight(150);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Processando Inventário');
}
# 📦 Sistema de Inventário (Vite + Google Apps Script)

Este projeto é um Web App (PWA) de alta performance para leitura de códigos de barras. Ele utiliza **Vite** para um desenvolvimento moderno, é hospedado no **Google Apps Script** e sincroniza dados em tempo real com o **Google Sheets**.

## ✨ Funcionalidades

* **Scanner Híbrido:** Utiliza a biblioteca `html5-qrcode` para máxima compatibilidade entre dispositivos, com área de foco (mira) e controle de lanterna.
* **Versionamento Automático:** Script de deploy que gera versões baseadas em data (`YYYY.MM.DD-XXX`) injetadas diretamente na interface.
* **Modo Multi-Ambiente:** Suporte nativo para ambientes de `produção` e `homologação` via flags de compilação e modos do Vite.
* **Arquitetura ES2017/V8:** Frontend modularizado e validado via ESLint para garantir compatibilidade total com o motor V8 do Google Apps Script.
* **Console de Debug:** Ferramenta integrada na tela para visualizar logs diretamente no celular.

---

## 🛠️ Requisitos de Desenvolvimento

1.  **Node.js** (v18 ou superior recomendado).
2.  **CLASP** (`npm install -g @google/clasp`).
3.  **Extensão ESLint** instalada no VS Code.

---

## 🚀 Configuração Inicial

1.  **Instale as dependências:**
    ```bash
    npm install
    ```
2.  **Autentique o Google:**
    ```bash
    clasp login
    ```
3.  **Vincule seu Script:**
    Edite o arquivo `.clasp.json` e insira o `scriptId` do seu projeto no Google Apps Script.

---

## 💻 Fluxo de Trabalho e Comandos

Utilizamos scripts automatizados para gerenciar o ciclo de vida do app.

### Comandos de Desenvolvimento

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local do Vite com Hot Module Replacement (HMR). |
| `npm run lint` | Executa o ESLint para validar sintaxe e padrões de código. |
| `npm run build` | Gera o build de produção na pasta `dist/` sem realizar o upload. |
| `npm run build:homolog` | Gera o build de homologação e inicia um preview local para testes. |

### Comandos de Deploy (CLASP + Build)

Estes comandos utilizam o `deploy.js` para processar arquivos, gerenciar versões e fazer o `clasp push` automaticamente:

| Comando | Ambiente | Descrição |
| :--- | :--- | :--- |
| `npm run deploy:homolog` | **Homologação** | Build com flag homolog -> Incrementa versão -> Push para o GAS. |
| `npm run deploy:prod` | **Produção** | Build oficial -> Incrementa versão -> Push para o GAS. |

---

## 📱 Debug em Dispositivos Móveis

Como o app roda dentro de um Iframe do Google, o debug tradicional pode ser limitado:
1.  Utilize o **Console de Debug** injetado no rodapé da página.
2.  Ele captura automaticamente `console.log`, `console.error` e erros de runtime, exibindo-os em uma área expansível diretamente no celular.

---

## 📝 Arquivos de Configuração Críticos

* `vite.config.js`: Define a lógica de bundling e injeção de variáveis (`__IS_PROD__`, etc).
* `jsconfig.json`: Configura o IntelliSense para reconhecer o objeto global `google` e tipos do GAS.
* `eslint.config.js`: Garante que sintaxes incompatíveis (como `?.` ou `??`) não cheguem ao servidor.
* `version.json`: Banco de dados local para controle do sufixo de build diário.

---

## ⚠️ Regra de Ouro
**Nunca edite os arquivos diretamente no Editor do Google Apps Script.**
As alterações feitas no navegador serão **sobrescritas** na próxima execução de qualquer comando de deploy. Todas as modificações devem ser feitas na pasta `frontend/` ou `backend/`.
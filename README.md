# 📦 Sistema de Inventário (Vite + Google Apps Script)

Este projeto é uma Web App (PWA) de alta performance para leitura de códigos de barras. Utiliza **Vite** para desenvolvimento moderno, é hospedado no **Google Apps Script** e sincroniza dados em tempo real com o **Google Sheets**.

## ✨ Funcionalidades

* **Scanner Híbrido:** Biblioteca `html5-qrcode` com máxima compatibilidade entre dispositivos, área de foco (mira) e controle de lanterna.
* **Versionamento Automático:** Script de deploy que gera versões baseadas em data (`YYYY.MM.DD-XXX`) injetadas na interface.
* **Modo Multi-Ambiente:** Suporte nativo para ambientes de `produção` e `homologação` via flags de compilação e modos do Vite.
* **Arquitetura ES2017/V8:** Frontend modularizado e validado via ESLint para compatibilidade total com o motor V8 do Google Apps Script.
* **Console de Debug:** Ferramenta integrada na tela para visualizar logs diretamente no celular.
* **Servidor Local de Testes:** Preview em tempo real com suporte a hot reload para desenvolvimento ágil.

---

## 🛠️ Requisitos de Desenvolvimento

1. **Node.js** (v18 ou superior recomendado).
2. **CLASP** (`npm install -g @google/clasp`).
3. **Extensão ESLint** instalada no VS Code.

---

## 🚀 Configuração Inicial

1. **Instale as dependências:**
    ```bash
    npm install
    ```
2. **Autentique o Google:**
    ```bash
    clasp login
    ```
3. **Configure variáveis de ambiente:**
    Copie o arquivo `.env.example` como `.env` e configure corretamente.

---

## 💻 Fluxo de Trabalho e Comandos

### Comandos de Desenvolvimento

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia servidor local com Hot Module Replacement (HMR) na porta 5173. |
| `npm run lint` | Valida sintaxe e padrões de código via ESLint. |
| `npm run build` | Gera build de produção na pasta `dist/` sem upload. |
| `npm run preview` | Gera build de homologação e inicia preview local para testes. |

### Servidor Local de Testes

O servidor local (`npm run dev`) oferece:
- **Simulação Completa:** Frontend + Backend (GAS) integrados.
- **Acesso via URL Local:** Teste em qualquer dispositivo na rede local.
- **Servidor básico para conexão com Google Sheets:** Permite testes reais de leitura e escrita.
- **Mock do Google Apps Script:** Simula contexto do GAS localmente.
- **Hot Reload:** Alterações refletem instantaneamente no navegador.
- **Ambiente Isolado:** Testa funcionalidades sem afetar produção.

O servidor local é configurado em `local_server/`. Para documentação completa, consulte [`local_server/README.md`](./local_server/README.md).

### Comandos de Deploy

| Comando | Ambiente | Descrição |
| :--- | :--- | :--- |
| `npm run deploy:homolog` | Homologação | Build com flag homolog → Incrementa versão → Push para GAS. |
| `npm run deploy` | Produção | Build oficial → Incrementa versão → Push para GAS. |

---

## 📱 Debug em Dispositivos Móveis

1. Utilize o **Console de Debug** integrado no rodapé da página.
2. Captura automaticamente `console.log`, `console.error` e erros de runtime em área expansível.

---

## 📝 Arquivos de Configuração Críticos

* `vite.config.js`: Bundling e injeção de variáveis (`__IS_PROD__`, etc).
* `jsconfig.json`: IntelliSense para objeto global `google` e tipos do GAS.
* `eslint.config.js`: Previne sintaxes incompatíveis (como `?.` ou `??`).
* `version.json`: Controle do sufixo de build diário.

---

## Exemplo de Implantação em produção

Para implantar uma cópia em produção do projeto como está, siga os seguintes passos:
1. Faça uma cópia da planilha modelo em [Planilha base Modelo](https://bit.ly/example-inventory-sheet).
2. Carregue os dados do seu inventário na aba "inventario" (ou mantenha os dados de exemplo para testar).
3. Abra o Apps Script vinculado à planilha (Extensões > Apps Script).
4. Renomeie o projeto caso desejar.
5. No editor do Apps Script, vá em Implantar > Nova Implantação > Selecione o tipo > App da web.
6. Configure quem tem acesso ao aplicativo
    1. Executar como: Usuário com acesso ao app da Web
    2. Quem pode acessar: "Qualquer pessoa com uma Conta do Google".
9. Clique em "Implantar"
10. Copie a URL do app da web.
11. Acesse a URL em um navegador.
    1. Caso solicite permissões, conceda acesso à conta Google vinculada à planilha.

Para alterar o título do app e o ícone exibido na aba do navegador, edite os parâmetros da função `doGet` em `backend/Código.gs`.

--
## ⚠️ Regra de Ouro

**Nunca edite diretamente no Editor do Google Apps Script.** Alterações serão **sobrescritas** no próximo deploy. Edite apenas em `frontend/` ou `backend/`.
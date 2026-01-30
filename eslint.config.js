import globals from "globals";
import js from "@eslint/js";

export default [
  js.configs.recommended, // Regras recomendadas do ESLint
  {
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: "module",
      globals: {
        // eslint-disable-next-line
        ...globals.browser,
        // eslint-disable-next-line
        ...globals.node,
        // Suas variáveis globais do Google e do Vite
        google: "readonly",
        assetsDatabaseFromGAS: "readonly",
        locationsFromGAS: "readonly",
        Html5Qrcode: "readonly",
        __BUILD_VERSION__: "readonly",
        __IS_PROD__: "readonly",
        __IS_HOMOLOG__: "readonly",
        __IS_DEV__: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    // Ignorar pastas de build para o linter não perder tempo nelas
    ignores: ["backups", "dist/**", "node_modules/**"]
  }
];
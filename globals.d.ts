// Definições para o Google Apps Script
import "google-apps-script";

// Definições para as variáveis do Vite (Flags)
declare const __BUILD_VERSION__: string;
declare const __IS_PROD__: boolean;
declare const __IS_HOMOLOG__: boolean;
declare const __IS_DEV__: boolean;

// Se você usa o objeto google no frontend:
declare const google: google.script.GoogleScript;
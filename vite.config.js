import { defineConfig } from 'vite';
import { viteSingleFile } from "vite-plugin-singlefile";
import { createHtmlPlugin } from 'vite-plugin-html';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import path from 'path';

// Lê o arquivo JSON da raiz
let inventoryData = null;

try {
  const inventoryPath = path.resolve(__dirname, 'frontend/inventario.json');

  if (fs.existsSync(inventoryPath)) {
    const content = fs.readFileSync(inventoryPath, 'utf-8');
    // Validamos se o JSON é válido antes de prosseguir
    try {
      inventoryData = JSON.stringify(JSON.parse(content));
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      console.error("❌ JSON inválido em inventario.json");
      inventoryData = null;
    }
  } else {
    console.warn(`⚠️ Arquivo inventario.json não encontrado em: ${inventoryPath}`);
    console.info(`A aplicação vai buscar os dados do inventário de forma dinâmica na planilha.\n\n`);
    inventoryData = null;
  }
  // eslint-disable-next-line no-unused-vars
} catch (e) {
  console.log(
    "\n⚠️  Erro ao carregar o inventário:\n" +
    "Não foi possível abrir 'frontend\\inventario.json'. Verifique se o arquivo existe,\n" +
    "se o caminho está correto e se você tem permissão de leitura.\n\n" +
    "Dicas:\n" +
    " - Confirme que 'frontend\\inventario.json' está na pasta 'frontend'.\n" +
    " - Execute o comando a partir da raiz do projeto.\n" +
    " - Se estiver usando um editor/IDE, tente reiniciar o processo de desenvolvimento.\n"
  );
}

export default defineConfig(({ mode }) => {
  // Detecta o modo atual (dev rodando local ou build para produção)
  // mode será 'homolog' se você rodou --env=homolog
  const isDev = mode === 'development';

  return {
    root: "frontend",
    define: {
      // Dados do inventário embutidos na build
      __INVENTORY_DATA__: JSON.stringify(inventoryData || null),

      __HAS_INVENTORY_DATA__: inventoryData ? true : false,

      // Flag para Desenvolvimento (npm run dev)
      __IS_DEV__: JSON.stringify(mode === 'development'),

      // Flag para Homologação (node deploy.js --env=homolog)
      __IS_HOMOLOG__: JSON.stringify(mode === 'homolog'),

      // Flag para Produção (node deploy.js --env=production)
      __IS_PROD__: JSON.stringify(mode === 'production'),

      __BUILD_VERSION__: JSON.stringify(process.env.VITE_BUILD_VERSION || "dev"),
    },

    plugins: [
      basicSsl(),
      viteSingleFile(),
      createHtmlPlugin({
        minify: false,
        inject: {
          data: {
            // Variável que o Vite buscará no HTML
            __HAS_INVENTORY__: inventoryData ? true : false,
          },
        },
      }),
    ],

    build: {
      outDir: "../dist",
      emptyOutDir: false, // Garante que a pasta limpa antes de gerar
      target: "es2015", // Seguro para GAS

      // Minify false é bom para debug no GAS, mas pode deixar o arquivo grande.
      // Se ficar lento para abrir no Google, mude para 'esbuild'.
      
      // caso necessário utilizar template com evaluate no GAS, mantenha minify em false, 
      // pois o GAS não consegue lidar com arquivos minificados devido aos caracteres ?
      minify: mode === 'production' ? 'esbuild' : false,

      cssMinify: true,
      assetsInlineLimit: 100000000,

      rollupOptions: {
        output: {
          // 2. FORMATO IIFE:
          // Essencial para o GAS. Remove "export" e "import" do final do arquivo,
          // embrulhando tudo numa função para não poluir o escopo global do Google.
          format: 'iife',
        }
      }
    },

    esbuild: {
      target: "es2015",
      // 3. LIMPEZA AUTOMÁTICA:
      // Remove console.log e debugger apenas se NÃO for dev.
      drop: isDev ? [] : ['debugger'],
      pure: isDev ? [] : ['console.log', 'console.info'],

      supported: {
        'class': false, // Mantém sua trava de segurança (transforma class em function)
        'async-await': true // GAS suporta async/await nativamente no V8 moderno
      }
    }
  };
});
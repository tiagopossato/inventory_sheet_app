import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';

// Carrega as variáveis do .env
dotenv.config();

function setupClaspJson() {
    const template = fs.readFileSync('.clasp.json.template', 'utf8');
    // Substitui a variável do template pela variável do seu arquivo .env
    const finalConfig = template.replace('${SCRIPT_ID}', process.env.CLASP_SCRIPT_ID);
    fs.writeFileSync('.clasp.json', finalConfig);
    console.log('✅ .clasp.json gerado com sucesso!');
}
/**
 * Solicita confirmação no terminal
 */
function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        // Exibimos (s/N) para indicar que o 'N' é o padrão (default)
        rl.question(`${question} (s/N): `, (answer) => {
            rl.close();

            const normalizedAnswer = answer.trim().toLowerCase();

            // Se o usuário apenas apertar ENTER, normalizedAnswer será ""
            // Portanto, ele só retorna true se digitar explicitamente 's' ou 'sim'
            resolve(normalizedAnswer === 's' || normalizedAnswer === 'sim');
        });
    });
}

async function deploy() {
    try {
        // 1. Ler e Incrementar a Versão
        const versionFile = './version.json';
        let versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));

        // 1. Gerar Data Atual (YYYY.MM.DD)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateString = `${year}.${month}.${day}`;

        // 2. Lógica de Incremento
        // Se a data do arquivo for igual a hoje, incrementa o sufixo.
        // Se for um dia diferente, volta o sufixo para 1.
        if (versionData.lastDate === dateString) {
            versionData.suffix += 1;
        } else {
            versionData.lastDate = dateString;
            versionData.suffix = 1;
        }

        // Formata o sufixo com 3 dígitos (ex: 001, 002)
        const formattedSuffix = String(versionData.suffix).padStart(3, '0');
        const fullVersion = `${dateString}-${formattedSuffix}`;

        // Salva o novo número no arquivo
        fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));

        // 1. Captura os argumentos (ex: node deploy.js --env=homolog)
        const args = process.argv.slice(2);

        // Primeiro buscamos o argumento
        const envMatch = args.find(arg => arg.startsWith('--env='));
        // Se ele existir, fazemos o split, se não, usamos 'production'
        const envArg = envMatch ? envMatch.split('=')[1] : 'production';

        if (envArg === 'production') {
            const proceed = await askConfirmation("⚠️  Você está prestes a fazer deploy em PRODUÇÃO. Deseja prosseguir?");
            if (!proceed) {
                console.log("\n❌ Deploy cancelado pelo usuário.");
                process.exit(0);
            }
        }

        console.log(`\n🚀 Gerando Build: ${fullVersion} [${envArg.toUpperCase()}]`);

        // 2. Executa o build do Vite repassando o modo
        // O "--" antes de "--mode" é essencial para o npm repassar o comando ao Vite
        execSync(`npm run build -- --mode ${envArg}`, {
            stdio: 'inherit',
            env: {
                // eslint-disable-next-line
                ...process.env,
                VITE_BUILD_VERSION: fullVersion // Passamos a string completa
            }
        });

        console.log(`\n✅ Deploy da versão ${fullVersion} concluído!`);

        // 3. Copiar arquivos do backend para a pasta dist
        const backendDir = './backend';
        const distDir = './dist';

        const files = fs.readdirSync(backendDir);
        files.forEach(file => {
            if (file.endsWith('.gs') || file.endsWith('.js') || file === 'appsscript.json') {
                fs.copyFileSync(
                    path.join(backendDir, file),
                    path.join(distDir, file)
                );
            }
        });
        console.log("✅ Arquivos backend copiados para dist/");

        // 4. Clasp Push
        console.log("📤 Enviando arquivos para o servidor do Google...");
        setupClaspJson();
        execSync('npx clasp push', { stdio: 'inherit' });

        const deploymentId = process.env.DEPLOYMENT_ID;

        if (process.env.ASK_FOR_DEPLOY) {
            let confirm = await askConfirmation("🚀 Deseja implantar (deploy) uma nova versão de produção no Google?");

            if (confirm) {
                console.log(`🌐 Atualizando o Deployment (${deploymentId}) para a Versão ${fullVersion}...`);

                // COMANDO CRÍTICO: Atualiza o deployment existente para a nova versão
                execSync(`clasp update-deployment ${deploymentId} -d "Auto-deploy: ${fullVersion}"`, { stdio: 'inherit' });

                console.log(`\n✨ SUCESSO! A versão ${fullVersion} agora está AO VIVO na produção.`);
            } else {
                console.log("\n🎉 Deploy completo! ⚠️ Implantação em produção cancelada.");
            }
        } else {
            console.log(`\n✨ SUCESSO! A versão ${fullVersion} foi enviada.`);
        }
    } catch (error) {
        console.error("❌ Falha no deploy:", error.message);
        process.exit(1);
    }
}

deploy();
import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleSheetsService } from './google-sheets-service.js';
import { GASSimulation } from './gas-simulation.js';
import { CONFIG } from './config.js';
import os from 'os';
import { join } from 'path';
import fs from 'fs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Verificar se deve rodar na rede local
const shouldUseHost = process.argv.includes('--host');
const HOST = shouldUseHost ? '0.0.0.0' : 'localhost';

// Verificar se deve usar HTTPS
const useHTTPS = process.argv.includes('--https') || process.env.HTTPS === 'true';

// Configuração mínima para desenvolvimento
app.use(cors({
    origin: '*', // Permite absolutamente todas as origens
    credentials: true
}));

app.use(express.json());

// Inicialização
let gasSimulation;

async function initializeServer() {
    try {
        console.log('🔄 Inicializando servidor...');

        const sheetsService = new GoogleSheetsService();
        await sheetsService.initialize(CONFIG.credentials, CONFIG.spreadsheetId);

        gasSimulation = new GASSimulation(sheetsService);
        console.log('✅ Servidor inicializado com sucesso');
    } catch (error) {
        console.error('❌ Erro ao inicializar servidor:', error.message);
    }
}

// Função para obter endereços IP da rede local
function getNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];

    Object.keys(interfaces).forEach(ifaceName => {
        interfaces[ifaceName].forEach(iface => {
            if ('IPv4' === iface.family && !iface.internal) {
                ips.push(iface.address);
            }
        });
    });

    return ips;
}

// Rotas (mantenha as mesmas rotas do seu código anterior)
app.get('/', (req, res) => {
    res.json({
        message: 'Servidor de teste GAS funcionando',
        status: gasSimulation ? 'Conectado' : 'Erro na inicialização',
        environment: shouldUseHost ? 'rede local' : 'localhost',
        protocol: useHTTPS ? 'HTTPS' : 'HTTP',
        endpoints: [
            'GET /api/inventory-data',
            'GET /api/inventory-summary?location=LOCAL',
            'GET /api/not-found-items?location=LOCAL',
            'GET /api/app-settings',
            'POST /api/save-batch',
            'POST /api/save-message'
        ]
    });
});

// ... (suas rotas existentes mantêm a mesma implementação)
app.get('/api/inventory-data', async (req, res) => {
    try {
        const result = await gasSimulation.getInventoryData();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/inventory-summary', async (req, res) => {
    try {
        const targetLocation = req.query.location || null;
        const result = await gasSimulation.getInventorySummary(targetLocation);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/not-found-items', async (req, res) => {
    try {
        const targetLocation = req.query.location;
        if (!targetLocation) {
            return res.status(400).json({ error: 'Parâmetro location é obrigatório' });
        }

        const result = await gasSimulation.getNotFoundItens(targetLocation);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/app-settings', async (req, res) => {
    try {
        const result = await gasSimulation.getAppSettings();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/save-batch', async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Array de items é obrigatório' });
        }

        const result = await gasSimulation.saveCodeBatch(items);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/save-message', async (req, res) => {
    try {
        const { uid, location, message } = req.body;
        if (!uid || !location || !message) {
            return res.status(400).json({ error: 'uid, location e message são obrigatórios' });
        }

        const result = await gasSimulation.saveMessage({ uid, location, message });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        if (!gasSimulation) {
            return res.status(500).json({ error: 'Servidor não inicializado' });
        }

        res.json({
            status: 'healthy',
            environment: shouldUseHost ? 'rede local' : 'localhost',
            protocol: useHTTPS ? 'HTTPS' : 'HTTP',
            host: HOST,
            port: PORT,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Configuração do servidor HTTPS
function createServer() {
    if (useHTTPS) {
        const keyPath = join(__dirname, 'certs', 'key.pem');
        const certPath = join(__dirname, 'certs', 'cert.pem');

        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            const options = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };
            return https.createServer(options, app);
        }
    } else {
        return http.createServer(app);
    }
}

// Iniciar servidor
async function startServer() {
    try {
        const server = await createServer();

        server.listen(PORT, HOST, async () => {
            const protocol = useHTTPS ? 'HTTPS' : 'HTTP';
            console.log(`🚀 Servidor ${protocol} rodando na porta ${PORT}`);

            if (shouldUseHost) {
                console.log(`🌐 Modo rede local ativado (--host)`);
                console.log(`📊 Acesse localmente: ${protocol.toLowerCase()}://localhost:${PORT}`);

                const networkIPs = getNetworkIPs();
                if (networkIPs.length > 0) {
                    console.log(`🌍 Acesse pela rede:`);
                    networkIPs.forEach(ip => {
                        console.log(`   ${protocol.toLowerCase()}://${ip}:${PORT}`);
                    });
                }
            } else {
                console.log(`💻 Modo localhost`);
                console.log(`📊 Acesse: ${protocol.toLowerCase()}://localhost:${PORT}`);
            }

            console.log(`🔍 Health check: ${protocol.toLowerCase()}://localhost:${PORT}/api/health`);
            await initializeServer();
        });

        return server;
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
         process.kill(process.pid, 'SIGKILL');  // Mata o processo
    }
}

// Iniciar
await startServer();
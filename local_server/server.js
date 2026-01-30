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
import Joi from 'joi';
import validator from 'validator';
import timeout from 'connect-timeout';
import rateLimit from 'express-rate-limit';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função de logging estruturado
function logStructured(level, message, meta = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta
    };
    console.log(JSON.stringify(logEntry));
}

// Função para criar middleware de validação
function validate(schema, property = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            logStructured('warn', 'Validação de requisição falhou', {
                method: req.method,
                url: req.url,
                errors,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });

            return res.status(400).json({
                error: 'Dados inválidos',
                details: errors
            });
        }

        req[property] = value;
        next();
    };
}

// Função para sanitizar entradas
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return validator.escape(validator.trim(input));
    } else if (Array.isArray(input)) {
        return input.map(item => sanitizeInput(item));
    } else if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    return input;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de timeout para requisições
const TIMEOUT_DURATION = process.env.TIMEOUT || '30s'; // 30 segundos por padrão
app.use(timeout(TIMEOUT_DURATION, {
    respond: true
}));

// Middleware de rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 requisições por janela
    message: {
        error: 'Muitas requisições',
        message: 'Limite de requisições excedido, tente novamente mais tarde'
    },
    standardHeaders: true, // Retorna informações de rate limit nos headers
    legacyHeaders: false, // Desativa os headers X-RateLimit
    skip: (req, res) => {
        // Pode pular o rate limit para certos IPs ou endpoints
        // Exemplo: pular para requisições do localhost em desenvolvimento
        if (process.env.NODE_ENV === 'development' && req.ip === '::1') {
            return true;
        }
        return false;
    }
});

// Aplica o rate limit a todas as rotas
app.use(limiter);

// Middleware para tratar timeout
app.use((req, res, next) => {
    if (req.timedout) {
        logStructured('error', 'Requisição expirou', {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            timeout: TIMEOUT_DURATION
        });

        return res.status(408).json({
            error: 'Requisição expirou',
            message: `A requisição excedeu o tempo limite de ${TIMEOUT_DURATION}`
        });
    }
    next();
});

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

// Middleware de logging
import morgan from 'morgan';
app.use(morgan('combined'));

app.use(express.json());

// Inicialização
let gasSimulation;
const MAX_RETRIES = 3;
let retryCount = 0;

async function initializeServer() {
    try {
        console.log('🔄 Inicializando servidor...');

        const sheetsService = new GoogleSheetsService();
        await sheetsService.initialize(CONFIG.credentials, CONFIG.spreadsheetId);

        gasSimulation = new GASSimulation(sheetsService);
        retryCount = 0; // Resetar contador de tentativas após sucesso
        console.log('✅ Servidor inicializado com sucesso');
    } catch (error) {
        retryCount++;
        logStructured('error', `Erro ao inicializar servidor (tentativa ${retryCount}/${MAX_RETRIES})`, {
            error: error.message,
            stack: error.stack,
            retryCount
        });

        if (retryCount < MAX_RETRIES) {
            console.log(`⏳ Tentando novamente em 5 segundos... (${retryCount}/${MAX_RETRIES})`);
            setTimeout(async () => {
                await initializeServer();
            }, 5000);
        } else {
            logStructured('fatal', 'Falha crítica na inicialização do servidor após múltiplas tentativas', {
                error: error.message,
                stack: error.stack
            });
            console.error('❌ Falha crítica: Servidor não pôde ser inicializado após múltiplas tentativas');
            process.exit(1);
        }
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
    console.log('IPs de rede local encontrados:', ips);
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
        logStructured('info', 'Recebendo requisição para dados de inventário', {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        const result = await gasSimulation.getInventoryData();
        res.json(result);
    } catch (error) {
        logStructured('error', 'Erro ao buscar dados de inventário', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        res.status(500).json({ error: error.message });
    }
});

app.get('/api/inventory-summary', async (req, res) => {
    try {
        // Sanitizar parâmetros de consulta
        const sanitizedQuery = sanitizeInput(req.query);

        logStructured('info', 'Recebendo requisição para resumo de inventário', {
            method: req.method,
            url: req.url,
            query: sanitizedQuery,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        const targetLocation = sanitizedQuery.location || null;
        const result = await gasSimulation.getInventorySummary(targetLocation);
        res.json(result);
    } catch (error) {
        logStructured('error', 'Erro ao buscar resumo de inventário', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            query: req.query,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        res.status(500).json({ error: error.message });
    }
});

app.get('/api/not-found-items', async (req, res) => {
    try {
        // Sanitizar parâmetros de consulta
        const sanitizedQuery = sanitizeInput(req.query);

        logStructured('info', 'Recebendo requisição para itens não encontrados', {
            method: req.method,
            url: req.url,
            query: sanitizedQuery,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        const targetLocation = sanitizedQuery.location;
        if (!targetLocation) {
            logStructured('warn', 'Parâmetro location ausente na requisição', {
                method: req.method,
                url: req.url,
                query: sanitizedQuery,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });

            return res.status(400).json({ error: 'Parâmetro location é obrigatório' });
        }

        const result = await gasSimulation.getNotFoundItens(targetLocation);
        res.json(result);
    } catch (error) {
        logStructured('error', 'Erro ao buscar itens não encontrados', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            query: req.query,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        res.status(500).json({ error: error.message });
    }
});

app.get('/api/app-settings', async (req, res) => {
    try {
        logStructured('info', 'Recebendo requisição para configurações do app', {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        const result = await gasSimulation.getAppSettings();
        res.json(result);
    } catch (error) {
        logStructured('error', 'Erro ao buscar configurações do app', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        res.status(500).json({ error: error.message });
    }
});


// Esquemas de validação
const saveBatchSchema = Joi.object({
    items: Joi.array().items(Joi.object({
        uid: Joi.string().required(),
        code: Joi.number().integer().required(),
        location: Joi.string().required(),
        state: Joi.number().integer().required(),
        ipvu: Joi.number().integer().required(),
        obs: Joi.string().optional().min(0).max(1000)
    })).min(1).required()
});

const saveMessageSchema = Joi.object({
    uid: Joi.string().required(),
    location: Joi.string().required(),
    message: Joi.string().required().min(1).max(1000)
});

app.post('/api/save-batch', validate(saveBatchSchema, 'body'), async (req, res) => {
    try {
        logStructured('info', 'Recebendo requisição para salvar lote de itens', {
            method: req.method,
            url: req.url,
            body: { itemsCount: req.body.items?.length },
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        // Converter o campo code para inteiro para cada item
        const items = req.body.items.map(item => ({
            ...item,
            code: parseInt(item.code, 10)
        }));

        const result = await gasSimulation.saveCodeBatch(items);
        res.json(result);
    } catch (error) {
        logStructured('error', 'Erro ao salvar lote de itens', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            body: req.body,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        res.status(500).json({ error: error.message });
    }
});

app.post('/api/save-message', validate(saveMessageSchema, 'body'), async (req, res) => {
    try {
        logStructured('info', 'Recebendo requisição para salvar mensagem', {
            method: req.method,
            url: req.url,
            body: { uid: req.body.uid, location: req.body.location },
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        const { uid, location, message } = req.body;

        const result = await gasSimulation.saveMessage({ uid, location, message });
        res.json(result);
    } catch (error) {
        logStructured('error', 'Erro ao salvar mensagem', {
            error: error.message,
            stack: error.stack,
            method: req.method,
            url: req.url,
            body: req.body,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

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

// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
    logStructured('error', 'Erro não tratado na aplicação', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });

    res.status(err.status || 500).json({
        error: {
            message: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
});

// Middleware para lidar com rotas não encontradas
app.use('*', (req, res) => {
    logStructured('warn', 'Rota não encontrada', {
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });

    res.status(404).json({
        error: 'Rota não encontrada'
    });
});

// Iniciar servidor
async function startServer() {
    try {
        const server = await createServer();

        server.listen(PORT, HOST, async () => {
            const protocol = useHTTPS ? 'HTTPS' : 'HTTP';

            logStructured('info', 'Servidor iniciado com sucesso', {
                port: PORT,
                host: HOST,
                protocol,
                mode: shouldUseHost ? 'rede local' : 'localhost'
            });

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
        logStructured('error', 'Erro ao iniciar servidor', {
            error: error.message,
            stack: error.stack
        });

        process.exit(1); // Sai do processo com código de erro
    }
}

// Iniciar
await startServer();
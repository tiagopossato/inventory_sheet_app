/**
 * Testes de integração da API do servidor local
 *
 * Requer servidor mock_server rodando em https://localhost:3000
 * Executar: node --test tests/api.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'https://localhost:3000';

// Ignora certificados self-signed
const https = await import('node:https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function get(path) {
  const url = BASE + path;
  return new Promise((resolve, reject) => {
    https.get(url, { agent }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

async function post(path, payload) {
  const url = BASE + path;
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      agent
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// Health
// ============================================================

describe('GET /api/health', () => {
  it('retorna status healthy', async () => {
    const { status, body } = await get('/api/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'healthy');
    assert.ok(body.timestamp);
  });
});

// ============================================================
// GET /api/inventory-data
// ============================================================

describe('GET /api/inventory-data', () => {
  it('retorna locations e inventory', async () => {
    const { status, body } = await get('/api/inventory-data');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.locations));
    assert.ok(Array.isArray(body.inventory));
  });

  it('locations têm name e assetsCount', async () => {
    const { body } = await get('/api/inventory-data');
    if (body.locations.length > 0) {
      const loc = body.locations[0];
      assert.ok(typeof loc.name === 'string');
      assert.ok(typeof loc.assetsCount === 'number');
    }
  });

  it('?add_spec=false não inclui name nos assets', async () => {
    const { body } = await get('/api/inventory-data?add_spec=false');
    if (body.inventory.length > 0 && body.inventory[0].assets.length > 0) {
      const asset = body.inventory[0].assets[0];
      assert.ok(asset.code !== undefined);
      assert.equal(asset.name, undefined); // sem spec name
    }
  });
});

// ============================================================
// GET /api/inventory-summary
// ============================================================

describe('GET /api/inventory-summary', () => {
  it('retorna locations e assetsFinded', async () => {
    const { status, body } = await get('/api/inventory-summary');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.locations));
    assert.ok(Array.isArray(body.assetsFinded));
  });

  it('filtra por ?location=', async () => {
    // Busca todas primeiro para pegar uma localidade real
    const all = await get('/api/inventory-summary');
    if (all.body.locations.length > 0) {
      const locName = all.body.locations[0].name;
      const filtered = await get('/api/inventory-summary?location=' + encodeURIComponent(locName));
      assert.equal(filtered.status, 200);
      assert.equal(filtered.body.locations.length, 1);
      assert.equal(filtered.body.locations[0].name, locName);
    }
  });
});

// ============================================================
// GET /api/not-found-items
// ============================================================

describe('GET /api/not-found-items', () => {
  it('retorna 400 sem location', async () => {
    const { status, body } = await get('/api/not-found-items');
    assert.equal(status, 400);
    assert.ok(body.error.includes('location'));
  });

  it('retorna array com location válida', async () => {
    const { status, body } = await get('/api/not-found-items?location=TESTE');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
  });
});

// ============================================================
// GET /api/app-settings
// ============================================================

describe('GET /api/app-settings', () => {
  it('retorna objeto de configurações', async () => {
    const { status, body } = await get('/api/app-settings');
    assert.equal(status, 200);
    assert.equal(typeof body, 'object');
  });

  it('valores boolean são realmente boolean (não string uppercase)', async () => {
    const { body } = await get('/api/app-settings');
    // inventory_open deve ser true/false (boolean), não "TRUE"/"FALSE"
    if (body.inventory_open !== undefined) {
      assert.equal(typeof body.inventory_open, 'boolean');
    }
  });
});

// ============================================================
// POST /api/save-batch
// ============================================================

describe('POST /api/save-batch', () => {

  it('salva um item válido e retorna UID', async () => {
    const uid = 'test-' + Date.now();
    const { status, body } = await post('/api/save-batch', {
      items: [{
        uid: uid,
        code: '987654321',
        location: 'TESTE-API',
        state: 1,
        ipvu: 12,
        obs: 'teste de integracao',
        source: 'test-api'
      }]
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    assert.equal(body[0], uid);
  });

  it('rejeita items sem campos obrigatórios (400)', async () => {
    const { status, body } = await post('/api/save-batch', {
      items: [{ uid: 'incompleto' }]
    });
    assert.equal(status, 400);
    assert.ok(body.details);
    assert.ok(body.details.length >= 4); // code, location, state, ipvu, source faltando
  });

  it('rejeita array vazio (400)', async () => {
    const { status } = await post('/api/save-batch', { items: [] });
    assert.equal(status, 400);
  });

  it('rejeita body sem items (400)', async () => {
    const { status } = await post('/api/save-batch', { xablau: true });
    assert.equal(status, 400);
  });

  it('atualiza item existente (mesmo UID)', async () => {
    const uid = 'test-update-' + Date.now();
    // Primeiro insert
    await post('/api/save-batch', {
      items: [{ uid, code: '111', location: 'TESTE-API', state: 1, ipvu: 0, source: 'test' }]
    });
    // Segundo: mesmo UID = update
    const { status, body } = await post('/api/save-batch', {
      items: [{ uid, code: '222', location: 'TESTE-API', state: 2, ipvu: 0, source: 'test' }]
    });
    assert.equal(status, 200);
    assert.equal(body[0], uid);
  });
});

// ============================================================
// POST /api/save-message
// ============================================================

describe('POST /api/save-message', () => {

  it('salva uma mensagem e retorna UID', async () => {
    const uid = 'msg-test-' + Date.now();
    const { status, body } = await post('/api/save-message', {
      uid: uid,
      location: 'TESTE-API',
      message: 'Mensagem de teste automatizado'
    });
    assert.equal(status, 200);
    assert.equal(body, uid);
  });

  it('rejeita sem uid (400)', async () => {
    const { status } = await post('/api/save-message', {
      location: 'X',
      message: 'Sem UID'
    });
    assert.equal(status, 400);
  });

  it('rejeita mensagem vazia (400)', async () => {
    const { status } = await post('/api/save-message', {
      uid: 'x',
      location: 'X',
      message: ''
    });
    assert.equal(status, 400);
  });

  it('mensagem duplicada (mesmo UID) retorna UID sem erro', async () => {
    const uid = 'msg-dup-' + Date.now();
    await post('/api/save-message', { uid, location: 'TESTE-API', message: 'Original' });
    const { status, body } = await post('/api/save-message', { uid, location: 'TESTE-API', message: 'Duplicada' });
    assert.equal(status, 200);
    assert.equal(body, uid);
  });
});

// ============================================================
// 404
// ============================================================

describe('Rotas inexistentes', () => {
  it('retorna 404 para rota não encontrada', async () => {
    const { status } = await get('/api/rota-que-nao-existe');
    assert.equal(status, 404);
  });
});

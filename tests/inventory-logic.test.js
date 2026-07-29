/**
 * Testes do módulo canônico inventory-logic.js
 *
 * Funções puras — sem I/O, sem mock de planilha.
 * Executar: node --test tests/inventory-logic.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  COL_INV_LOCATION,
  COL_INV_ASSET,
  COL_INV_SPECNAME,
  SPEC_NAME_MAX_LEN,
  buildInventoryData_,
  groupLeiturasByLocation,
  buildLocationSummaries,
  buildAssetsFinded,
  buildInventorySummary_,
  filterNotFoundItems_,
  buildAppSettings_
} from '../backend/inventory-logic.js';

// ============================================================
// buildInventoryData_
// ============================================================

describe('buildInventoryData_', () => {

  it('retorna vazio para array null/undefined/vazio', () => {
    assert.deepEqual(buildInventoryData_(null), { locations: [], inventory: [] });
    assert.deepEqual(buildInventoryData_([]), { locations: [], inventory: [] });
  });

  it('com addSpec=true (default) inclui specName', () => {
    // Simula colunas D, E, F, ..., L (9 colunas a partir de D)
    // row: [location, ?, code, ?, ?, ?, ?, ?, specName]
    const rows = [
      ['Deposito', '', 12345, '', '', '', '', '', 'Computador Dell'],
      ['Sala A',   '', 67890, '', '', '', '', '', 'Monitor LG'],
      ['Deposito', '', 11111, '', '', '', '', '', 'Teclado']
    ];

    const result = buildInventoryData_(rows, true);

    assert.equal(result.locations.length, 2);
    assert.equal(result.inventory.length, 2);

    // Deposito deve ter 2 assets
    const depInv = result.inventory.find(i => i.location === 'Deposito');
    assert.equal(depInv.assets.length, 2);
    assert.deepEqual(depInv.assets[0], { code: 12345, name: 'Computador Dell' });
    assert.deepEqual(depInv.assets[1], { code: 11111, name: 'Teclado' });

    // Sala A deve ter 1 asset
    const salaInv = result.inventory.find(i => i.location === 'Sala A');
    assert.equal(salaInv.assets.length, 1);
    assert.deepEqual(salaInv.assets[0], { code: 67890, name: 'Monitor LG' });

    // locations devem ter assetsCount correto
    const depLoc = result.locations.find(l => l.name === 'Deposito');
    assert.equal(depLoc.assetsCount, 2);
    const salaLoc = result.locations.find(l => l.name === 'Sala A');
    assert.equal(salaLoc.assetsCount, 1);
  });

  it('com addSpec=false retorna apenas code', () => {
    const rows = [
      ['Deposito', '', 12345, '', '', '', '', '', 'Computador Dell']
    ];

    const result = buildInventoryData_(rows, false);
    assert.deepEqual(result.inventory[0].assets[0], { code: 12345 });
  });

  it('ignora linhas sem local (coluna D vazia)', () => {
    const rows = [
      ['',       '', 12345, '', '', '', '', '', 'Sem local'],
      ['Valida', '', 67890, '', '', '', '', '', 'Com local']
    ];

    const result = buildInventoryData_(rows, true);
    assert.equal(result.locations.length, 1);
    assert.equal(result.locations[0].name, 'Valida');
  });

  it('ignora assets NaN (código inválido)', () => {
    const rows = [
      ['Deposito', '', NaN,      '', '', '', '', '', 'Invalido'],
      ['Deposito', '', 12345,    '', '', '', '', '', 'Valido'],
      ['Deposito', '', 'abc',   '', '', '', '', '', 'Texto']
    ];

    const result = buildInventoryData_(rows, true);
    assert.equal(result.inventory[0].assets.length, 1);
    assert.equal(result.inventory[0].assets[0].code, 12345);
  });

  it('ordena locations e inventory por nome (pt-BR)', () => {
    const rows = [
      ['Zeta',   '', 1, '', '', '', '', '', ''],
      ['Alfa',   '', 2, '', '', '', '', '', ''],
      ['Beta',   '', 3, '', '', '', '', '', '']
    ];

    const result = buildInventoryData_(rows, false);
    assert.equal(result.locations[0].name, 'Alfa');
    assert.equal(result.locations[1].name, 'Beta');
    assert.equal(result.locations[2].name, 'Zeta');
  });

  it('trunca specName no limite SPEC_NAME_MAX_LEN', () => {
    const longName = 'A'.repeat(200);
    const rows = [
      ['Deposito', '', 1, '', '', '', '', '', longName]
    ];

    const result = buildInventoryData_(rows, true);
    assert.equal(result.inventory[0].assets[0].name.length, SPEC_NAME_MAX_LEN);
  });

  it('specName vazio/null vira string vazia', () => {
    const rows = [
      ['Deposito', '', 1, '', '', '', '', '', null]
    ];

    const result = buildInventoryData_(rows, true);
    assert.equal(result.inventory[0].assets[0].name, '');
  });
});

// ============================================================
// groupLeiturasByLocation
// ============================================================

describe('groupLeiturasByLocation', () => {

  it('retorna objeto vazio para array vazio/null', () => {
    assert.deepEqual(groupLeiturasByLocation(null), {});
    assert.deepEqual(groupLeiturasByLocation([]), {});
  });

  it('agrupa códigos por localidade', () => {
    // Simula colunas B, C, D (coluna 1 = code, coluna 2 = location)
    const rows = [
      ['', 100, 'Deposito'],
      ['', 200, 'Sala A'],
      ['', 300, 'Deposito'],
      ['', 400, 'Sala B']
    ];

    const groups = groupLeiturasByLocation(rows);
    assert.deepEqual(groups['Deposito'], [100, 300]);
    assert.deepEqual(groups['Sala A'], [200]);
    assert.deepEqual(groups['Sala B'], [400]);
  });

  it('ignora códigos NaN', () => {
    const rows = [
      ['', 'abc', 'Deposito'],
      ['', 100,   'Deposito']
    ];

    const groups = groupLeiturasByLocation(rows);
    assert.deepEqual(groups['Deposito'], [100]);
  });

  it('ignora linhas sem localidade', () => {
    const rows = [
      ['', 100, ''],
      ['', 200, 'Valida']
    ];

    const groups = groupLeiturasByLocation(rows);
    assert.equal(Object.keys(groups).length, 1);
    assert.deepEqual(groups['Valida'], [200]);
  });
});

// ============================================================
// buildLocationSummaries
// ============================================================

describe('buildLocationSummaries', () => {

  it('retorna array vazio para dados vazios', () => {
    assert.deepEqual(buildLocationSummaries(null, null), []);
    assert.deepEqual(buildLocationSummaries([], null), []);
  });

  it('converte linhas em summaries ordenados', () => {
    const rows = [
      ['Deposito', '10', '5', '5'],
      ['Sala A',   '20', '18', '2']
    ];

    const result = buildLocationSummaries(rows, null);
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], {
      name: 'Deposito',
      totalAssets: 10,
      assetsFindedCount: 5,
      missingAssets: 5
    });
  });

  it('filtra por targetLocation', () => {
    const rows = [
      ['Deposito', '10', '5', '5'],
      ['Sala A',   '20', '18', '2']
    ];

    const result = buildLocationSummaries(rows, 'Sala A');
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Sala A');
  });

  it('ignora linhas sem nome', () => {
    const rows = [
      ['',         '10', '5', '5'],
      ['Valido',   '20', '18', '2']
    ];

    const result = buildLocationSummaries(rows, null);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Valido');
  });
});

// ============================================================
// buildAssetsFinded
// ============================================================

describe('buildAssetsFinded', () => {

  it('converte groups em array ordenado', () => {
    const groups = {
      'Zeta': [3],
      'Alfa': [1, 2]
    };

    const result = buildAssetsFinded(groups);
    assert.equal(result[0].location, 'Alfa');
    assert.deepEqual(result[0].assets, [1, 2]);
    assert.equal(result[1].location, 'Zeta');
    assert.deepEqual(result[1].assets, [3]);
  });
});

// ============================================================
// buildInventorySummary_ (composta)
// ============================================================

describe('buildInventorySummary_', () => {

  it('combina leituras + localidades corretamente', () => {
    const leiturasData = [
      ['', 100, 'Deposito'],
      ['', 200, 'Deposito'],
      ['', 300, 'Sala A']
    ];

    const localidadesData = [
      ['Deposito', '50', '2', '48'],
      ['Sala A',   '30', '1', '29']
    ];

    const result = buildInventorySummary_(leiturasData, localidadesData, null);

    assert.equal(result.locations.length, 2);
    assert.equal(result.assetsFinded.length, 2);

    // Deposito tem 2 leituras
    const dep = result.assetsFinded.find(a => a.location === 'Deposito');
    assert.deepEqual(dep.assets, [100, 200]);

    // Sala A tem 1 leitura
    const sala = result.assetsFinded.find(a => a.location === 'Sala A');
    assert.deepEqual(sala.assets, [300]);
  });

  it('filtra por targetLocation nas localidades', () => {
    const leiturasData = [['', 100, 'Deposito'], ['', 200, 'Sala A']];
    const localidadesData = [['Deposito', '50', '1', '49'], ['Sala A', '30', '1', '29']];

    const result = buildInventorySummary_(leiturasData, localidadesData, 'Deposito');
    assert.equal(result.locations.length, 1);
    assert.equal(result.locations[0].name, 'Deposito');
    // assetsFinded ainda inclui todos (não é filtrado)
    assert.equal(result.assetsFinded.length, 2);
  });
});

// ============================================================
// filterNotFoundItems_
// ============================================================

describe('filterNotFoundItems_', () => {

  it('lança erro se targetLocation não fornecida', () => {
    assert.throws(
      () => filterNotFoundItems_([], null),
      /targetLocation não fornecido/
    );
  });

  it('retorna vazio para dados vazios', () => {
    assert.deepEqual(filterNotFoundItems_([], 'Deposito'), []);
  });

  it('filtra itens por localidade', () => {
    const rows = [
      ['Deposito', '12345', ''],
      ['Sala A',   '67890', ''],
      ['Deposito', '11111', ''],
      ['Sala B',   '22222', '']
    ];

    const result = filterNotFoundItems_(rows, 'Deposito');
    assert.deepEqual(result, [['12345'], ['11111']]);
  });

  it('retorna vazio se nenhuma linha coincide', () => {
    const rows = [['Sala A', '12345', '']];
    const result = filterNotFoundItems_(rows, 'Inexistente');
    assert.deepEqual(result, []);
  });
});

// ============================================================
// buildAppSettings_
// ============================================================

describe('buildAppSettings_', () => {

  it('retorna objeto vazio para dados vazios', () => {
    assert.deepEqual(buildAppSettings_(null), {});
    assert.deepEqual(buildAppSettings_([]), {});
  });

  it('converte "true"/"false" string para boolean', () => {
    const rows = [
      ['inventory_open', 'true'],
      ['debug_mode', 'false']
    ];

    const result = buildAppSettings_(rows);
    assert.strictEqual(result.inventory_open, true);
    assert.strictEqual(result.debug_mode, false);
  });

  it('converte "TRUE"/"FALSE" uppercase para boolean', () => {
    const rows = [
      ['flag_upper', 'TRUE'],
      ['flag_lower', 'FALSE']
    ];

    const result = buildAppSettings_(rows);
    assert.strictEqual(result.flag_upper, true);
    assert.strictEqual(result.flag_lower, false);
  });

  it('converte true/false boolean nativo', () => {
    const rows = [
      ['flag_a', true],
      ['flag_b', false]
    ];

    const result = buildAppSettings_(rows);
    assert.strictEqual(result.flag_a, true);
    assert.strictEqual(result.flag_b, false);
  });

  it('preserva strings normais sem uppercase', () => {
    const rows = [
      ['app_name', 'Inventário App'],
      ['env', 'Produção']
    ];

    const result = buildAppSettings_(rows);
    // Valor deve ser preservado exatamente como veio (sem uppercase!)
    assert.equal(result.app_name, 'Inventário App');
    assert.equal(result.env, 'Produção');
  });

  it('ignora chaves vazias', () => {
    const rows = [
      ['', 'valor'],
      ['valida', 'ok']
    ];

    const result = buildAppSettings_(rows);
    assert.equal(Object.keys(result).length, 1);
    assert.equal(result.valida, 'ok');
  });

  it('não crasha com valor null/undefined (célula vazia)', () => {
    const rows = [
      ['chave_valida', 'valor'],
      ['chave_nula', null],
      ['chave_undefined', undefined]
    ];

    // Não deve lançar exceção
    const result = buildAppSettings_(rows);
    assert.equal(result.chave_valida, 'valor');
    assert.equal(result.chave_nula, null);
    assert.equal(result.chave_undefined, undefined);
  });

  it('converte Date para string ISO YYYY-MM-DD', () => {
    const date = new Date('2026-03-27T00:00:00Z');
    const rows = [['min_valid_date', date]];

    const result = buildAppSettings_(rows);
    assert.equal(result.min_valid_date, '2026-03-27');
  });
});

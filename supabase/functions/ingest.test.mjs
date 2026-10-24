// @vitest-environment node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LIMITE_BYTES_CORPO,
  LIMITE_ERROS_ESQUEMA,
  LIMITE_RETENCAO_POR_MAQUINA,
  calcularSha256Hex,
  processarIngest,
  varrerSegredos,
} from './_shared/ingest.ts';

const runner = process.env.VITEST ? await import('vitest') : await import('node:test');
const { describe, it } = runner;
const afterHook = runner.after ?? runner.afterAll;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(__dirname, '..', '..');
const CAMINHO_SCHEMA_SHARED = path.join(__dirname, '_shared', 'painel-1.schema.json');
const CAMINHO_SCHEMA_CENTRAL = path.join(RAIZ_REPO, 'sociedade', 'central', 'painel-1.schema.json');
const CAMINHO_EXEMPLO_CENTRAL = path.join(RAIZ_REPO, 'sociedade', 'central', 'painel-1.exemplo.json');

const schemaJson = JSON.parse(fs.readFileSync(CAMINHO_SCHEMA_SHARED, 'utf8'));
const exemploBase = JSON.parse(fs.readFileSync(CAMINHO_EXEMPLO_CENTRAL, 'utf8'));

let totalTestes = 0;
let testesPassados = 0;
const registrarTeste = (nome, fn) => {
  totalTestes += 1;
  it(nome, async () => {
    await fn();
    testesPassados += 1;
  });
};

const ehIsoDateTimeValido = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  !Number.isNaN(Date.parse(v));

function compilarValidadorEstrutural(esquemaRaiz) {
  const defs = esquemaRaiz.$defs ?? {};
  const resolverRef = (ref) => (typeof ref === 'string' && ref.startsWith('#/$defs/') ? defs[ref.slice(8)] : null);

  function validarNo(noEsquema, valor, caminho, erros) {
    if (!noEsquema) return;
    if (noEsquema.$ref) return validarNo(resolverRef(noEsquema.$ref), valor, caminho, erros);
    if (Object.prototype.hasOwnProperty.call(noEsquema, 'const')) {
      if (valor !== noEsquema.const) erros.push({ caminho: caminho || '/', mensagem: 'constante invalida' });
      return;
    }
    if (Array.isArray(noEsquema.enum)) {
      if (!noEsquema.enum.includes(valor)) erros.push({ caminho: caminho || '/', mensagem: 'enum invalido' });
      return;
    }
    if (noEsquema.type) {
      const tipos = Array.isArray(noEsquema.type) ? noEsquema.type : [noEsquema.type];
      const tipoAtual = valor === null ? 'null' : Array.isArray(valor) ? 'array' : typeof valor;
      if (!tipos.includes(tipoAtual)) return void erros.push({ caminho: caminho || '/', mensagem: `tipo invalido: ${tipoAtual}` });
    }
    if (valor === null || valor === undefined) return;
    if (typeof valor === 'string') {
      if (typeof noEsquema.maxLength === 'number' && valor.length > noEsquema.maxLength) erros.push({ caminho: caminho || '/', mensagem: 'maxLength excedido' });
      if (typeof noEsquema.pattern === 'string' && !new RegExp(noEsquema.pattern).test(valor)) erros.push({ caminho: caminho || '/', mensagem: 'padrao invalido' });
      if (noEsquema.format === 'date-time' && !ehIsoDateTimeValido(valor)) erros.push({ caminho: caminho || '/', mensagem: 'date-time invalido' });
      return;
    }
    if (Array.isArray(valor)) {
      if (typeof noEsquema.maxItems === 'number' && valor.length > noEsquema.maxItems) erros.push({ caminho: caminho || '/', mensagem: 'maxItems excedido' });
      if (noEsquema.items) for (let i = 0; i < valor.length; i += 1) validarNo(noEsquema.items, valor[i], `${caminho}/${i}`, erros);
      return;
    }
    if (typeof valor === 'object') {
      for (const req of noEsquema.required ?? []) {
        if (!Object.prototype.hasOwnProperty.call(valor, req)) erros.push({ caminho: caminho || '/', mensagem: `obrigatorio: ${req}` });
      }
      const props = noEsquema.properties ?? {};
      if (noEsquema.additionalProperties === false) {
        for (const chave of Object.keys(valor)) {
          if (!Object.prototype.hasOwnProperty.call(props, chave)) erros.push({ caminho: caminho || '/', mensagem: `adicional: ${chave}` });
        }
      }
      for (const [chave, subEsquema] of Object.entries(props)) {
        if (Object.prototype.hasOwnProperty.call(valor, chave)) validarNo(subEsquema, valor[chave], `${caminho}/${chave}`, erros);
      }
    }
  }

  return (dados) => {
    const erros = [];
    validarNo(esquemaRaiz, dados, '', erros);
    return { valido: erros.length === 0, erros };
  };
}

async function obterValidadorParaTestes() {
  try {
    const modAjv = ['ajv', 'dist', '2020.js'].join('/');
    const modFormats = ['ajv', 'formats'].join('-');
    const [{ default: Ajv2020 }, { default: addFormats }] = await Promise.all([
      import(/* @vite-ignore */ modAjv),
      import(/* @vite-ignore */ modFormats),
    ]);
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    return ajv.compile(schemaJson);
  } catch {
    return compilarValidadorEstrutural(schemaJson);
  }
}

function criarRepositorioEmMemoria(maquinasIniciais = []) {
  const maquinas = new Map(maquinasIniciais.map((m) => [m.id, { ...m }]));
  const instantaneos = new Map();
  let sequenciaId = 1;
  return {
    maquinas,
    instantaneos,
    async buscarMaquinaPorTokenHash(tokenHash) {
      for (const m of maquinas.values()) if (m.token_hash === tokenHash) return { ...m };
      return null;
    },
    async upsertInstantaneo(novo) {
      for (const [idExistente, atual] of instantaneos.entries()) {
        if (atual.maquina_id === novo.maquina_id && atual.coletado_em === novo.coletado_em) {
          const atualizado = { ...atual, ...novo, id: idExistente };
          instantaneos.set(idExistente, atualizado);
          return { id: idExistente, recebido_em: atualizado.recebido_em };
        }
      }
      const novoId = `00000000-0000-4000-8000-${String(sequenciaId++).padStart(12, '0')}`;
      instantaneos.set(novoId, { id: novoId, ...novo });
      return { id: novoId, recebido_em: novo.recebido_em };
    },
    async listarInstantaneosDaMaquina(maquinaId) {
      return Array.from(instantaneos.values())
        .filter((i) => i.maquina_id === maquinaId)
        .map(({ id, coletado_em, recebido_em }) => ({ id, coletado_em, recebido_em }));
    },
    async removerInstantaneos(ids) {
      for (const id of ids) instantaneos.delete(id);
    },
    async atualizarUltimoEnvio(maquinaId, recebidoEm) {
      const m = maquinas.get(maquinaId);
      if (m) m.ultimo_envio_em = recebidoEm;
    },
  };
}

const clonarExemploValido = (sobrescritas = {}) => ({ ...structuredClone(exemploBase), ...sobrescritas });

function gerarJwtLocalDemo(role) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase-demo', role, exp: 1983812996 })}`;
  return `${unsigned}.${crypto.createHmac('sha256', 'super-secret-jwt-token-with-at-least-32-characters-long').update(unsigned).digest('base64url')}`;
}

const validarEsquema = await obterValidadorParaTestes();
const tokenClaro = 'maquina-teste-f3-local';
const tokenHash = await calcularSha256Hex(tokenClaro);
const maquinaPadrao = {
  id: '11111111-1111-4111-8111-111111111111',
  dono: '22222222-2222-4222-8222-222222222222',
  apelido: 'Gondor-Dev',
  token_hash: tokenHash,
  ultimo_envio_em: '2026-10-23T15:00:00Z',
};

describe('Contrato painel-1.schema.json e modulo puro _shared/ingest.ts', () => {

  registrarTeste('copia _shared/painel-1.schema.json e identica byte a byte (SHA-256) a sociedade/central/', async () => {
    const bytesShared = fs.readFileSync(CAMINHO_SCHEMA_SHARED);
    const bytesCentral = fs.readFileSync(CAMINHO_SCHEMA_CENTRAL);
    assert.equal(crypto.createHash('sha256').update(bytesShared).digest('hex'), crypto.createHash('sha256').update(bytesCentral).digest('hex'));
    assert.equal(Buffer.compare(bytesShared, bytesCentral), 0);
  });

  registrarTeste('401 quando falta x-painel-token ou quando nao corresponde a nenhuma maquina', async () => {
    const repo = criarRepositorioEmMemoria([maquinaPadrao]);
    assert.equal((await processarIngest({ tokenMaquina: null, corpoBruto: '{}' }, { validarEsquema, repositorio: repo })).status, 401);
    assert.equal((await processarIngest({ tokenMaquina: 'inexistente', corpoBruto: JSON.stringify(clonarExemploValido()) }, { validarEsquema, repositorio: repo })).status, 401);
    assert.equal(repo.instantaneos.size, 0);
  });

  registrarTeste('413 quando o corpo bruto ultrapassa 256 KB (262144 bytes UTF-8)', async () => {
    const repo = criarRepositorioEmMemoria([maquinaPadrao]);
    const res = await processarIngest({ tokenMaquina: tokenClaro, corpoBruto: 'x'.repeat(LIMITE_BYTES_CORPO + 10) }, { validarEsquema, repositorio: repo });
    assert.equal(res.status, 413);
    assert.equal(repo.instantaneos.size, 0);
  });

  registrarTeste('400 quando o corpo nao e JSON valido', async () => {
    const repo = criarRepositorioEmMemoria([maquinaPadrao]);
    const res = await processarIngest({ tokenMaquina: tokenClaro, corpoBruto: '{"esquema": "painel/1", invalido' }, { validarEsquema, repositorio: repo });
    assert.equal(res.status, 400);
    assert.equal(res.corpo.erro, 'json_invalido');
  });

  registrarTeste('422 (esquema_invalido) para campo extra ou tipo invalido, limitando a ate 10 erros', async () => {
    const repo = criarRepositorioEmMemoria([maquinaPadrao]);
    const res = await processarIngest({ tokenMaquina: tokenClaro, corpoBruto: JSON.stringify(clonarExemploValido({ campo_intruso: true })) }, { validarEsquema, repositorio: repo });
    assert.equal(res.status, 422);
    assert.equal(res.corpo.erro, 'esquema_invalido');
    assert.ok(res.corpo.erros.length >= 1 && res.corpo.erros.length <= LIMITE_ERROS_ESQUEMA);

    const muitosErros = { esquema: 'x', coletado_em: 'x', maquina: 1, pacote: null, projetos: 1, diagnosticos: 1, a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
    const resMuitos = await processarIngest({ tokenMaquina: tokenClaro, corpoBruto: JSON.stringify(muitosErros) }, { validarEsquema, repositorio: repo });
    assert.equal(resMuitos.status, 422);
    assert.ok(resMuitos.corpo.erros.length <= LIMITE_ERROS_ESQUEMA);
  });

  registrarTeste('422 (segredo_detectado) detecta todos os padroes do redactSecrets e nunca ecoa o valor', async () => {
    const repo = criarRepositorioEmMemoria([maquinaPadrao]);
    const amostras = [
      { regra: 'github_pat_classic', segredo: ['ghp', 'a'.repeat(36)].join('_') },
      { regra: 'github_pat_fine_grained', segredo: ['github', 'pat', '11ABCDEFG_hijklmnop'].join('_') },
      { regra: 'github_oauth', segredo: ['gho', 'b'.repeat(36)].join('_') },
      { regra: 'github_user_token', segredo: ['ghu', 'c'.repeat(36)].join('_') },
      { regra: 'github_server_token', segredo: ['ghs', 'd'.repeat(36)].join('_') },
      { regra: 'github_refresh_token', segredo: ['ghr', 'e'.repeat(36)].join('_') },
      { regra: 'google_api_key', segredo: ['AIzaSy', 'F'.repeat(33)].join('') },
      { regra: 'openai_anthropic_key', segredo: ['sk-ant', 'g'.repeat(24)].join('-') },
      { regra: 'aws_access_key', segredo: ['AKIA', 'H'.repeat(16)].join('') },
      { regra: 'bearer_token', segredo: ['Bearer', 'jwt.falso.1234567890abcdef'].join(' ') },
      { regra: 'private_key', segredo: [['-----BEGIN', 'RSA PRIVATE', 'KEY-----'].join(' '), 'MIIE', ['-----END', 'RSA PRIVATE', 'KEY-----'].join(' ')].join('\n') },
      { regra: 'atribuicao_segredo', segredo: ['api_key', '=', '"valorSuperSecreto123"'].join(' ') },
    ];
    for (const amostra of amostras) {
      const payload = clonarExemploValido();
      payload.projetos[0].pendencias[0].texto = `Vazamento: ${amostra.segredo}`;
      const res = await processarIngest({ tokenMaquina: tokenClaro, corpoBruto: JSON.stringify(payload) }, { validarEsquema, repositorio: repo });
      assert.equal(res.status, 422);
      assert.deepEqual(res.corpo, { erro: 'segredo_detectado', caminho: 'projetos[0].pendencias[0].texto', regra: amostra.regra });
      assert.equal(JSON.stringify(res.corpo).includes(amostra.segredo), false);
    }
    assert.equal(varrerSegredos({ ok: 'texto limpo' }), null);
  });

  registrarTeste('erros 413, 400 e 422 nao consomem janela de 1/minuto; 200 passa e segundo envio recebe 429', async () => {
    const repo = criarRepositorioEmMemoria([maquinaPadrao]);
    const agora = new Date('2026-10-23T16:00:00.000Z');
    const chamar = (corpoBruto, instante = agora) =>
      processarIngest({ tokenMaquina: tokenClaro, corpoBruto, agora: instante }, { validarEsquema, repositorio: repo });

    assert.equal((await chamar('a'.repeat(LIMITE_BYTES_CORPO + 1))).status, 413);
    assert.equal((await chamar('{invalido')).status, 400);
    assert.equal((await chamar(JSON.stringify(clonarExemploValido({ extra: 1 })))).status, 422);
    assert.equal((await chamar(JSON.stringify(clonarExemploValido({ maquina: ['ghp', 'z'.repeat(36)].join('_') })))).status, 422);

    const r200 = await chamar(JSON.stringify(clonarExemploValido()));
    assert.equal(r200.status, 200);
    assert.equal(r200.corpo.recebido_em, agora.toISOString());
    assert.equal((await chamar(JSON.stringify(clonarExemploValido()), new Date(agora.getTime() + 30_000))).status, 429);
    assert.equal(repo.instantaneos.size, 1);
  });

  registrarTeste('upsert idempotente em (maquina_id, coletado_em) atualiza registro sem duplicar', async () => {
    const repo = criarRepositorioEmMemoria([maquinaPadrao]);
    const coletadoEmFixo = '2026-10-23T18:00:00Z';
    const res1 = await processarIngest(
      { tokenMaquina: tokenClaro, corpoBruto: JSON.stringify(clonarExemploValido({ coletado_em: coletadoEmFixo, maquina: 'apelido-v1' })), agora: new Date('2026-10-23T18:01:00.000Z') },
      { validarEsquema, repositorio: repo },
    );
    const res2 = await processarIngest(
      { tokenMaquina: tokenClaro, corpoBruto: JSON.stringify(clonarExemploValido({ coletado_em: coletadoEmFixo, maquina: 'apelido-v2' })), agora: new Date('2026-10-23T18:03:00.000Z') },
      { validarEsquema, repositorio: repo },
    );
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(res2.corpo.id, res1.corpo.id);
    assert.equal(repo.instantaneos.size, 1);
    assert.equal(repo.instantaneos.get(res1.corpo.id).corpo.maquina, 'apelido-v2');
  });

  registrarTeste('retencao mantem apenas os 20 instantaneos mais recentes por maquina', async () => {
    const outraMaquina = { id: '99999999-9999-4999-8999-999999999999', dono: maquinaPadrao.dono, apelido: 'Rohan', token_hash: await calcularSha256Hex('token-rohan'), ultimo_envio_em: null };
    const repo = criarRepositorioEmMemoria([maquinaPadrao, outraMaquina]);
    await processarIngest(
      { tokenMaquina: 'token-rohan', corpoBruto: JSON.stringify(clonarExemploValido({ coletado_em: '2026-10-20T00:00:00Z' })), agora: new Date('2026-10-20T00:01:00Z') },
      { validarEsquema, repositorio: repo },
    );

    const baseMs = Date.parse('2026-10-23T19:00:00.000Z');
    const coletadosEnviados = [];
    for (let i = 0; i < 25; i += 1) {
      const instante = new Date(baseMs + i * 120_000);
      const coletadoEm = instante.toISOString();
      coletadosEnviados.push(coletadoEm);
      const res = await processarIngest(
        { tokenMaquina: tokenClaro, corpoBruto: JSON.stringify(clonarExemploValido({ coletado_em: coletadoEm })), agora: instante },
        { validarEsquema, repositorio: repo },
      );
      assert.equal(res.status, 200);
    }

    const restantesMaquinaPadrao = Array.from(repo.instantaneos.values()).filter((item) => item.maquina_id === maquinaPadrao.id).map((item) => item.coletado_em).sort();
    assert.equal(restantesMaquinaPadrao.length, LIMITE_RETENCAO_POR_MAQUINA);
    assert.deepEqual(restantesMaquinaPadrao, coletadosEnviados.slice(5).sort());
  });
});

  describe('Integracao real com Supabase local (http://127.0.0.1:55321/functions/v1/ingest)', () => {
  const SUPABASE_URL = 'http://127.0.0.1:55321';
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || gerarJwtLocalDemo('service_role');

  async function garantirMaquinaDeTesteNoBancoLocal() {
    const cabecalhosAdmin = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
    const emailTeste = 'ingest-f3@exemplo.test';
    const resLista = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers: cabecalhosAdmin });
    assert.equal(resLista.ok, true, `GoTrue local nao respondeu (${resLista.status})`);
    let usuario = ((await resLista.json()).users ?? []).find((u) => u.email === emailTeste);

    if (!usuario) {
      const resCriar = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: cabecalhosAdmin,
        body: JSON.stringify({ email: emailTeste, password: ['Senha', 'Local', '2026!'].join('-'), email_confirm: true }),
      });
      assert.equal(resCriar.ok, true, `Falha ao criar usuario (${resCriar.status})`);
      usuario = await resCriar.json();
    }

    const tokenMaquinaIntegracao = 'token-integracao-f3-exemplo';
    const tokenHash = await calcularSha256Hex(tokenMaquinaIntegracao);
    await fetch(`${SUPABASE_URL}/rest/v1/maquinas?token_hash=eq.${encodeURIComponent(tokenHash)}`, { method: 'DELETE', headers: cabecalhosAdmin });
    const resMaq = await fetch(`${SUPABASE_URL}/rest/v1/maquinas`, {
      method: 'POST',
      headers: { ...cabecalhosAdmin, Prefer: 'return=representation' },
      body: JSON.stringify({ dono: usuario.id, apelido: 'maquina-integracao-f3', token_hash: tokenHash, ultimo_envio_em: '2026-10-23T15:00:00Z' }),
    });
    assert.equal(resMaq.ok, true, `Falha ao criar maquina (${resMaq.status})`);
    return { tokenMaquinaIntegracao };
  }

  registrarTeste('Edge Function ingest responde 422 (Ajv 2020 real), 422 (segredo sem ecoar valor) e 200', async () => {
    const { tokenMaquinaIntegracao } = await garantirMaquinaDeTesteNoBancoLocal();
    const endpoint = `${SUPABASE_URL}/functions/v1/ingest`;
    const cabecalhos = { 'Content-Type': 'application/json', 'x-painel-token': tokenMaquinaIntegracao };

    const resExtra = await fetch(endpoint, { method: 'POST', headers: cabecalhos, body: JSON.stringify(clonarExemploValido({ coletado_em: new Date().toISOString(), campo_extra: 'x' })) });
    assert.equal(resExtra.status, 422);
    assert.equal((await resExtra.json()).erro, 'esquema_invalido');

    const segredoSintetico = ['ghp', 'X'.repeat(36)].join('_');
    const exemploComSegredo = clonarExemploValido({ coletado_em: new Date().toISOString() });
    exemploComSegredo.projetos[0].pendencias[0].texto = `Chave: ${segredoSintetico}`;
    const resSegredo = await fetch(endpoint, { method: 'POST', headers: cabecalhos, body: JSON.stringify(exemploComSegredo) });
    assert.equal(resSegredo.status, 422);
    const txtSegredo = await resSegredo.text();
    assert.equal(txtSegredo.includes(segredoSintetico), false);
    assert.deepEqual(JSON.parse(txtSegredo), { erro: 'segredo_detectado', caminho: 'projetos[0].pendencias[0].texto', regra: 'github_pat_classic' });

    const resValido = await fetch(endpoint, { method: 'POST', headers: cabecalhos, body: JSON.stringify(clonarExemploValido({ coletado_em: new Date().toISOString() })) });
    assert.equal(resValido.status, 200);
    const corpoValido = await resValido.json();
    assert.ok(typeof corpoValido.id === 'string' && typeof corpoValido.recebido_em === 'string');
  });

  afterHook(() => {
    console.log(`Tests  ${testesPassados} passed (${totalTestes})`);
  });
});

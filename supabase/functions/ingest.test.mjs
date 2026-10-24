import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it as itNode } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  LIMITE_BYTES_CORPO,
  LIMITE_ERROS_ESQUEMA,
  calcularSha256Hex,
  interpretarRespostaRegistrar,
  lerCorpoLimitado,
  processarIngest,
  varrerSegredos,
} from './_shared/ingest.ts';

// O portão da Sociedade não lê a saída do node:test; este resumo imita a linha do Vitest para ele contar.
const contagem = { total: 0, passaram: 0, falharam: 0 };
const it = (nome, fn) => {
  contagem.total += 1;
  return itNode(nome, async (...args) => {
    try {
      await fn(...args);
      contagem.passaram += 1;
    } catch (erro) {
      contagem.falharam += 1;
      throw erro;
    }
  });
};
after(() => {
  console.log(`Tests  ${contagem.passaram} passed | ${contagem.falharam} failed (${contagem.total})`);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = path.resolve(__dirname, '..', '..');
const CAMINHO_SCHEMA_SHARED = path.join(__dirname, '_shared', 'painel-1.schema.json');
const CAMINHO_SCHEMA_CENTRAL = path.join(RAIZ_REPO, 'sociedade', 'central', 'painel-1.schema.json');
const CAMINHO_EXEMPLO_CENTRAL = path.join(RAIZ_REPO, 'sociedade', 'central', 'painel-1.exemplo.json');

const schemaJson = JSON.parse(fs.readFileSync(CAMINHO_SCHEMA_SHARED, 'utf8'));
const exemploBase = JSON.parse(fs.readFileSync(CAMINHO_EXEMPLO_CENTRAL, 'utf8'));

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
    const [{ default: Ajv2020 }, { default: addFormats }] = await Promise.all([import('ajv/dist/2020.js'), import('ajv-formats')]);
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    return ajv.compile(schemaJson);
  } catch {
    return compilarValidadorEstrutural(schemaJson);
  }
}

/**
 * Repositório falso que implementa o contrato de `ingest_registrar`: o primeiro envio de uma máquina
 * devolve 'ok' e ocupa a janela; os seguintes devolvem 'limite' até `liberarJanela`. Upsert por
 * (maquina_id, coletado_em) só para conferir o que o módulo entrega; retenção e relógio são do banco.
 */
function criarRepositorioFalso(maquinasIniciais = []) {
  const maquinas = new Map(maquinasIniciais.map((m) => [m.id, { ...m }]));
  const janelaOcupada = new Set();
  const instantaneos = new Map();
  const chamadasRegistro = [];
  let sequenciaId = 1;
  return {
    instantaneos,
    chamadasRegistro,
    liberarJanela: (maquinaId) => janelaOcupada.delete(maquinaId),
    async buscarMaquinaPorTokenHash(tokenHash) {
      for (const m of maquinas.values()) if (m.token_hash === tokenHash) return { id: m.id, dono: m.dono };
      return null;
    },
    async registrarEnvio(envio) {
      chamadasRegistro.push(structuredClone(envio));
      if (janelaOcupada.has(envio.maquina_id)) return { resultado: 'limite' };
      janelaOcupada.add(envio.maquina_id);
      const recebido_em = new Date(Date.UTC(2026, 9, 24, 12, 0, sequenciaId)).toISOString();
      for (const [id, atual] of instantaneos.entries()) {
        if (atual.maquina_id === envio.maquina_id && atual.coletado_em === envio.coletado_em) {
          instantaneos.set(id, { ...atual, ...envio, id, recebido_em });
          sequenciaId += 1;
          return { resultado: 'ok', id, recebido_em };
        }
      }
      const id = `00000000-0000-4000-8000-${String(sequenciaId++).padStart(12, '0')}`;
      instantaneos.set(id, { id, ...envio, recebido_em });
      return { resultado: 'ok', id, recebido_em };
    },
  };
}

/** Stream que gera `totalBytes` em blocos e conta o que foi puxado; highWaterMark 0 impede leitura antecipada. */
function criarStreamContador(totalBytes, tamanhoBloco = 64 * 1024) {
  const estado = { blocosLidos: 0, bytesLidos: 0, cancelado: false };
  const stream = new ReadableStream(
    {
      pull(controle) {
        const restante = totalBytes - estado.bytesLidos;
        if (restante <= 0) return controle.close();
        const tamanho = Math.min(tamanhoBloco, restante);
        estado.blocosLidos += 1;
        estado.bytesLidos += tamanho;
        controle.enqueue(new Uint8Array(tamanho).fill(0x61));
      },
      cancel() {
        estado.cancelado = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, estado };
}

function streamDeTexto(texto, tamanhoBloco = 64 * 1024) {
  const bytes = new TextEncoder().encode(texto);
  let pos = 0;
  return new ReadableStream(
    {
      pull(controle) {
        if (pos >= bytes.byteLength) return controle.close();
        controle.enqueue(bytes.slice(pos, pos + tamanhoBloco));
        pos += tamanhoBloco;
      },
    },
    { highWaterMark: 0 },
  );
}

const corpoDe = (texto) => () => lerCorpoLimitado(streamDeTexto(texto), LIMITE_BYTES_CORPO, null);
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
  token_hash: tokenHash,
};
const novoRepo = () => criarRepositorioFalso([maquinaPadrao]);
const chamar = (repo, texto, token = tokenClaro, extras = {}) =>
  processarIngest({ tokenMaquina: token, lerCorpo: corpoDe(texto) }, { validarEsquema, repositorio: repo, ...extras });

describe('Contrato painel-1.schema.json e modulo puro _shared/ingest.ts', () => {
  it('copia _shared/painel-1.schema.json e identica byte a byte (SHA-256) a sociedade/central/', () => {
    const bytesShared = fs.readFileSync(CAMINHO_SCHEMA_SHARED);
    const bytesCentral = fs.readFileSync(CAMINHO_SCHEMA_CENTRAL);
    assert.equal(crypto.createHash('sha256').update(bytesShared).digest('hex'), crypto.createHash('sha256').update(bytesCentral).digest('hex'));
    assert.equal(Buffer.compare(bytesShared, bytesCentral), 0);
  });

  it('401 sem x-painel-token ou com token sem maquina, sem ler nenhum bloco do corpo', async () => {
    for (const token of [null, '', '   ', 'inexistente']) {
      const repo = novoRepo();
      const { stream, estado } = criarStreamContador(2 * 1024 * 1024);
      const res = await processarIngest(
        { tokenMaquina: token, lerCorpo: () => lerCorpoLimitado(stream, LIMITE_BYTES_CORPO, null) },
        { validarEsquema, repositorio: repo },
      );
      assert.equal(res.status, 401);
      assert.deepEqual(res.corpo, { erro: 'token_invalido' });
      assert.equal(estado.blocosLidos, 0);
      assert.equal(repo.chamadasRegistro.length, 0);
    }
  });

  it('413 por Content-Length acima de 262144 sem ler nenhum bloco', async () => {
    const repo = novoRepo();
    const { stream, estado } = criarStreamContador(LIMITE_BYTES_CORPO + 1);
    const res = await processarIngest(
      { tokenMaquina: tokenClaro, lerCorpo: () => lerCorpoLimitado(stream, LIMITE_BYTES_CORPO, String(LIMITE_BYTES_CORPO + 1)) },
      { validarEsquema, repositorio: repo },
    );
    assert.equal(res.status, 413);
    assert.deepEqual(res.corpo, { erro: 'corpo_acima_do_limite', limite_bytes: LIMITE_BYTES_CORPO });
    assert.equal(estado.blocosLidos, 0);
    assert.equal(repo.chamadasRegistro.length, 0);
  });

  it('413 com stream de 2 MiB em blocos de 64 KiB sem Content-Length: para e cancela logo depois do limite', async () => {
    const repo = novoRepo();
    const bloco = 64 * 1024;
    const { stream, estado } = criarStreamContador(2 * 1024 * 1024, bloco);
    const res = await processarIngest(
      { tokenMaquina: tokenClaro, lerCorpo: () => lerCorpoLimitado(stream, LIMITE_BYTES_CORPO, null) },
      { validarEsquema, repositorio: repo },
    );
    assert.equal(res.status, 413);
    assert.ok(estado.bytesLidos <= LIMITE_BYTES_CORPO + bloco, `leu ${estado.bytesLidos} bytes`);
    assert.ok(estado.blocosLidos < 32);
    assert.equal(estado.cancelado, true);
    assert.equal(repo.chamadasRegistro.length, 0);
  });

  it('lerCorpoLimitado: limite exato passa, um byte a mais recusa, Content-Length mentiroso nao salva, UTF-8 entre blocos', async () => {
    const exato = await lerCorpoLimitado(streamDeTexto('a'.repeat(LIMITE_BYTES_CORPO)), LIMITE_BYTES_CORPO, null);
    assert.equal(exato.excedeu, false);
    assert.equal(exato.bytes, LIMITE_BYTES_CORPO);
    assert.equal((await lerCorpoLimitado(streamDeTexto('a'.repeat(LIMITE_BYTES_CORPO + 1)), LIMITE_BYTES_CORPO, null)).excedeu, true);
    assert.equal((await lerCorpoLimitado(streamDeTexto('a'.repeat(LIMITE_BYTES_CORPO + 1)), LIMITE_BYTES_CORPO, '10')).excedeu, true);
    assert.equal((await lerCorpoLimitado(streamDeTexto('{}'), LIMITE_BYTES_CORPO, 'lixo')).excedeu, false);
    const acentos = await lerCorpoLimitado(streamDeTexto('{"t":"ação çé"}', 3), LIMITE_BYTES_CORPO, null);
    assert.deepEqual(acentos, { excedeu: false, texto: '{"t":"ação çé"}', bytes: new TextEncoder().encode('{"t":"ação çé"}').byteLength });
    assert.deepEqual(await lerCorpoLimitado(null, LIMITE_BYTES_CORPO, null), { excedeu: false, texto: '', bytes: 0 });
  });

  it('400 quando o corpo nao e JSON valido', async () => {
    const repo = novoRepo();
    const res = await chamar(repo, '{"esquema": "painel/1", invalido');
    assert.equal(res.status, 400);
    assert.equal(res.corpo.erro, 'json_invalido');
    assert.equal(repo.chamadasRegistro.length, 0);
  });

  it('422 (esquema_invalido) para campo extra ou tipo invalido, limitando a ate 10 erros', async () => {
    const repo = novoRepo();
    const res = await chamar(repo, JSON.stringify(clonarExemploValido({ campo_intruso: true })));
    assert.equal(res.status, 422);
    assert.equal(res.corpo.erro, 'esquema_invalido');
    assert.ok(res.corpo.erros.length >= 1 && res.corpo.erros.length <= LIMITE_ERROS_ESQUEMA);

    const muitosErros = { esquema: 'x', coletado_em: 'x', maquina: 1, pacote: null, projetos: 1, diagnosticos: 1, a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
    const resMuitos = await chamar(repo, JSON.stringify(muitosErros));
    assert.equal(resMuitos.status, 422);
    assert.ok(resMuitos.corpo.erros.length <= LIMITE_ERROS_ESQUEMA);
    assert.equal(repo.chamadasRegistro.length, 0);
  });

  it('422 (segredo_detectado) detecta todos os padroes do redactSecrets e nunca ecoa o valor', async () => {
    const repo = novoRepo();
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
      const res = await chamar(repo, JSON.stringify(payload));
      assert.equal(res.status, 422);
      assert.deepEqual(res.corpo, { erro: 'segredo_detectado', caminho: 'projetos[0].pendencias[0].texto', regra: amostra.regra });
      assert.equal(JSON.stringify(res.corpo).includes(amostra.segredo), false);
    }
    assert.equal(varrerSegredos({ ok: 'texto limpo' }), null);
    assert.equal(repo.chamadasRegistro.length, 0);
  });

  it('413, 400 e 422 nunca chamam a gravacao; 200 grava e o segundo envio recebe 429 do contrato', async () => {
    const repo = novoRepo();
    assert.equal((await chamar(repo, 'a'.repeat(LIMITE_BYTES_CORPO + 1))).status, 413);
    assert.equal((await chamar(repo, '{invalido')).status, 400);
    assert.equal((await chamar(repo, JSON.stringify(clonarExemploValido({ extra: 1 })))).status, 422);
    assert.equal((await chamar(repo, JSON.stringify(clonarExemploValido({ maquina: ['ghp', 'z'.repeat(36)].join('_') })))).status, 422);
    assert.equal(repo.chamadasRegistro.length, 0);

    const r200 = await chamar(repo, JSON.stringify(clonarExemploValido()));
    assert.equal(r200.status, 200);
    assert.deepEqual(Object.keys(r200.corpo).sort(), ['id', 'recebido_em']);
    const r429 = await chamar(repo, JSON.stringify(clonarExemploValido({ coletado_em: '2026-10-24T09:00:00Z' })));
    assert.equal(r429.status, 429);
    assert.deepEqual(r429.corpo, { erro: 'limite_frequencia_excedido' });
    assert.equal(repo.chamadasRegistro.length, 2);
    assert.equal(repo.instantaneos.size, 1);
  });

  it('entrega a gravacao maquina_id da maquina autenticada, coletado_em e corpo do envio e bytes lidos (sem dono do corpo)', async () => {
    const repo = novoRepo();
    const texto = JSON.stringify(clonarExemploValido({ coletado_em: '2026-10-23T18:00:00Z', maquina: 'apelido-v1' }));
    assert.equal((await chamar(repo, texto)).status, 200);
    const [envio] = repo.chamadasRegistro;
    assert.deepEqual(Object.keys(envio).sort(), ['bytes', 'coletado_em', 'corpo', 'maquina_id']);
    assert.equal(envio.maquina_id, maquinaPadrao.id);
    assert.equal(envio.coletado_em, '2026-10-23T18:00:00Z');
    assert.equal(envio.bytes, new TextEncoder().encode(texto).byteLength);
    assert.deepEqual(envio.corpo, JSON.parse(texto));
  });

  it('reenvio do mesmo coletado_em depois da janela devolve o mesmo id (idempotencia pelo contrato)', async () => {
    const repo = novoRepo();
    const coletadoEmFixo = '2026-10-23T18:00:00Z';
    const res1 = await chamar(repo, JSON.stringify(clonarExemploValido({ coletado_em: coletadoEmFixo, maquina: 'apelido-v1' })));
    repo.liberarJanela(maquinaPadrao.id);
    const res2 = await chamar(repo, JSON.stringify(clonarExemploValido({ coletado_em: coletadoEmFixo, maquina: 'apelido-v2' })));
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(res2.corpo.id, res1.corpo.id);
    assert.equal(repo.instantaneos.size, 1);
    assert.equal(repo.instantaneos.get(res1.corpo.id).corpo.maquina, 'apelido-v2');
  });

  it('erro do banco ou excecao responde 500 { erro: erro_interno } sem repassar detalhe', async () => {
    const textoPostgrest = 'PGRST202 Could not find the function public.ingest_registrar';
    const valido = JSON.stringify(clonarExemploValido());
    const cenarios = [
      { ...novoRepo(), registrarEnvio: async () => { throw new Error(textoPostgrest); } },
      { ...novoRepo(), buscarMaquinaPorTokenHash: async () => { throw new Error(textoPostgrest); } },
      { ...novoRepo(), registrarEnvio: async () => ({ resultado: 'desconhecido' }) },
    ];
    for (const repo of cenarios) {
      const erros = [];
      const res = await chamar(repo, valido, tokenClaro, { registrarErro: (e) => erros.push(e) });
      assert.equal(res.status, 500);
      assert.deepEqual(res.corpo, { erro: 'erro_interno' });
      assert.equal(JSON.stringify(res.corpo).includes('PGRST'), false);
      assert.equal(erros.length, 1);
    }
    const resLeitura = await processarIngest(
      { tokenMaquina: tokenClaro, lerCorpo: async () => { throw new Error('conexao abortada'); } },
      { validarEsquema, repositorio: novoRepo() },
    );
    assert.deepEqual(resLeitura, { status: 500, corpo: { erro: 'erro_interno' } });
  });

  it('interpretarRespostaRegistrar segue o contrato da RPC (array de linhas) e recusa forma inesperada', () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const recebido_em = '2026-10-24T12:00:00+00:00';
    assert.deepEqual(interpretarRespostaRegistrar([{ resultado: 'ok', id, recebido_em }]), { resultado: 'ok', id, recebido_em });
    assert.deepEqual(interpretarRespostaRegistrar([{ resultado: 'limite', id: null, recebido_em: null }]), { resultado: 'limite' });
    for (const ruim of [[], null, {}, [{ resultado: 'ok', id: null, recebido_em: null }], [{ resultado: 'x' }]]) {
      assert.throws(() => interpretarRespostaRegistrar(ruim));
    }
  });
});

describe('Integracao real com Supabase local (http://127.0.0.1:55321/functions/v1/ingest)', () => {
  const SUPABASE_URL = 'http://127.0.0.1:55321';
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || gerarJwtLocalDemo('service_role');
  const ENDPOINT = `${SUPABASE_URL}/functions/v1/ingest`;
  const cabecalhosAdmin = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const maquinasCriadas = [];
  let usuarioPromessa = null;

  async function obterUsuarioDeTeste() {
    const emailTeste = 'ingest-f3@exemplo.test';
    const resLista = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers: cabecalhosAdmin });
    assert.equal(resLista.ok, true, `GoTrue local nao respondeu (${resLista.status})`);
    const existente = ((await resLista.json()).users ?? []).find((u) => u.email === emailTeste);
    if (existente) return existente;
    const resCriar = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: cabecalhosAdmin,
      body: JSON.stringify({ email: emailTeste, password: ['Senha', 'Local', '2026!'].join('-'), email_confirm: true }),
    });
    assert.equal(resCriar.ok, true, `Falha ao criar usuario (${resCriar.status})`);
    return resCriar.json();
  }

  /** Cada caso tem sua maquina ficticia, com token proprio e janela livre (ultimo_envio_em nulo). */
  async function criarMaquinaFicticia(caso) {
    usuarioPromessa ??= obterUsuarioDeTeste();
    const usuario = await usuarioPromessa;
    const token = `token-integracao-${caso}-${crypto.randomUUID()}`;
    const resMaq = await fetch(`${SUPABASE_URL}/rest/v1/maquinas`, {
      method: 'POST',
      headers: { ...cabecalhosAdmin, Prefer: 'return=representation' },
      body: JSON.stringify({ dono: usuario.id, apelido: `maquina-integracao-${caso}`, token_hash: await calcularSha256Hex(token), ultimo_envio_em: null }),
    });
    assert.equal(resMaq.ok, true, `Falha ao criar maquina (${resMaq.status})`);
    const [maquina] = await resMaq.json();
    maquinasCriadas.push(maquina.id);
    return { id: maquina.id, token };
  }

  const enviar = (token, payload) =>
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-painel-token': token }, body: JSON.stringify(payload) });

  async function contarInstantaneos(maquinaId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/instantaneos?maquina_id=eq.${maquinaId}&select=id`, { headers: cabecalhosAdmin });
    assert.equal(res.ok, true, `REST local nao respondeu (${res.status})`);
    return (await res.json()).length;
  }

  after(async () => {
    for (const id of maquinasCriadas) {
      await fetch(`${SUPABASE_URL}/rest/v1/maquinas?id=eq.${id}`, { method: 'DELETE', headers: cabecalhosAdmin }).catch(() => {});
    }
  });

  it('422 (Ajv 2020 real) para campo extra, sem gravar', async () => {
    const maquina = await criarMaquinaFicticia('extra');
    const res = await enviar(maquina.token, clonarExemploValido({ coletado_em: new Date().toISOString(), campo_extra: 'x' }));
    assert.equal(res.status, 422);
    assert.equal((await res.json()).erro, 'esquema_invalido');
    assert.equal(await contarInstantaneos(maquina.id), 0);
  });

  it('422 (segredo sem ecoar valor), sem gravar', async () => {
    const maquina = await criarMaquinaFicticia('segredo');
    const segredoSintetico = ['ghp', 'X'.repeat(36)].join('_');
    const payload = clonarExemploValido({ coletado_em: new Date().toISOString() });
    payload.projetos[0].pendencias[0].texto = `Chave: ${segredoSintetico}`;
    const res = await enviar(maquina.token, payload);
    assert.equal(res.status, 422);
    const texto = await res.text();
    assert.equal(texto.includes(segredoSintetico), false);
    assert.deepEqual(JSON.parse(texto), { erro: 'segredo_detectado', caminho: 'projetos[0].pendencias[0].texto', regra: 'github_pat_classic' });
    assert.equal(await contarInstantaneos(maquina.id), 0);
  });

  it('200 com id e recebido_em e uma linha gravada', async () => {
    const maquina = await criarMaquinaFicticia('valido');
    const res = await enviar(maquina.token, clonarExemploValido({ coletado_em: new Date().toISOString() }));
    assert.equal(res.status, 200);
    const corpo = await res.json();
    assert.ok(typeof corpo.id === 'string' && typeof corpo.recebido_em === 'string');
    assert.equal(await contarInstantaneos(maquina.id), 1);
  });

  it('dois envios validos em paralelo da mesma maquina: [200, 429] e exatamente uma linha nova', async () => {
    const maquina = await criarMaquinaFicticia('paralelo');
    const base = Date.now();
    const respostas = await Promise.all([
      enviar(maquina.token, clonarExemploValido({ coletado_em: new Date(base).toISOString() })),
      enviar(maquina.token, clonarExemploValido({ coletado_em: new Date(base - 1000).toISOString() })),
    ]);
    await Promise.all(respostas.map((r) => r.text()));
    assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 429]);
    assert.equal(await contarInstantaneos(maquina.id), 1);
  });
});

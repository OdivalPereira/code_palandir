export const LIMITE_BYTES_CORPO = 262_144;
export const LIMITE_ERROS_ESQUEMA = 10;

export interface MaquinaRegistro { id: string; dono?: string; }
/** Dados que a gravação atômica recebe; o `dono` sai da máquina, no banco, nunca do corpo. */
export interface EnvioParaRegistrar { maquina_id: string; coletado_em: string; corpo: Record<string, unknown>; bytes: number; }
/** Contrato de `public.ingest_registrar`: 'ok' gravou; 'limite' é janela de 1 minuto ativa e nada foi gravado. */
export type ResultadoRegistro = { resultado: 'ok'; id: string; recebido_em: string } | { resultado: 'limite' };

export interface IngestRepositorio {
  buscarMaquinaPorTokenHash(tokenHash: string): Promise<MaquinaRegistro | null>;
  /** Uma só operação: reserva a janela, faz o upsert e aplica a retenção numa transação (RPC `ingest_registrar`). */
  registrarEnvio(envio: EnvioParaRegistrar): Promise<ResultadoRegistro>;
}

export interface ErroEsquema { caminho: string; mensagem: string; }
export interface ResultadoValidacaoEsquema { valido: boolean; erros?: ErroEsquema[]; }
export interface ErroAjvLike { instancePath?: string; message?: string; keyword?: string; params?: Record<string, unknown>; }
export type FuncaoAjvLike = ((dados: unknown) => boolean) & { errors?: ErroAjvLike[] | null };
export type ValidadorEsquema = ((dados: unknown) => ResultadoValidacaoEsquema) | FuncaoAjvLike;
export type ResultadoLeituraCorpo = { excedeu: false; texto: string; bytes: number } | { excedeu: true };
/** Leitor preguiçoso do corpo: só é chamado depois de a máquina ser autenticada. */
export type LeitorCorpo = () => Promise<ResultadoLeituraCorpo>;
export interface RequisicaoIngest { tokenMaquina: string | null | undefined; lerCorpo: LeitorCorpo; }
export interface RespostaIngest { status: number; corpo: Record<string, unknown>; }
export interface OpcoesIngest {
  validarEsquema: ValidadorEsquema;
  repositorio: IngestRepositorio;
  /** Recebe a exceção para log no servidor; o cliente só vê `erro_interno`. */
  registrarErro?: (erro: unknown) => void;
}

const REGRAS_SEGREDO: Array<{ nome: string; padrao: RegExp }> = [
  { nome: 'github_pat_classic', padrao: new RegExp('gh' + 'p_[a-zA-Z0-9]{36}') },
  { nome: 'github_pat_fine_grained', padrao: new RegExp('github_' + 'pat_[a-zA-Z0-9_]+') },
  { nome: 'github_oauth', padrao: new RegExp('gh' + 'o_[a-zA-Z0-9]{36}') },
  { nome: 'github_user_token', padrao: new RegExp('gh' + 'u_[a-zA-Z0-9]{36}') },
  { nome: 'github_server_token', padrao: new RegExp('gh' + 's_[a-zA-Z0-9]{36}') },
  { nome: 'github_refresh_token', padrao: new RegExp('gh' + 'r_[a-zA-Z0-9]{36}') },
  { nome: 'google_api_key', padrao: new RegExp('AIza' + 'Sy[0-9A-Za-z_-]{30,40}') },
  { nome: 'openai_anthropic_key', padrao: new RegExp('s' + 'k-(?:proj-|live-|ant-)?[a-zA-Z0-9_-]{20,}') },
  { nome: 'aws_access_key', padrao: new RegExp('AK' + 'IA[0-9A-Z]{16}') },
  { nome: 'bearer_token', padrao: new RegExp('Bearer\\s+[a-zA-Z0-9_\\-\\.]{15,}', 'i') },
  { nome: 'private_key', padrao: new RegExp('-----BEGIN [A-Z ]+PRIVATE' + ' KEY-----[\\s\\S]*?-----END [A-Z ]+PRIVATE' + ' KEY-----') },
  {
    nome: 'atribuicao_segredo',
    padrao: new RegExp('((?:api[_-]?key|client[_-]?secret|auth[_-]?token|secret[_-]?key|access[_-]?token|private[_-]?key)\\s*[:=]\\s*[\'"])([^\'"]{6,})([\'"])', 'i'),
  },
];

export async function calcularSha256Hex(texto: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function varrerSegredos(valor: unknown, caminhoAtual = ''): { caminho: string; regra: string } | null {
  if (typeof valor === 'string') {
    for (const regra of REGRAS_SEGREDO) {
      if (regra.padrao.test(valor)) return { caminho: caminhoAtual || '$', regra: regra.nome };
    }
    return null;
  }
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i += 1) {
      const achado = varrerSegredos(valor[i], `${caminhoAtual}[${i}]`);
      if (achado) return achado;
    }
    return null;
  }
  if (valor !== null && typeof valor === 'object') {
    for (const [chave, subvalor] of Object.entries(valor as Record<string, unknown>)) {
      const achado = varrerSegredos(subvalor, caminhoAtual ? `${caminhoAtual}.${chave}` : chave);
      if (achado) return achado;
    }
  }
  return null;
}

function executarValidacaoEsquema(validador: ValidadorEsquema, dados: unknown): ResultadoValidacaoEsquema {
  const resultado = validador(dados);
  if (typeof resultado === 'boolean') {
    if (resultado) return { valido: true };
    const errosBrutos = (validador as FuncaoAjvLike).errors ?? [];
    const erros: ErroEsquema[] = errosBrutos.slice(0, LIMITE_ERROS_ESQUEMA).map((err) => {
      const extra =
        err.keyword === 'additionalProperties' && err.params && typeof err.params.additionalProperty === 'string'
          ? ` (${err.params.additionalProperty})`
          : '';
      return { caminho: err.instancePath || '/', mensagem: `${err.message ?? 'erro de esquema'}${extra}` };
    });
    return { valido: false, erros: erros.length > 0 ? erros : [{ caminho: '/', mensagem: 'esquema inválido' }] };
  }
  return { valido: resultado.valido, erros: (resultado.erros ?? []).slice(0, LIMITE_ERROS_ESQUEMA) };
}

function interpretarContentLength(valor: string | number | null | undefined): number | null {
  if (typeof valor === 'number') return Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
  if (typeof valor !== 'string' || !/^\s*\d+\s*$/.test(valor)) return null;
  const n = Number(valor.trim());
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Lê o corpo do stream contando bytes. Um `Content-Length` acima do limite recusa sem ler nada;
 * sem ele (ou com ele mentindo), a leitura para e cancela o reader assim que passa do limite.
 */
export async function lerCorpoLimitado(
  stream: ReadableStream<Uint8Array> | null | undefined,
  limite: number = LIMITE_BYTES_CORPO,
  contentLength?: string | number | null,
): Promise<ResultadoLeituraCorpo> {
  const declarado = interpretarContentLength(contentLength);
  if (declarado !== null && declarado > limite) {
    if (stream) await stream.cancel().catch(() => {});
    return { excedeu: true };
  }
  if (!stream) return { excedeu: false, texto: '', bytes: 0 };

  const reader = stream.getReader();
  const blocos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > limite) {
        await reader.cancel().catch(() => {});
        return { excedeu: true };
      }
      blocos.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const unido = new Uint8Array(total);
  let posicao = 0;
  for (const bloco of blocos) {
    unido.set(bloco, posicao);
    posicao += bloco.byteLength;
  }
  return { excedeu: false, texto: new TextDecoder('utf-8').decode(unido), bytes: total };
}

/** Converte a resposta do PostgREST (array de linhas) da RPC `ingest_registrar` no contrato; forma inesperada lança. */
export function interpretarRespostaRegistrar(resposta: unknown): ResultadoRegistro {
  const linha = (Array.isArray(resposta) ? resposta[0] : resposta) as Record<string, unknown> | null | undefined;
  if (linha && linha.resultado === 'limite') return { resultado: 'limite' };
  if (linha && linha.resultado === 'ok' && typeof linha.id === 'string' && typeof linha.recebido_em === 'string') {
    return { resultado: 'ok', id: linha.id, recebido_em: linha.recebido_em };
  }
  throw new Error('resposta inesperada de ingest_registrar');
}

const ERRO_INTERNO: RespostaIngest = { status: 500, corpo: { erro: 'erro_interno' } };

/** Fluxo da arquitetura 4.4: token, máquina, tamanho, JSON, esquema, segredos e, só então, a gravação atômica. */
export async function processarIngest(requisicao: RequisicaoIngest, opcoes: OpcoesIngest): Promise<RespostaIngest> {
  try {
    return await executarFluxo(requisicao, opcoes);
  } catch (erro) {
    opcoes.registrarErro?.(erro);
    return { status: ERRO_INTERNO.status, corpo: { ...ERRO_INTERNO.corpo } };
  }
}

async function executarFluxo(requisicao: RequisicaoIngest, opcoes: OpcoesIngest): Promise<RespostaIngest> {
  const { validarEsquema, repositorio } = opcoes;

  const tokenBruto = requisicao.tokenMaquina?.trim() ?? '';
  if (!tokenBruto) return { status: 401, corpo: { erro: 'token_invalido' } };

  const tokenHash = await calcularSha256Hex(tokenBruto);
  const maquina = await repositorio.buscarMaquinaPorTokenHash(tokenHash);
  if (!maquina) return { status: 401, corpo: { erro: 'token_invalido' } };

  const leitura = await requisicao.lerCorpo();
  if (leitura.excedeu) {
    return { status: 413, corpo: { erro: 'corpo_acima_do_limite', limite_bytes: LIMITE_BYTES_CORPO } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(leitura.texto);
  } catch {
    return { status: 400, corpo: { erro: 'json_invalido' } };
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 422, corpo: { erro: 'esquema_invalido', erros: [{ caminho: '/', mensagem: 'raiz deve ser um objeto JSON' }] } };
  }

  const validacao = executarValidacaoEsquema(validarEsquema, payload);
  if (!validacao.valido) {
    return { status: 422, corpo: { erro: 'esquema_invalido', erros: (validacao.erros ?? []).slice(0, LIMITE_ERROS_ESQUEMA) } };
  }

  const segredoDetectado = varrerSegredos(payload);
  if (segredoDetectado) {
    return { status: 422, corpo: { erro: 'segredo_detectado', caminho: segredoDetectado.caminho, regra: segredoDetectado.regra } };
  }

  const corpoObjeto = payload as Record<string, unknown>;
  const registro = await repositorio.registrarEnvio({
    maquina_id: maquina.id,
    coletado_em: String(corpoObjeto.coletado_em),
    corpo: corpoObjeto,
    bytes: leitura.bytes,
  });

  if (registro.resultado === 'limite') return { status: 429, corpo: { erro: 'limite_frequencia_excedido' } };
  if (registro.resultado === 'ok') return { status: 200, corpo: { id: registro.id, recebido_em: registro.recebido_em } };
  throw new Error('resultado desconhecido do repositorio');
}

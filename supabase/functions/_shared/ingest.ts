export const LIMITE_BYTES_CORPO = 262_144;
export const JANELA_LIMITE_MS = 60_000;
export const LIMITE_RETENCAO_POR_MAQUINA = 20;
export const LIMITE_ERROS_ESQUEMA = 10;

export interface MaquinaRegistro { id: string; dono: string; apelido?: string; token_hash: string; ultimo_envio_em: string | null; }
export interface NovoInstantaneo { maquina_id: string; dono: string; coletado_em: string; recebido_em: string; esquema: string; corpo: Record<string, unknown>; bytes: number; }
export interface InstantaneoSalvo { id: string; recebido_em: string; }
export interface InstantaneoResumo { id: string; coletado_em: string; recebido_em: string; }

export interface IngestRepositorio {
  buscarMaquinaPorTokenHash(tokenHash: string): Promise<MaquinaRegistro | null>;
  upsertInstantaneo(instantaneo: NovoInstantaneo): Promise<InstantaneoSalvo>;
  listarInstantaneosDaMaquina(maquinaId: string): Promise<InstantaneoResumo[]>;
  removerInstantaneos(ids: string[]): Promise<void>;
  atualizarUltimoEnvio(maquinaId: string, recebidoEm: string): Promise<void>;
}

export interface ErroEsquema { caminho: string; mensagem: string; }
export interface ResultadoValidacaoEsquema { valido: boolean; erros?: ErroEsquema[]; }
export interface ErroAjvLike { instancePath?: string; message?: string; keyword?: string; params?: Record<string, unknown>; }
export type FuncaoAjvLike = ((dados: unknown) => boolean) & { errors?: ErroAjvLike[] | null };
export type ValidadorEsquema = ((dados: unknown) => ResultadoValidacaoEsquema) | FuncaoAjvLike;
export interface RequisicaoIngest { metodo?: string; tokenMaquina: string | null | undefined; corpoBruto: string; agora?: Date; }
export interface RespostaIngest { status: number; corpo: Record<string, unknown>; }

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

export async function processarIngest(
  requisicao: RequisicaoIngest,
  opcoes: { validarEsquema: ValidadorEsquema; repositorio: IngestRepositorio },
): Promise<RespostaIngest> {
  const { validarEsquema, repositorio } = opcoes;
  const agora = requisicao.agora ?? new Date();

  const tokenBruto = requisicao.tokenMaquina?.trim() ?? '';
  if (!tokenBruto) return { status: 401, corpo: { erro: 'token_invalido' } };

  const tokenHash = await calcularSha256Hex(tokenBruto);
  const maquina = await repositorio.buscarMaquinaPorTokenHash(tokenHash);
  if (!maquina) return { status: 401, corpo: { erro: 'token_invalido' } };

  const bytes = new TextEncoder().encode(requisicao.corpoBruto).byteLength;
  if (bytes > LIMITE_BYTES_CORPO) {
    return { status: 413, corpo: { erro: 'corpo_acima_do_limite', limite_bytes: LIMITE_BYTES_CORPO, bytes } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(requisicao.corpoBruto);
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

  if (maquina.ultimo_envio_em) {
    const ultimoEnvioMs = Date.parse(maquina.ultimo_envio_em);
    if (!Number.isNaN(ultimoEnvioMs) && agora.getTime() - ultimoEnvioMs < JANELA_LIMITE_MS) {
      return { status: 429, corpo: { erro: 'limite_frequencia_excedido' } };
    }
  }

  const corpoObjeto = payload as Record<string, unknown>;
  const coletadoEm = String(corpoObjeto.coletado_em);
  const recebidoEm = agora.toISOString();

  const salvo = await repositorio.upsertInstantaneo({
    maquina_id: maquina.id,
    dono: maquina.dono,
    coletado_em: coletadoEm,
    recebido_em: recebidoEm,
    esquema: 'painel/1',
    corpo: corpoObjeto,
    bytes,
  });

  const instantaneosAtuais = await repositorio.listarInstantaneosDaMaquina(maquina.id);
  const ordenados = [...instantaneosAtuais].sort((a, b) => {
    const diffColetado = Date.parse(b.coletado_em) - Date.parse(a.coletado_em);
    return diffColetado !== 0 ? diffColetado : Date.parse(b.recebido_em) - Date.parse(a.recebido_em);
  });

  if (ordenados.length > LIMITE_RETENCAO_POR_MAQUINA) {
    const idsExcedentes = ordenados.slice(LIMITE_RETENCAO_POR_MAQUINA).map((item) => item.id);
    if (idsExcedentes.length > 0) await repositorio.removerInstantaneos(idsExcedentes);
  }

  await repositorio.atualizarUltimoEnvio(maquina.id, recebidoEm);
  return { status: 200, corpo: { id: salvo.id, recebido_em: salvo.recebido_em } };
}

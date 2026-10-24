import Ajv2020Module from 'npm:ajv@8/dist/2020.js';
import addFormatsModule from 'npm:ajv-formats@3';
import schema from '../_shared/painel-1.schema.json' with { type: 'json' };
import {
  LIMITE_BYTES_CORPO,
  interpretarRespostaRegistrar,
  lerCorpoLimitado,
  processarIngest,
  type EnvioParaRegistrar,
  type FuncaoAjvLike,
  type IngestRepositorio,
  type MaquinaRegistro,
  type ResultadoRegistro,
} from '../_shared/ingest.ts';

type ConstrutorAjv = new (opcoes?: Record<string, unknown>) => { compile: (esquema: unknown) => FuncaoAjvLike };

const Ajv2020 = (Ajv2020Module as unknown as { default?: ConstrutorAjv }).default ?? (Ajv2020Module as unknown as ConstrutorAjv);
const addFormats =
  (addFormatsModule as unknown as { default?: (instancia: unknown) => void }).default ??
  (addFormatsModule as unknown as (instancia: unknown) => void);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validarEsquema = ajv.compile(schema);

function criarRepositorioPostgrest(supabaseUrl: string, serviceRoleKey: string): IngestRepositorio {
  const baseRestUrl = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`;
  const cabecalhosBase: Record<string, string> = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  return {
    async buscarMaquinaPorTokenHash(tokenHash: string): Promise<MaquinaRegistro | null> {
      const url = `${baseRestUrl}/maquinas?token_hash=eq.${encodeURIComponent(tokenHash)}&select=id,dono&limit=1`;
      const res = await fetch(url, { method: 'GET', headers: { ...cabecalhosBase, Accept: 'application/json' } });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`buscar maquina falhou (${res.status})`);
      }
      const linhas = (await res.json()) as MaquinaRegistro[];
      return linhas[0] ?? null;
    },
    async registrarEnvio(envio: EnvioParaRegistrar): Promise<ResultadoRegistro> {
      const res = await fetch(`${baseRestUrl}/rpc/ingest_registrar`, {
        method: 'POST',
        headers: { ...cabecalhosBase, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          p_maquina_id: envio.maquina_id,
          p_coletado_em: envio.coletado_em,
          p_corpo: envio.corpo,
          p_bytes: envio.bytes,
        }),
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`rpc ingest_registrar falhou (${res.status})`);
      }
      return interpretarRespostaRegistrar(await res.json());
    },
  };
}

const CABECALHO_JSON = { 'Content-Type': 'application/json; charset=utf-8' };
const responder = (status: number, corpo: Record<string, unknown>) =>
  new Response(JSON.stringify(corpo), { status, headers: CABECALHO_JSON });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return responder(405, { erro: 'metodo_nao_permitido' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return responder(500, { erro: 'configuracao_incompleta' });

  try {
    const resultado = await processarIngest(
      {
        tokenMaquina: req.headers.get('x-painel-token'),
        lerCorpo: () => lerCorpoLimitado(req.body, LIMITE_BYTES_CORPO, req.headers.get('content-length')),
      },
      {
        validarEsquema,
        repositorio: criarRepositorioPostgrest(supabaseUrl, serviceRoleKey),
        registrarErro: (erro: unknown) => console.error('ingest: erro interno', erro instanceof Error ? erro.message : erro),
      },
    );
    return responder(resultado.status, resultado.corpo);
  } catch (erro) {
    console.error('ingest: erro interno', erro instanceof Error ? erro.message : erro);
    return responder(500, { erro: 'erro_interno' });
  }
});

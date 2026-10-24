import Ajv2020Module from 'npm:ajv@8/dist/2020.js';
import addFormatsModule from 'npm:ajv-formats@3';
import schema from '../_shared/painel-1.schema.json' with { type: 'json' };
import {
  processarIngest,
  type FuncaoAjvLike,
  type IngestRepositorio,
  type InstantaneoResumo,
  type InstantaneoSalvo,
  type MaquinaRegistro,
  type NovoInstantaneo,
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
      const url = `${baseRestUrl}/maquinas?token_hash=eq.${encodeURIComponent(tokenHash)}&select=id,dono,apelido,token_hash,ultimo_envio_em&limit=1`;
      const res = await fetch(url, { method: 'GET', headers: { ...cabecalhosBase, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Falha ao buscar maquina (${res.status})`);
      const linhas = (await res.json()) as MaquinaRegistro[];
      return linhas[0] ?? null;
    },
    async upsertInstantaneo(instantaneo: NovoInstantaneo): Promise<InstantaneoSalvo> {
      const url = `${baseRestUrl}/instantaneos?on_conflict=maquina_id,coletado_em&select=id,recebido_em`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...cabecalhosBase,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(instantaneo),
      });
      if (!res.ok) throw new Error(`Falha no upsert de instantaneo (${res.status}): ${await res.text()}`);
      const linhas = (await res.json()) as InstantaneoSalvo[];
      if (!linhas[0]) throw new Error('Upsert nao retornou registro');
      return linhas[0];
    },
    async listarInstantaneosDaMaquina(maquinaId: string): Promise<InstantaneoResumo[]> {
      const url = `${baseRestUrl}/instantaneos?maquina_id=eq.${encodeURIComponent(maquinaId)}&select=id,coletado_em,recebido_em&order=coletado_em.desc,recebido_em.desc`;
      const res = await fetch(url, { method: 'GET', headers: { ...cabecalhosBase, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Falha ao listar instantaneos (${res.status})`);
      return (await res.json()) as InstantaneoResumo[];
    },
    async removerInstantaneos(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const filtroIds = ids.map((id) => encodeURIComponent(id)).join(',');
      const res = await fetch(`${baseRestUrl}/instantaneos?id=in.(${filtroIds})`, { method: 'DELETE', headers: cabecalhosBase });
      if (!res.ok) throw new Error(`Falha ao remover instantaneos excedentes (${res.status})`);
    },
    async atualizarUltimoEnvio(maquinaId: string, recebidoEm: string): Promise<void> {
      const res = await fetch(`${baseRestUrl}/maquinas?id=eq.${encodeURIComponent(maquinaId)}`, {
        method: 'PATCH',
        headers: { ...cabecalhosBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ultimo_envio_em: recebidoEm }),
      });
      if (!res.ok) throw new Error(`Falha ao atualizar ultimo_envio_em (${res.status})`);
    },
  };
}

const CABECALHO_JSON = { 'Content-Type': 'application/json; charset=utf-8' };

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'metodo_nao_permitido' }), { status: 405, headers: CABECALHO_JSON });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ erro: 'configuracao_incompleta' }), { status: 500, headers: CABECALHO_JSON });
  }
  try {
    const tokenMaquina = req.headers.get('x-painel-token');
    const corpoBruto = await req.text();
    const repositorio = criarRepositorioPostgrest(supabaseUrl, serviceRoleKey);
    const resultado = await processarIngest({ metodo: req.method, tokenMaquina, corpoBruto }, { validarEsquema, repositorio });
    return new Response(JSON.stringify(resultado.corpo), { status: resultado.status, headers: CABECALHO_JSON });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'erro_interno';
    return new Response(JSON.stringify({ erro: 'erro_interno', detalhe: mensagem }), { status: 500, headers: CABECALHO_JSON });
  }
});

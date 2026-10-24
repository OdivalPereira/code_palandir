-- Etapa p1-fundacao, correção 1 (F01 e F02, lado do banco): ingestão atômica.
--
-- Migração aditiva: não altera tabelas, grants nem RLS da migração de 23/10.
-- A Edge Function `ingest` chama esta função por RPC, com service_role, depois de
-- autenticar a máquina e validar tamanho, JSON, esquema e segredos.

CREATE FUNCTION public.ingest_registrar(
  p_maquina_id uuid,
  p_coletado_em timestamptz,
  p_corpo jsonb,
  p_bytes int
)
RETURNS TABLE (resultado text, id uuid, recebido_em timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_dono uuid;
  v_id uuid;
  v_recebido_em timestamptz;
BEGIN
  -- 1. Reserva a janela de 1 envio por minuto. O row lock deste UPDATE arbitra
  --    pedidos concorrentes da mesma máquina: o segundo espera o primeiro e,
  --    depois do commit dele, já não satisfaz a condição de tempo.
  UPDATE public.maquinas AS m
     SET ultimo_envio_em = now()
   WHERE m.id = p_maquina_id
     AND (m.ultimo_envio_em IS NULL OR m.ultimo_envio_em <= now() - interval '60 seconds')
  RETURNING m.dono INTO v_dono;

  IF NOT FOUND THEN
    resultado := 'limite';
    id := NULL;
    recebido_em := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Grava o instantâneo; o dono vem da máquina, nunca do corpo.
  INSERT INTO public.instantaneos AS i (maquina_id, dono, coletado_em, esquema, corpo, bytes)
  VALUES (p_maquina_id, v_dono, p_coletado_em, 'painel/1', p_corpo, p_bytes)
  ON CONFLICT (maquina_id, coletado_em) DO UPDATE
     SET corpo = EXCLUDED.corpo,
         bytes = EXCLUDED.bytes,
         recebido_em = now()
  RETURNING i.id, i.recebido_em INTO v_id, v_recebido_em;

  -- 3. Retenção: mantém só os 20 instantâneos mais recentes da máquina.
  DELETE FROM public.instantaneos AS d
   WHERE d.id IN (
     SELECT x.id
       FROM public.instantaneos AS x
      WHERE x.maquina_id = p_maquina_id
      ORDER BY x.coletado_em DESC, x.recebido_em DESC
     OFFSET 20
   );

  -- 4. Devolve a linha gravada.
  resultado := 'ok';
  id := v_id;
  recebido_em := v_recebido_em;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.ingest_registrar(uuid, timestamptz, jsonb, int) IS
  'Ingestão atômica de um instantâneo: reserva a janela de 1 envio por minuto da máquina '
  '(UPDATE condicional com row lock), faz upsert em (maquina_id, coletado_em) com o dono da '
  'máquina e mantém os 20 mais recentes. Devolve ''ok'' com id e recebido_em, ou ''limite'' '
  'sem gravar nada. Qualquer erro desfaz tudo, inclusive a reserva. Só service_role executa.';

REVOKE ALL ON FUNCTION public.ingest_registrar(uuid, timestamptz, jsonb, int)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ingest_registrar(uuid, timestamptz, jsonb, int)
  TO service_role;

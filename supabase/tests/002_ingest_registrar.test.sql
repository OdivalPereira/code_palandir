BEGIN;

SELECT plan(27);

-- 1. Estrutura e privilégios da função
SELECT has_function(
  'public',
  'ingest_registrar',
  ARRAY['uuid', 'timestamp with time zone', 'jsonb', 'integer'],
  'funcao public.ingest_registrar existe com a assinatura do contrato'
);

SELECT is(
  (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = 'public.ingest_registrar(uuid,timestamptz,jsonb,int)'::regprocedure),
  false,
  'ingest_registrar e SECURITY INVOKER'
);

SELECT ok(
  (SELECT 'search_path=""' = ANY(p.proconfig) FROM pg_proc p WHERE p.oid = 'public.ingest_registrar(uuid,timestamptz,jsonb,int)'::regprocedure),
  'ingest_registrar fixa search_path vazio'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.ingest_registrar(uuid,timestamptz,jsonb,int)', 'EXECUTE'),
  'anon nao tem EXECUTE em ingest_registrar'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.ingest_registrar(uuid,timestamptz,jsonb,int)', 'EXECUTE'),
  'authenticated nao tem EXECUTE em ingest_registrar'
);

SELECT ok(
  has_function_privilege('service_role', 'public.ingest_registrar(uuid,timestamptz,jsonb,int)', 'EXECUTE'),
  'service_role tem EXECUTE em ingest_registrar'
);

-- Massa de teste fictícia própria (ingest@exemplo.test e uma máquina sem envio)
DELETE FROM public.maquinas WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
DELETE FROM auth.users
WHERE email = 'ingest@exemplo.test' OR id = '33333333-3333-3333-3333-333333333333';

INSERT INTO auth.users (id, email, aud, role)
VALUES ('33333333-3333-3333-3333-333333333333', 'ingest@exemplo.test', 'authenticated', 'authenticated');

INSERT INTO public.maquinas (id, dono, apelido, token_hash)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '33333333-3333-3333-3333-333333333333',
  'ingest-exemplo',
  repeat('d', 64)
);

CREATE TEMP TABLE r_ingest (passo text, resultado text, id uuid, recebido_em timestamptz) ON COMMIT DROP;
GRANT ALL ON TABLE r_ingest TO service_role;

-- 2. Primeiro envio, chamado como service_role (SECURITY INVOKER sob o papel da Edge Function).
--    O corpo traz um "dono" forjado, que deve ser ignorado.
SET LOCAL ROLE service_role;
INSERT INTO r_ingest
SELECT 'primeiro', r.*
FROM public.ingest_registrar(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '2026-10-24T10:00:00Z',
  '{"esquema":"painel/1","coletado_em":"2026-10-24T10:00:00Z","dono":"22222222-2222-2222-2222-222222222222"}'::jsonb,
  120
) AS r;
RESET ROLE;

SELECT is((SELECT resultado FROM r_ingest WHERE passo = 'primeiro'), 'ok', 'primeiro envio devolve ok');

SELECT ok(
  (SELECT r.id IS NOT NULL AND r.recebido_em = now() FROM r_ingest r WHERE passo = 'primeiro'),
  'primeiro envio devolve id e recebido_em preenchidos'
);

SELECT results_eq(
  $$SELECT i.id, i.dono, i.esquema, i.bytes FROM public.instantaneos i
     WHERE i.maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  $$SELECT r.id, '33333333-3333-3333-3333-333333333333'::uuid, 'painel/1'::text, 120
      FROM r_ingest r WHERE r.passo = 'primeiro'$$,
  'linha gravada com o dono da maquina (nao o do corpo), esquema painel/1 e bytes'
);

SELECT is(
  (SELECT ultimo_envio_em FROM public.maquinas WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  now(),
  'primeiro envio reserva a janela (ultimo_envio_em = now())'
);

-- 3. Segundo envio dentro da janela (último envio há 30 s)
UPDATE public.maquinas SET ultimo_envio_em = now() - interval '30 seconds'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

INSERT INTO r_ingest
SELECT 'dentro', r.*
FROM public.ingest_registrar(
  'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-24T10:01:00Z', '{"esquema":"painel/1"}'::jsonb, 50
) AS r;

SELECT ok(
  (SELECT r.resultado = 'limite' AND r.id IS NULL AND r.recebido_em IS NULL FROM r_ingest r WHERE passo = 'dentro'),
  'segundo envio dentro da janela devolve limite, com id e recebido_em nulos'
);

SELECT is(
  (SELECT count(*)::int FROM public.instantaneos WHERE maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  1,
  'envio barrado pela janela nao grava linha nova'
);

SELECT is(
  (SELECT ultimo_envio_em FROM public.maquinas WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  now() - interval '30 seconds',
  'envio barrado pela janela nao altera ultimo_envio_em'
);

-- Fronteira: 59 s ainda está dentro da janela
UPDATE public.maquinas SET ultimo_envio_em = now() - interval '59 seconds'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

SELECT is(
  (SELECT r.resultado FROM public.ingest_registrar(
     'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-24T10:01:00Z', '{"esquema":"painel/1"}'::jsonb, 50) r),
  'limite',
  'envio 59 s depois do anterior ainda devolve limite'
);

-- 4. Envio depois da janela (now() é fixo na transação; recua ultimo_envio_em)
UPDATE public.maquinas SET ultimo_envio_em = now() - interval '60 seconds'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

INSERT INTO r_ingest
SELECT 'depois', r.*
FROM public.ingest_registrar(
  'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-24T10:01:00Z', '{"esquema":"painel/1","n":1}'::jsonb, 60
) AS r;

SELECT is((SELECT resultado FROM r_ingest WHERE passo = 'depois'), 'ok', 'envio 60 s depois do anterior devolve ok');

SELECT is(
  (SELECT count(*)::int FROM public.instantaneos WHERE maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  2,
  'envio depois da janela grava nova coleta'
);

SELECT is(
  (SELECT ultimo_envio_em FROM public.maquinas WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  now(),
  'envio depois da janela renova ultimo_envio_em'
);

-- 5. Reenvio do mesmo coletado_em fora da janela: atualiza sem duplicar
UPDATE public.instantaneos SET recebido_em = now() - interval '1 hour'
WHERE maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' AND coletado_em = '2026-10-24T10:00:00Z';
UPDATE public.maquinas SET ultimo_envio_em = now() - interval '61 seconds'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

INSERT INTO r_ingest
SELECT 'reenvio', r.*
FROM public.ingest_registrar(
  'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-24T10:00:00Z', '{"esquema":"painel/1","versao":2}'::jsonb, 77
) AS r;

SELECT ok(
  (SELECT r.resultado = 'ok' AND r.id = p.id
     FROM r_ingest r, r_ingest p WHERE r.passo = 'reenvio' AND p.passo = 'primeiro'),
  'reenvio da mesma coleta devolve ok com o id da linha original'
);

SELECT is(
  (SELECT count(*)::int FROM public.instantaneos WHERE maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  2,
  'reenvio da mesma coleta nao duplica a linha'
);

SELECT results_eq(
  $$SELECT i.corpo, i.bytes, i.recebido_em FROM public.instantaneos i
     WHERE i.maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' AND i.coletado_em = '2026-10-24T10:00:00Z'$$,
  $$VALUES ('{"esquema":"painel/1","versao":2}'::jsonb, 77, now())$$,
  'reenvio atualiza corpo, bytes e recebido_em'
);

-- 6. Retenção: completa 21 coletas distintas (10:00 a 10:20); a mais antiga (10:00) sai
DO $$
DECLARE
  k int;
  v_resultado text;
BEGIN
  FOR k IN 2..20 LOOP
    UPDATE public.maquinas SET ultimo_envio_em = now() - interval '61 seconds'
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

    SELECT r.resultado INTO v_resultado
    FROM public.ingest_registrar(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      '2026-10-24T10:00:00Z'::timestamptz + make_interval(mins => k),
      jsonb_build_object('esquema', 'painel/1', 'k', k),
      40
    ) r;

    IF v_resultado <> 'ok' THEN
      RAISE EXCEPTION 'coleta % devolveu %', k, v_resultado;
    END IF;
  END LOOP;
END;
$$;

SELECT is(
  (SELECT count(*)::int FROM public.instantaneos WHERE maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  20,
  'depois de 21 coletas distintas sobram 20'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.instantaneos
    WHERE maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' AND coletado_em = '2026-10-24T10:00:00Z'
  ),
  'a retencao remove a coleta mais antiga'
);

SELECT is(
  (SELECT min(coletado_em) FROM public.instantaneos WHERE maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  '2026-10-24T10:01:00Z'::timestamptz,
  'a coleta seguinte vira a mais antiga retida'
);

SELECT is(
  (SELECT count(*)::int FROM public.instantaneos WHERE dono = '22222222-2222-2222-2222-222222222222'
     AND maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0,
  'nenhuma linha da maquina fica com dono tirado do corpo'
);

-- 7. Falha forçada depois da reserva: bytes acima de 262144 viola o CHECK e desfaz tudo
UPDATE public.maquinas SET ultimo_envio_em = now() - interval '2 minutes'
WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

SELECT throws_ok(
  $$SELECT * FROM public.ingest_registrar(
      'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-24T11:00:00Z', '{"esquema":"painel/1"}'::jsonb, 300000)$$,
  '23514',
  NULL,
  'p_bytes = 300000 falha no CHECK de bytes depois da reserva da janela'
);

SELECT is(
  (SELECT ultimo_envio_em FROM public.maquinas WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  now() - interval '2 minutes',
  'falha desfaz a reserva: ultimo_envio_em intacto'
);

SELECT is(
  (SELECT count(*)::int FROM public.instantaneos
    WHERE maquina_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      AND (coletado_em = '2026-10-24T11:00:00Z' OR bytes = 300000)),
  0,
  'falha nao grava linha nova'
);

SELECT * FROM finish();

ROLLBACK;

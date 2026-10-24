BEGIN;

SELECT plan(28);

-- 1. Verificações estruturais de tabelas, view e índice (sem views normalizadas)
SELECT has_table('public', 'maquinas', 'tabela public.maquinas existe');
SELECT has_table('public', 'instantaneos', 'tabela public.instantaneos existe');
SELECT has_table('public', 'cotas', 'tabela public.cotas existe');
SELECT has_view('public', 'v_ultimo_instantaneo', 'view public.v_ultimo_instantaneo existe');
SELECT hasnt_view('public', 'v_projetos', 'view normalizada v_projetos nao deve existir na p1');
SELECT hasnt_view('public', 'v_pendencias', 'view normalizada v_pendencias nao deve existir na p1');
SELECT has_index(
  'public',
  'instantaneos',
  'idx_instantaneos_maquina_coletado',
  'indice idx_instantaneos_maquina_coletado existe em public.instantaneos'
);

SELECT is(
  (
    SELECT 'security_invoker=true' = ANY(c.reloptions)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'v_ultimo_instantaneo'
  ),
  true,
  'v_ultimo_instantaneo tem security_invoker = true'
);

-- Limpeza dentro da transação de teste (preserva seed.sql após o ROLLBACK final)
TRUNCATE TABLE public.instantaneos, public.cotas, public.maquinas CASCADE;
DELETE FROM auth.users
WHERE email IN ('dono@exemplo.test', 'outro@exemplo.test')
   OR id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Massa de teste fictícia (dono@exemplo.test e outro@exemplo.test)
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'dono@exemplo.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'outro@exemplo.test', 'authenticated', 'authenticated');

-- Máquinas criadas via papel administrativo (simulando service_role / script nova-maquina)
INSERT INTO public.maquinas (id, dono, apelido, token_hash)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'notebook-exemplo',
    repeat('a', 64)
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'estacao-exemplo',
    repeat('b', 64)
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'maquina-outro-exemplo',
    repeat('c', 64)
  );

-- Instantâneos inseridos via papel administrativo (simulando Edge Function ingest)
INSERT INTO public.instantaneos (id, maquina_id, dono, coletado_em, recebido_em, esquema, corpo, bytes)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '2026-10-23T14:00:00Z',
    '2026-10-23T14:00:05Z',
    'painel/1',
    '{"esquema":"painel/1","coletado_em":"2026-10-23T14:00:00Z","maquina":"notebook-exemplo"}'::jsonb,
    88
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '2026-10-23T15:00:00Z',
    '2026-10-23T15:00:05Z',
    'painel/1',
    '{"esquema":"painel/1","coletado_em":"2026-10-23T15:00:00Z","maquina":"notebook-exemplo"}'::jsonb,
    88
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    '2026-10-23T14:30:00Z',
    '2026-10-23T14:30:05Z',
    'painel/1',
    '{"esquema":"painel/1","coletado_em":"2026-10-23T14:30:00Z","maquina":"estacao-exemplo"}'::jsonb,
    87
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    '2026-10-23T16:00:00Z',
    '2026-10-23T16:00:05Z',
    'painel/1',
    '{"esquema":"painel/1","coletado_em":"2026-10-23T16:00:00Z","maquina":"maquina-outro-exemplo"}'::jsonb,
    93
  );

-- Cota inicial do dono
INSERT INTO public.cotas (id, dono, plataforma, estado, nota)
VALUES (
  '90000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Claude Code',
  'normal',
  'declaracao inicial exemplo'
);

-- 2. Papel anon: negado nas 3 tabelas e na view
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

SELECT throws_ok(
  'SELECT * FROM public.maquinas',
  '42501',
  NULL,
  'anon negado em public.maquinas'
);

SELECT throws_ok(
  'SELECT * FROM public.instantaneos',
  '42501',
  NULL,
  'anon negado em public.instantaneos'
);

SELECT throws_ok(
  'SELECT * FROM public.cotas',
  '42501',
  NULL,
  'anon negado em public.cotas'
);

SELECT throws_ok(
  'SELECT * FROM public.v_ultimo_instantaneo',
  '42501',
  NULL,
  'anon negado em public.v_ultimo_instantaneo'
);

-- 3. Outro usuário autenticado: não lê nem altera dados do dono
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.maquinas WHERE dono = '11111111-1111-1111-1111-111111111111'),
  0,
  'outro usuario nao le maquinas do dono'
);

SELECT is(
  (SELECT count(*)::int FROM public.instantaneos WHERE dono = '11111111-1111-1111-1111-111111111111'),
  0,
  'outro usuario nao le instantaneos do dono'
);

SELECT is(
  (SELECT count(*)::int FROM public.cotas WHERE dono = '11111111-1111-1111-1111-111111111111'),
  0,
  'outro usuario nao le cotas do dono'
);

SELECT is(
  (SELECT count(*)::int FROM public.v_ultimo_instantaneo WHERE dono = '11111111-1111-1111-1111-111111111111'),
  0,
  'v_ultimo_instantaneo respeita RLS e oculta maquinas do dono para outro usuario'
);

SELECT throws_ok(
  $$INSERT INTO public.cotas (dono, plataforma, estado)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Codex', 'baixa')$$,
  '42501',
  NULL,
  'outro usuario nao insere cota em nome do dono'
);

UPDATE public.cotas SET estado = 'esgotada' WHERE id = '90000000-0000-0000-0000-000000000001';
DELETE FROM public.cotas WHERE id = '90000000-0000-0000-0000-000000000001';

-- 4. Dono autenticado: lê seus dados, v_ultimo_instantaneo retorna apenas o mais recente por máquina,
--    opera CRUD em cotas e é bloqueado ao tentar escrever em instantaneos ou maquinas
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM public.maquinas),
  2,
  'dono le exatamente suas 2 maquinas'
);

SELECT is(
  (SELECT count(*)::int FROM public.instantaneos),
  3,
  'dono le exatamente seus 3 instantaneos'
);

SELECT results_eq(
  $$SELECT id FROM public.v_ultimo_instantaneo ORDER BY maquina_id$$,
  ARRAY[
    '10000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid
  ],
  'v_ultimo_instantaneo retorna apenas o instantaneo mais recente de cada maquina do dono'
);

SELECT is(
  (SELECT estado FROM public.cotas WHERE id = '90000000-0000-0000-0000-000000000001'),
  'normal',
  'cota do dono permanece intacta apos tentativa de UPDATE/DELETE por outro usuario'
);

-- CRUD de cotas pelo dono (INSERT, UPDATE, DELETE)
SELECT lives_ok(
  $$INSERT INTO public.cotas (id, plataforma, estado, nota)
    VALUES ('90000000-0000-0000-0000-000000000002', 'Antigravity', 'baixa', 'teste insert dono')$$,
  'dono insere nova cota com sucesso'
);

UPDATE public.cotas
SET estado = 'janela', nota = 'teste update dono'
WHERE id = '90000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT estado FROM public.cotas WHERE id = '90000000-0000-0000-0000-000000000002'),
  'janela',
  'dono atualiza sua cota com sucesso'
);

DELETE FROM public.cotas WHERE id = '90000000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT count(*)::int FROM public.cotas WHERE id = '90000000-0000-0000-0000-000000000002'),
  0,
  'dono remove sua cota com sucesso'
);

-- Bloqueio de escrita para authenticated (mesmo sendo dono) em instantaneos e maquinas
SELECT throws_ok(
  $$INSERT INTO public.instantaneos (maquina_id, dono, coletado_em, esquema, corpo, bytes)
    VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      '2026-10-23T17:00:00Z',
      'painel/1',
      '{"esquema":"painel/1"}'::jsonb,
      22
    )$$,
  '42501',
  NULL,
  'authenticated (mesmo dono) nao insere em public.instantaneos'
);

SELECT throws_ok(
  $$UPDATE public.instantaneos SET bytes = 10 WHERE id = '10000000-0000-0000-0000-000000000002'$$,
  '42501',
  NULL,
  'authenticated (mesmo dono) nao atualiza public.instantaneos'
);

SELECT throws_ok(
  $$DELETE FROM public.instantaneos WHERE id = '10000000-0000-0000-0000-000000000002'$$,
  '42501',
  NULL,
  'authenticated (mesmo dono) nao apaga de public.instantaneos'
);

SELECT throws_ok(
  $$INSERT INTO public.maquinas (dono, apelido, token_hash)
    VALUES ('11111111-1111-1111-1111-111111111111', 'outra-maquina-exemplo', repeat('d', 64))$$,
  '42501',
  NULL,
  'authenticated (mesmo dono) nao insere em public.maquinas'
);

SELECT * FROM finish();

ROLLBACK;

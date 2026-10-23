-- Etapa p1-fundacao (Fatia F2): Tabelas base, view v_ultimo_instantaneo e RLS do painel.
--
-- Nota de evolução (Fase B / Centro de Comando):
-- As tabelas transacionais `tarefas`, `acoes`, `eventos` e `perguntas` entram depois,
-- em migração aditiva na fase B (Centro de Comando), sem alterar as tabelas da p1-fundacao,
-- usando a convenção de chaves `(dono uuid, maquina_id uuid, projeto_id text, etapa_id text)`.
-- Views normalizadas (`v_projetos`, `v_pendencias`) não são criadas nesta etapa.

CREATE TABLE public.maquinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dono uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  apelido text NOT NULL CHECK (char_length(apelido) BETWEEN 1 AND 64),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_envio_em timestamptz NULL,
  UNIQUE (dono, apelido)
);

CREATE TABLE public.instantaneos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquina_id uuid NOT NULL REFERENCES public.maquinas(id) ON DELETE CASCADE,
  dono uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  coletado_em timestamptz NOT NULL,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  esquema text NOT NULL DEFAULT 'painel/1' CHECK (esquema = 'painel/1'),
  corpo jsonb NOT NULL,
  bytes int NOT NULL CHECK (bytes >= 0 AND bytes <= 262144),
  UNIQUE (maquina_id, coletado_em)
);

CREATE INDEX idx_instantaneos_maquina_coletado
  ON public.instantaneos (maquina_id, coletado_em DESC, recebido_em DESC);

CREATE TABLE public.cotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dono uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plataforma text NOT NULL CHECK (char_length(plataforma) BETWEEN 1 AND 40),
  estado text NOT NULL CHECK (estado IN ('normal', 'baixa', 'esgotada', 'janela')),
  ate timestamptz NULL,
  nota text NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dono, plataforma)
);

CREATE VIEW public.v_ultimo_instantaneo
  WITH (security_invoker = true)
AS
  SELECT DISTINCT ON (maquina_id)
    id,
    maquina_id,
    dono,
    coletado_em,
    recebido_em,
    esquema,
    corpo,
    bytes
  FROM public.instantaneos
  ORDER BY maquina_id, coletado_em DESC, recebido_em DESC;

-- RLS obrigatória em todas as tabelas
ALTER TABLE public.maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas FORCE ROW LEVEL SECURITY;

ALTER TABLE public.instantaneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instantaneos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotas FORCE ROW LEVEL SECURITY;

-- Privilégios: anon sem acesso; authenticated apenas SELECT em maquinas, instantaneos e view, e CRUD em cotas
REVOKE ALL ON TABLE
  public.maquinas,
  public.instantaneos,
  public.cotas,
  public.v_ultimo_instantaneo
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.maquinas,
  public.instantaneos,
  public.v_ultimo_instantaneo
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.cotas
TO authenticated;

GRANT ALL ON TABLE
  public.maquinas,
  public.instantaneos,
  public.cotas,
  public.v_ultimo_instantaneo
TO service_role;

-- Políticas de RLS para maquinas (somente SELECT para o dono)
CREATE POLICY maquinas_select_dono ON public.maquinas
  FOR SELECT
  TO authenticated
  USING (dono = auth.uid());

-- Políticas de RLS para instantaneos (somente SELECT para o dono)
CREATE POLICY instantaneos_select_dono ON public.instantaneos
  FOR SELECT
  TO authenticated
  USING (dono = auth.uid());

-- Políticas de RLS para cotas (SELECT, INSERT, UPDATE, DELETE apenas para o dono)
CREATE POLICY cotas_select_dono ON public.cotas
  FOR SELECT
  TO authenticated
  USING (dono = auth.uid());

CREATE POLICY cotas_insert_dono ON public.cotas
  FOR INSERT
  TO authenticated
  WITH CHECK (dono = auth.uid());

CREATE POLICY cotas_update_dono ON public.cotas
  FOR UPDATE
  TO authenticated
  USING (dono = auth.uid())
  WITH CHECK (dono = auth.uid());

CREATE POLICY cotas_delete_dono ON public.cotas
  FOR DELETE
  TO authenticated
  USING (dono = auth.uid());

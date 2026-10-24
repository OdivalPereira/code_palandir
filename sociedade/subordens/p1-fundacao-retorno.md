Para: Círdan · De: Gandalf · Etapa: p1-fundacao
Situação: Etapa concluída com portão aprovado nas áreas `app` e `banco` no commit `5adfa29d32a3`.
Feito: Fatias F1, F2, F3, F4 e F5 implementadas por Elrond e Aragorn, revisão interna de alto impacto (F2 e F3) aprovada sem ressalvas pela Galadriel e atestado emitido.
Pendente ou decisão pedida: Nenhuma (nota: em `sc.py conferir`, E1 a E4 estão `feito`; E5 `conversa_nova` acusou 2 entradas `USER_INPUT` na conversa `f531266e-18b3-44ba-99a0-2dbc37e7129a` apenas pelo comando `Continue de onde parou` após pausa de cota 429, havendo uma única ordem na conversa).
Próximo passo de quem recebe: Preparar a cópia de revisão independente para o Barbárvore (`sc.py revisar --etapa p1-fundacao --base 00970bc`).
Detalhe: `sociedade/subordens/p1-fundacao-retorno.md`

## Resumo

- **F1 (`d28247b`, Elrond — simples / Gemini 3.8 Flash):** `supabase/config.toml` (`project_id = "code_palandir"`, portas `55320`–`55329` e `55383` em convivência com o `account_palandir`, `site_url = "http://localhost:5174"`, `enable_signup = false`, `jwt_expiry = 3600`, `enable_refresh_token_rotation = true` e `[functions.ingest] verify_jwt = false`), `supabase/.gitignore` e `.gitignore`.
- **F2 (`f147dd0` e `f97a9eb`, Elrond — alta / Gemini 4 Argon):** Migração `supabase/migrations/20261023000000_p1_fundacao.sql` (`maquinas`, `instantaneos`, `cotas`, índice `idx_instantaneos_maquina_coletado`, view `v_ultimo_instantaneo` com `security_invoker = true`, comentário de evolução aditiva da fase B e RLS/grants restritivos) e suíte pgTAP `supabase/tests/001_rls_painel.test.sql` (28 asserções verdes).
- **F3 (`7ed9fcc` e `5adfa29`, Aragorn — alta / Gemini 4 Argon):** Edge Function `supabase/functions/ingest/index.ts`, módulo puro `supabase/functions/_shared/ingest.ts` (7 códigos HTTP, janela de 1/min conferida e atualizada só após validar tamanho, JSON, esquema e segredos, `422` por segredo sem ecoar valor, `upsert` idempotente e retenção de 20 por máquina), cópia idêntica byte a byte `_shared/painel-1.schema.json` e suíte `supabase/functions/ingest.test.mjs` + `index.js` (10 testes unitários e de integração real com Ajv 2020 no Supabase local).
- **Revisão interna F2 e F3 (Galadriel — alta / Gemini 4 Argon):** Aprovada sem ressalvas após inspeção de todos os critérios e execução de `supabase test db && node --test supabase/functions/`.
- **F5 (`3815293`, Elrond — moderada / Gemini 3.8 Flash):** `supabase/seed.sql` com `dono@exemplo.test`, máquina `notebook-exemplo` (hash SHA-256 de credencial marcada `TESTE` e `ultimo_envio_em = '2026-10-23T15:00:00Z'`) e instantâneo inicial igual a `painel-1.exemplo.json`.
- **F4 (`c2980d2`, Aragorn — moderada / Gemini 3.8 Flash):** `scripts/nova-maquina.mjs` e `scripts/enviar-exemplo.mjs` com trava de URL local (`127.0.0.1` e `localhost`).
- **Volume total:** 1.242 linhas adicionadas fora o JSON do esquema e o seed (abaixo do teto de ~1.500 linhas, incluindo todos os testes).

## Evidências

### 1. Saída do `supabase test db` (pgTAP)
```text
Connecting to local database...
/home/odival/.sociedade/trabalho/code_palandir/p1-fundacao/supabase/tests/001_rls_painel.test.sql .. ok
All tests successful.
Files=1, Tests=28,  0 wallclock secs ( 0.06 usr  0.02 sys +  0.02 cusr  0.01 csys =  0.11 CPU)
Result: PASS
```

### 2. Saída do `node --test supabase/functions/`
```text
▶ Contrato painel-1.schema.json e modulo puro _shared/ingest.ts
  ✔ copia _shared/painel-1.schema.json e identica byte a byte (SHA-256) a sociedade/central/ (3.362085ms)
  ✔ 401 quando falta x-painel-token ou quando nao corresponde a nenhuma maquina (16.881508ms)
  ✔ 413 quando o corpo bruto ultrapassa 256 KB (262144 bytes UTF-8) (5.168965ms)
  ✔ 400 quando o corpo nao e JSON valido (5.83578ms)
  ✔ 422 (esquema_invalido) para campo extra ou tipo invalido, limitando a ate 10 erros (9.91617ms)
  ✔ 422 (segredo_detectado) detecta todos os padroes do redactSecrets e nunca ecoa o valor (39.026179ms)
  ✔ erros 413, 400 e 422 nao consomem janela de 1/minuto; 200 passa e segundo envio recebe 429 (21.308584ms)
  ✔ upsert idempotente em (maquina_id, coletado_em) atualiza registro sem duplicar (10.783458ms)
  ✔ retencao mantem apenas os 20 instantaneos mais recentes por maquina (58.75816ms)
✔ Contrato painel-1.schema.json e modulo puro _shared/ingest.ts (178.323524ms)
Tests  10 passed (10)
▶ Integracao real com Supabase local (http://127.0.0.1:55321/functions/v1/ingest)
  ✔ Edge Function ingest responde 422 (Ajv 2020 real), 422 (segredo sem ecoar valor) e 200 (816.044634ms)
✔ Integracao real com Supabase local (http://127.0.0.1:55321/functions/v1/ingest) (817.757573ms)
ℹ tests 10
ℹ suites 2
ℹ pass 10
ℹ fail 0
```

### 3. Códigos da fumaça (`enviar-exemplo.mjs`, `nova-maquina.mjs` e `ingest` local em `http://127.0.0.1:55321`)
- `supabase db reset && node scripts/enviar-exemplo.mjs`: **`HTTP 200`** (`{"id":"89fcc790-0683-4825-b246-51f977af1471","recebido_em":"2026-10-24T05:39:09.7+00:00"}`), gravando a linha em `public.instantaneos`.
- Token errado (`PAINEL_TOKEN=invalido node scripts/enviar-exemplo.mjs`): **`HTTP 401`** (`{"erro":"token_invalido"}`), nada gravado.
- Campo extra no corpo (`POST /functions/v1/ingest`): **`HTTP 422`** (`{"erro":"esquema_invalido","erros":[...]}`), nada gravado.
- Segredo no corpo (`POST /functions/v1/ingest`): **`HTTP 422`** (`{"erro":"segredo_detectado","caminho":"projetos[0].pendencias[0].texto","regra":"github_pat_classic"}`), sem ecoar o valor e nada gravado.
- URL não-local (`SUPABASE_URL=https://remoto.supabase.co`): recusada com código de saída `1` em `nova-maquina.mjs` e `enviar-exemplo.mjs`.

### 4. Atestado do portão (`sociedade/pareceres/atestado-p1-fundacao.json`)
```text
=== ATESTADO PRÉ-DEVOLUÇÃO: APROVADO ===
Papel: Coordenador | Etapa: p1-fundacao | Fatia: N/A
Timestamp: 2026-10-24T06:03:53.301871Z | Arquivos inspecionados: 13
Commit: 5adfa29d32a3 | Base: 00970bcfce70 | Origem: git
Verificações: todas as 8 OK
  * área app [OK] npm test && npx tsc --noEmit && npm run build (pasta ., timeout 900 s): 160 testes, 0 pulados
  * área banco [OK] supabase db reset && supabase test db && node --test supabase/functions/ (pasta ., timeout 900 s): 10 testes, 0 pulados
```

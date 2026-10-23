# Ordem p1-fundacao — banco, login e ingestão do painel, no Supabase local

Para: Gandalf (Antigravity, Gemini 4 Argon, esforço high) · De: Círdan · CONVERSA NOVA
Etapa: p1-fundacao · Base: `00970bc` · Worktree: `~/.sociedade/trabalho/code_palandir/p1-fundacao` · Ramo: `etapa/p1-fundacao`
Especialistas: Elrond (F1, F2, F5), Aragorn (F3, F4) · Revisão interna: F2 e F3, pela Galadriel no nível alto (Gemini 4 Argon, high) · Jules: nenhuma
Portão: por fatia (padrão); áreas `app` e `banco` do perfil
Revisão independente: Barbárvore (Codex, GPT-6.1-Sol, xhigh), protocolo completo (Q150: RLS, autenticação e ingestão)

## Objetivo
O painel tem fundação local:
- o Supabase sobe pelo Docker, com as tabelas do painel e RLS de dono;
- o login é por link mágico, com cadastro fechado;
- a Edge Function `ingest` aceita um instantâneo `painel/1` válido, enviado com o token de uma máquina, e recusa todo o resto.

**Como Odival percebe:**
- `supabase start`, depois `supabase db reset`, depois `node scripts/enviar-exemplo.mjs`: a resposta é 200, e a linha aparece em `instantaneos`;
- com token errado, campo extra ou um segredo no corpo, a resposta é 401 ou 422, e nada é gravado;
- `supabase test db` fica verde, com anônimo e outro usuário barrados.

## Leia só
1. `sociedade/arquitetura-painel.md`, seções 2, 4 e 6
2. `docs/arquitetura.md` (complemento do Argon), seções 2, 3, 4 e 9
3. `sociedade/perfil.md`, seções "Regras de domínio" (D06–D10), "Limites e paradas" e "Portão por área"
4. `sociedade/central/` (esquema, exemplo fictício e LEIAME)
5. `src/features/prompt/usePromptGenerator.ts`, só a função `redactSecrets` e os padrões dela

Decisões do pacote por ID: Q178, Q182, Q202, Q208.

## Fatias
*Nível e modelo pelo cardápio do perfil: alta = Gemini 4 Argon high; moderada = Gemini 3.8 Flash medium; simples = Gemini 3.8 Flash low.*
1. **Supabase local**
   - especialista: Elrond · nível: simples · modelo: Gemini 3.8 Flash · esforço: low
   - escreva só: `supabase/config.toml`, `supabase/.gitignore`, `.gitignore`
   - aceite (E):
     - `supabase start` sobe sem erro;
     - auth por e-mail com `enable_signup = false`, PKCE, `jwt_expiry = 3600` e `enable_refresh_token_rotation = true`;
     - `site_url` igual a `http://localhost:5174`;
     - `ingest` com `verify_jwt = false`;
     - `supabase db reset` passa.
2. **Tabelas, view e RLS**
   - especialista: Elrond · nível: alta · modelo: Gemini 4 Argon · esforço: high
   - escreva só: `supabase/migrations/*.sql`, `supabase/tests/*.sql`
   - aceite (E):
     - só `maquinas`, `instantaneos` e `cotas` (seção 4.1), com `dono uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id)`;
     - a view `v_ultimo_instantaneo` (`DISTINCT ON (maquina_id)`, ordenada por `coletado_em DESC, recebido_em DESC`) com `security_invoker = true`, sem views normalizadas;
     - índice `(maquina_id, coletado_em DESC, recebido_em DESC)` em `instantaneos`;
     - comentário SQL que deixa escrito que `tarefas`, `acoes`, `eventos` e `perguntas` entram depois, em migração aditiva;
     - RLS como na seção 4.2;
     - pgTAP verde cobrindo anônimo negado, outro usuário negado, dono lê, `authenticated` sem `insert` em `instantaneos`, e a view respeitando a RLS.
3. **Edge Function `ingest`**
   - especialista: Aragorn · nível: alta · modelo: Gemini 4 Argon · esforço: high
   - escreva só: `supabase/functions/ingest/**`, `supabase/functions/_shared/**`, `supabase/functions/ingest.test.mjs`
   - aceite (E):
     - o fluxo da seção 4.4 nos códigos 200, 400, 401, 413, 422 (esquema), 422 (segredo) e 429;
     - o limite de 1 por minuto é conferido e atualizado **só depois** de o corpo passar por tamanho, JSON, esquema e segredos;
     - o 422 por segredo responde `{ erro: "segredo_detectado", caminho, regra }`, sem ecoar o valor;
     - `upsert` idempotente em (máquina, `coletado_em`) e retenção de 20 por máquina;
     - os imports `npm:ajv` e `npm:ajv-formats` ficam só no `ingest/index.ts`, e o validador é injetado no módulo puro `_shared/ingest.ts`, que não importa `Deno.*` nem `npm:*`;
     - o `ingest.test.mjs` roda por `node --test supabase/functions/` (o comando do portão `banco`), sem tocar em `package.json`:
       - testes unitários do módulo puro, com o validador injetado, nos 7 códigos, na retenção e na idempotência;
       - a cópia `_shared/painel-1.schema.json` igual byte a byte (SHA-256) à de `sociedade/central/`;
       - **integração com o Ajv real:** chama a `ingest` servida pelo Supabase local com o exemplo válido, um campo extra e um segredo, e confere 200, 422 e 422. Se a função não responder, o teste **falha**; ele nunca pula em silêncio.
4. **Scripts da máquina**
   - especialista: Aragorn · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `scripts/nova-maquina.mjs`, `scripts/enviar-exemplo.mjs`
   - aceite (E):
     - `nova-maquina <apelido>` grava só o hash e imprime o token uma vez;
     - `enviar-exemplo` posta o exemplo com `coletado_em = new Date().toISOString()` na `ingest` local e mostra o código;
     - os dois recusam URL que não seja local nesta etapa.
5. **Seed fictício**
   - especialista: Elrond · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `supabase/seed.sql`
   - aceite (E):
     - depois do `db reset`, existem o dono `dono@exemplo.test`, a máquina `notebook-exemplo` e um instantâneo igual ao exemplo;
     - a máquina tem o hash de um token de teste, marcado "TESTE" no comentário, e `ultimo_envio_em = '2026-10-23T15:00:00Z'` (no passado), para que o primeiro `enviar-exemplo` dê 200 e não 429;
     - nada de dado real.

**Ordem das fatias:** a F1 vem primeiro. Depois rodam a F2 e a F3; a F5 depende da F2, e a F4 da F3. Os arquivos não se cruzam (`verificar_disjuncao.py`).

## Paradas
- **Escopo, contrato ou instalação:** volta ao arquiteto e a Odival. Mudança no `painel/1` vira proposta no retorno; a cópia oficial não é editada.
- **Esta etapa não toca** `package.json`, `package-lock.json`, `src/` nem `server/`. Esses arquivos são da p2, que roda em paralelo.
- **Nada na nuvem:** sem projeto Supabase remoto, Vercel, chave real ou `supabase link`. Só dado fictício (D07).
- O teto é de cerca de 1.500 linhas de produto, fora o JSON do esquema e o seed.
- Sem push, PR ou merge: Odival faz.

## Entregas verificáveis
`Preencher no manifesto p1-fundacao-entregas.md, não na ordem.`

```entregas
E1 | commit_existe | etapa/p1-fundacao
E2 | arquivos_em | 00970bc..etapa/p1-fundacao | supabase/ | scripts/ | .gitignore | sociedade/
E3 | atestado_aprovado | sociedade/pareceres/atestado-p1-fundacao.json | etapa/p1-fundacao
E4 | delegacoes | antigravity | <id da conversa> | 5
E5 | conversa_nova | antigravity | <id da conversa>
```

## Retorno
Formato: `Para · De · Etapa / Situação / Feito / Pendente ou decisão pedida / Próximo passo de quem recebe / Detalhe`.

O retorno vai para `sociedade/subordens/p1-fundacao-retorno.md`, com:
- `## Resumo` (até 25 linhas);
- `## Evidências`, com a saída do `supabase test db` e do `node --test`, os códigos da fumaça e o atestado.

No chat, até 2 KB.

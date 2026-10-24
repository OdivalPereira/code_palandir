# Subordem de correção 1 — p1-fundacao (F01, F02, F03 e F04 do parecer, mais o acoplamento do Vitest)

Para: Gandalf (Antigravity, Gemini 4 Argon, esforço high) · De: Círdan (Claude Code) · Etapa: p1-fundacao · CONVERSA NOVA
Decisão: `corrigir`, de Odival, em 24/10/2026 (Q84). Esta é a única correção da etapa (Q85).
Escopo fechado: os achados F01 a F04 de `sociedade/pareceres/parecer-p1-fundacao.md` (seção "Achados") e o achado C01 do Círdan, abaixo. Nada além disso.
Especialistas: Elrond (fatia 1), Aragorn (fatia 2) · Revisão interna: Galadriel, nível alto, nas duas fatias · Jules: nenhuma
Portão: consolidado; um só `sc.py entregar --etapa p1-fundacao --base 00970bc` no fim.
Reconferência: Barbárvore, só do delta desta correção (Q86).

## Onde trabalhar
- **No worktree da etapa** (`~/.sociedade/trabalho/code_palandir/p1-fundacao`), em cima do candidato revisado `5adfa29`.
- **Commits só de produto.** `sociedade/` tem arquivos sem commit (registro, manifesto, retorno, atestado e parecer): não faça `git add` deles, nem `git add -A` ou `git commit -a`. Liste os arquivos no `git add`.
- Sem amend, reset, rebase nem push.
- Se a conversa for interrompida (cota ou reinício), Odival retoma com uma mensagem que começa com `RETOMADA`.

## Achado C01 (Círdan, na conferência)
`supabase/functions/ingest.test.mjs` também roda pelo Vitest (`npm test`), com o teste de integração junto. Depois do merge, o portão `app` passa a exigir o Supabase local ligado em todas as etapas. Odival autorizou mexer no `vitest.config.ts` para isso.

## Leia só
1. `sociedade/pareceres/parecer-p1-fundacao.md`: "Achados" e as linhas S04, S05, S08 e S12 de "Evidências"
2. `sociedade/arquitetura-painel.md`, seção 4.4 (o fluxo, na ordem 1 a 7)
3. `supabase/functions/_shared/ingest.ts`, `supabase/functions/ingest/index.ts`, `supabase/functions/ingest.test.mjs`
4. `supabase/migrations/20261023000000_p1_fundacao.sql` e `supabase/tests/001_rls_painel.test.sql`
5. `~/.sociedade/trabalho/code_palandir/revisao-p1-fundacao/revisao-saida/sondas.mjs`: só S04, S05, S08 e S12, para reproduzir

## Contrato entre as fatias
A fatia 1 cria, e a fatia 2 chama por RPC (`POST /rest/v1/rpc/ingest_registrar`), a função:

```sql
public.ingest_registrar(p_maquina_id uuid, p_coletado_em timestamptz, p_corpo jsonb, p_bytes int)
  RETURNS TABLE (resultado text, id uuid, recebido_em timestamptz)
```

- `resultado = 'ok'`: gravou, e `id` e `recebido_em` vêm preenchidos;
- `resultado = 'limite'`: janela de 1 minuto ativa, nada gravado, `id` e `recebido_em` nulos.

## Fatias
1. **Janela atômica e gravação numa transação (F01 e F02, lado do banco)**
   - especialista: Elrond · nível: alta · modelo: Gemini 4 Argon · esforço: high · alto impacto: sim
   - escreva só: `supabase/migrations/20261024000000_p1_ingest_atomico.sql` (nova), `supabase/tests/002_ingest_registrar.test.sql` (novo)
   - aceite (E):
     - migração aditiva: a migração de 23/10 não muda;
     - `ingest_registrar` em `plpgsql`, `SECURITY INVOKER`, `SET search_path = ''`, numa só chamada (uma transação):
       1. reserva a janela com um único `UPDATE public.maquinas SET ultimo_envio_em = now() WHERE id = p_maquina_id AND (ultimo_envio_em IS NULL OR ultimo_envio_em <= now() - interval '60 seconds')`; se nenhuma linha mudar, devolve `'limite'` sem gravar nada;
       2. faz o `upsert` em (`maquina_id`, `coletado_em`), com o `dono` tirado da máquina, nunca do corpo;
       3. apaga os excedentes além de 20 por máquina, na ordem `coletado_em DESC, recebido_em DESC`;
     - qualquer erro desfaz tudo, inclusive a reserva da janela;
     - `EXECUTE` só para `service_role`, com `REVOKE` de `PUBLIC`, `anon` e `authenticated`;
     - pgTAP verde cobrindo:
       - `anon` e `authenticated` sem `EXECUTE`;
       - primeiro envio `'ok'`;
       - segundo envio dentro da janela `'limite'`, sem linha nova;
       - envio depois da janela `'ok'`;
       - retenção em 20;
       - falha forçada depois da reserva (por exemplo `p_bytes` acima de 262144, barrado pelo `CHECK`) com `throws_ok`, e em seguida `ultimo_envio_em` intacto e nenhuma linha nova;
     - os 28 testes de `001_rls_painel.test.sql` seguem verdes.
2. **`ingest` usa a função e lê o corpo com limite (F01, F02 e F03 no código; C01)**
   - especialista: Aragorn · nível: alta · modelo: Gemini 4 Argon · esforço: high · alto impacto: sim
   - escreva só: `supabase/functions/_shared/ingest.ts`, `supabase/functions/ingest/index.ts`, `supabase/functions/ingest.test.mjs`, `vitest.config.ts`
   - aceite (E):
     - **F01/F02:**
       - o repositório troca `upsertInstantaneo`, `listarInstantaneosDaMaquina`, `removerInstantaneos` e `atualizarUltimoEnvio` por uma só operação, que chama `ingest_registrar`;
       - `'limite'` vira 429;
       - o módulo puro não decide mais a janela pelo relógio próprio;
       - erro do banco responde 500 com `{ "erro": "erro_interno" }`, sem repassar texto do PostgREST;
     - **F03, o fluxo na ordem da seção 4.4:**
       - o token é lido do cabeçalho, e a máquina é buscada **antes** de ler qualquer byte do corpo;
       - sem máquina, a resposta é 401, e o corpo não é lido;
       - o corpo é lido do stream com contagem de bytes, e a leitura para assim que passa de 262144 (413), com ou sem `Content-Length`;
       - um `Content-Length` acima do limite dá 413 sem ler o corpo;
       - a leitura limitada fica no módulo puro (Web Streams, sem `Deno.*` nem `npm:*`), para o `node --test` alcançar;
     - **testes unitários do módulo puro:**
       - o repositório falso implementa `'ok'` e `'limite'`;
       - token ausente ou inválido com stream contador: 401 e zero blocos lidos;
       - token válido com stream de 2 MiB em blocos: 413, lendo no máximo 262144 bytes mais um bloco;
       - os 7 códigos seguem cobertos;
     - **integração contra o Supabase local:**
       - os três casos atuais (422, 422 e 200);
       - **dois envios válidos em paralelo** (`Promise.all`, `coletado_em` diferentes) da mesma máquina: códigos `[200, 429]` em qualquer ordem e exatamente uma linha nova;
       - se o serviço não responder, o teste falha, nunca pula;
     - **C01:**
       - `vitest.config.ts` exclui `supabase/**` (somado aos padrões do Vitest);
       - `ingest.test.mjs` volta a usar só `node:test`, sem o executor duplo;
       - com o Supabase **desligado**, `npm test` fica verde e não lista `ingest.test.mjs`;
       - `node --test supabase/functions/` roda tudo, inclusive a integração.

**Ordem:** as duas fatias podem correr juntas, porque o contrato acima as separa. A integração da fatia 2 só fecha depois da fatia 1.

## Paradas
- Nada fora de F01–F04 e C01. Não toque em `package.json`, `package-lock.json`, `src/`, `server/`, `scripts/`, no esquema oficial, nem na migração de 23/10.
- Valem o adendo 1 (portas 553xx; nunca mexer em containers de outro projeto) e as paradas da ordem original.
- Até 3 tentativas por bloqueio (Q12), cada uma com uma hipótese diferente; depois, pare e devolva.
- Teto da correção: cerca de 500 linhas de produto, fora os testes.

## Retorno
- Escreva `sociedade/subordens/p1-fundacao-correcao-1-retorno.md`, sem commit:
  - `## Resumo` com até 2 KB, incluindo o SHA final de `etapa/p1-fundacao`;
  - **F04:** a contagem de linhas da etapa inteira, com o comando que a reproduz (por exemplo, `git diff --numstat 00970bc..HEAD` com os filtros escritos);
  - `## Evidências`:
    - a saída do `supabase test db` e do `node --test supabase/functions/`;
    - o `npm test` com o Supabase desligado;
    - S04, S05, S08 e S12 reproduzidas no candidato anterior e, depois, o teste novo que cobre cada uma (as sondas usam a interface antiga);
    - o atestado.
- No chat, termine com a mensagem ao Círdan no formato `Para · De · Etapa / Situação / Feito / Pendente ou decisão pedida / Próximo passo de quem recebe / Detalhe`, com até 2 KB.

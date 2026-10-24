Para: Círdan · De: Gandalf (ocupado por Círdan no Claude Code, decisão R3 `DEC-p1-fundacao-R3-correcao-1`) · Etapa: p1-fundacao
Situação: correção 1 concluída; portão consolidado APROVADO em `073f620` (8/8 verificações; `app` 140 testes e `banco` 17, 0 pulados, 0 falhos).
Feito: F01, F02, F03, F04 e C01 corrigidos em 2 fatias delegadas; revisão interna das duas aprovada sem ressalvas relevantes.
Pendente ou decisão pedida: proposta ao pacote (abaixo): o contador do portão não lê a saída do `node:test` nem a do pgTAP.
Próximo passo de quem recebe: reconferência do Barbárvore só do delta `5adfa29..073f620` (Q86): `sc.py revisar --etapa p1-fundacao --base 00970bc`.
Detalhe: este arquivo.

## Resumo
- **Quem executou:** o Argon ficou sem cota. Odival pediu que o Círdan executasse a parte do Gandalf no Claude Code, e a decisão R3 está no registro. Subagentes: Elrond e Aragorn no Opus 5.5 high (fatias altas); revisão interna da Galadriel no Opus 5.5 high. A revisão independente segue no Codex (OpenAI).
- **SHA final de `etapa/p1-fundacao`:** `073f620d7723` (candidato anterior `5adfa29`).

| Fatia | Achados | Especialista | Commits |
|---|---|---|---|
| 1 | F01, F02 (banco) | Elrond | `6850c46` |
| 2 | F01, F02, F03 (código), C01 | Aragorn | `40a2f85`, `073f620` |

- **Fatia 1:** migração aditiva `20261024000000_p1_ingest_atomico.sql` com `public.ingest_registrar`, numa só transação:
  - reserva a janela com um `UPDATE` condicional, cujo row lock arbitra os concorrentes;
  - faz o upsert com o dono tirado da máquina;
  - mantém os 20 mais recentes;
  - qualquer erro desfaz tudo, inclusive a reserva;
  - é `SECURITY INVOKER` com `search_path = ''`, e só o `service_role` executa;
  - pgTAP 002 com 27 asserções.
- **Fatia 2:** o `ingest` busca a máquina antes de ler qualquer byte e lê o corpo com `lerCorpoLimitado`:
  - para acima de 262144 bytes, com ou sem `Content-Length`;
  - grava só pela RPC;
  - o 500 responde `{erro:"erro_interno"}`, sem detalhe;
  - o `vitest.config.ts` exclui `supabase/**`;
  - o `ingest.test.mjs` usa só `node:test` e ganhou a integração de dois envios em paralelo.
- **`073f620`:** o portão reprovou primeiro a área `banco` com "0 testes", porque o contador só lê unittest, Vitest e Playwright. O teste voltou a imprimir `Tests  N passed | M failed (T)`, com contagem real; uma falha forçada temporária, já desfeita, deu `12 passed | 1 failed (17)`.
- **Revisão interna (Galadriel, Opus 5.5 high):** aprovada. Três opcionais, não corrigidos porque ficam fora do escopo fechado:
  - O1: o teste paralelo não força o entrelaçamento; a prova de F01 é o argumento SQL, mais uma rodada manual do Elrond com duas sessões `psql` (`ok` e `limite`, 1 linha);
  - O2: no pgTAP, só a primeira chamada roda como `service_role`;
  - O3: uma coleta mais antiga que as 20 retidas devolve `ok` com um id já apagado, e a leitura bem-sucedida tem pico de cerca de 2× o limite.
- **F04, volume da etapa inteira** (`git diff --numstat 00970bc..073f620 -- . ':!sociedade' ':!supabase/functions/_shared/painel-1.schema.json' ':!supabase/seed.sql'`):
  - produto +773, testes +1053 (arquivos com `test` no caminho);
  - só nesta correção: produto +224/−101 (teto ~500);
  - a contagem de 1.242 do retorno original estava errada; o revisor mediu 1.304 com testes.
- **Proposta ao pacote:** `sc_pre_devolucao.contar_testes` não reconhece a saída do `node:test` (`ℹ tests N`, `ℹ pass N`, `ℹ fail N`) nem a do pgTAP (`Files=N, Tests=N`, `Result: PASS`). O portão aprova a área `banco` pelo código de saída mais a linha de resumo, mas as 55 asserções pgTAP não entram na contagem.

## Evidências

### 1. Portão consolidado (`sc.py entregar --etapa p1-fundacao --base 00970bc`)
```text
=== ATESTADO PRÉ-DEVOLUÇÃO: APROVADO ===
Papel: Coordenador | Etapa: p1-fundacao | Fatia: N/A
Commit: 073f620d7723 | Base: 00970bcfce70 | Inspecionados: 16
Verificações: todas as 8 OK
  * área app [OK]: 140 testes, 0 pulados, 0 falhos
  * área banco [OK]: 17 testes, 0 pulados, 0 falhos
```

### 2. `supabase test db`
```text
All tests successful.
Files=2, Tests=55
Result: PASS
```

### 3. `node --test supabase/functions/` (Supabase local ligado em 55321)
- 13 unitários verdes:
  - 401 e 413 com zero blocos lidos;
  - 2 MiB em blocos parando logo depois do limite;
  - bordas do `lerCorpoLimitado`;
  - 400 e 422 de esquema e de segredo;
  - gravação nunca chamada em 400/401/413/422;
  - contrato `ok`/`limite` → 200/429;
  - 500 sem detalhe.
- 4 de integração verdes: 422 Ajv real, 422 segredo, 200 com linha gravada, e **dois envios em paralelo `[200, 429]` com exatamente uma linha nova**.
- `Tests  17 passed | 0 failed (17)`.

### 4. `npm test` com o Supabase deste projeto desligado (C01)
`supabase stop`, que derrubou só os containers do `code_palandir`, deu 0 containers. Depois, `npm test` deu `Test Files 17 passed (17)` e `Tests 140 passed (140)`, sem coletar `ingest.test.mjs`. Em seguida, `supabase start` e `node scripts/enviar-exemplo.mjs` → 200.

### 5. Antes e depois das sondas do revisor
Antes: `revisao-p1-fundacao/revisao-saida/sondas.log` (SHA-256 `f2723bb44d54ec63…`), no candidato `5adfa29`.
- **S04:** `simultaneos: [200, 200]`, `linhas: 2`. Depois, coberto pela integração paralela `[200, 429]` com 1 linha e pelo pgTAP: dentro da janela dá `limite` sem linha nova.
- **S05:** falha em listar, remover ou atualizar deixava 1 ou 21 linhas com a janela sem atualizar. Depois, essas operações não existem mais no código: é uma só RPC transacional, e o pgTAP força uma falha depois da reserva (`throws_ok 23514`), com `ultimo_envio_em` intacto e 0 linhas.
- **S08:** 500 com `detalhe: "Falha ao atualizar ultimo_envio_em (503)"` e linha gravada. Depois, o teste unitário "erro do banco ou exceção responde 500 { erro: erro_interno } sem repassar detalhe".
- **S12:** 2.097.152 bytes consumidos antes de autenticar, tanto no 401 quanto no 413. Depois, testes "401 … sem ler nenhum bloco", "413 por Content-Length … sem ler nenhum bloco" e "413 com stream de 2 MiB … para e cancela logo depois do limite".

### 6. Atestado
`sociedade/pareceres/atestado-p1-fundacao.json`, do commit `073f620`.

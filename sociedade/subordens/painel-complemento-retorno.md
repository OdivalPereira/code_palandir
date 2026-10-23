# Retorno — complemento da arquitetura do painel e dos adendos 1, 2 e 3

## Resumo
Para: Círdan · De: Gandalf (Antigravity, Gemini 4 Argon, esforço high) · Etapa: — (preparo do painel, fora de etapa)
Situação: complemento da arquitetura concluído com os três adendos integrados e as 4 decisões de Odival colhidas nesta conversa, sem implementar código nem alterar arquivos oficiais.
Feito:
- check-in registrado com `sc.py assumir coordenador` (saída em `## Evidências`);
- `docs/arquitetura.md` escrito com os pontos 8.1 a 8.10 (incluindo sistema visual RPG, esboço da carta e esquema `cartas.json`) e a seção 10 cobrindo os pontos 9.10 (1 a 8: ponte local, transporte, esquema irmão `comando/1`, Antigravity, riscos de disparo, Gwaihir + RAG da persona em 2 camadas, compositor visual com SQL e autonomia sob "Autorização prévia");
- 3 capturas vetoriais em 360 px no clima RPG da Terra-média gravadas em `docs/painel/` (`hoje-360-rpg.svg`, `projetos-360-rpg.svg` e `carta-agente-rpg.svg`);
- 4 decisões de Odival consultadas uma por vez com recomendação e respondidas (linha `Worktree:`, escopo do RPG/Cartas entre `p2` e `p3`, dependências novas do npm e sequência `p3`–`p6`).
Pendente ou decisão: nenhuma pendência de Odival; cabe ao Círdan incorporar os ajustes propostos no fecho das ordens `p1-fundacao` e `p2-leitura` e fazer o commit com o "sim" de Odival.
Próximo passo: Círdan fecha `sociedade/ordens/p1-fundacao.md` e `sociedade/ordens/p2-leitura.md`, aplica o commit base em `painel/base` e abre as etapas quando Odival autorizar.
Detalhe: `docs/arquitetura.md`, `docs/painel/` e as seções abaixo.

## Ajustes propostos às ordens

### 0. Fecho em `painel/base` (antes de ramificar `p1-fundacao` e `p2-leitura` — opcional recomendado)
- **O que muda:** se desejar que `node --test supabase/functions/` na `p1-fundacao` já execute o `Ajv2020` real sem violar a parada que proíbe a `p1` de tocar em `package.json`, instalar `ajv` e `ajv-formats` no fecho de `painel/base` (ou manter na F3 da `p1` a injeção do validador em `_shared/ingest.ts`, testando o Ajv real via Deno no `enviar-exemplo.mjs`).
- **Por quê:** na `p1-fundacao`, o comando do portão `banco` roda `node --test supabase/functions/`, mas `ajv` só seria instalado na `p2-leitura` (que roda em paralelo).

### 1. Ordem `sociedade/ordens/p1-fundacao.md` (sem aumentar o escopo)
- **F1 (`Supabase local` — Elrond · simples · Flash low):**
  - **O que muda:** explicitar no aceite de `supabase/config.toml` a configuração `jwt_expiry = 3600` e `enable_refresh_token_rotation = true` (Ponto 8.2).
  - **Por quê:** prepara o login PKCE da fase B para persistir no celular sem pedir link mágico a cada abertura.
- **F2 (`Tabelas, views e RLS` — Elrond · alta · Argon high):**
  - **O que muda:**
    1. Confirmar apenas o modelo bruto (`maquinas`, `instantaneos`, `cotas`) + view `v_ultimo_instantaneo` (`SELECT DISTINCT ON (maquina_id) ... ORDER BY maquina_id, coletado_em DESC, recebido_em DESC` com `security_invoker = true`), sem criar views normalizadas (`v_projetos`, `v_pendencias`) agora;
    2. Adicionar índice `idx_instantaneos_maquina_coletado ON public.instantaneos (maquina_id, coletado_em DESC, recebido_em DESC)`;
    3. Padronizar `dono uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id)` e documentar em comentário SQL que as futuras tabelas da fase B (`tarefas`, `acoes`, `eventos`, `perguntas` da seção 9.2) entrarão em migração aditiva referenciando `maquinas(id)` e chaves lógicas `(projeto_id text, etapa_id text)`.
  - **Por quê:** evita migração prematura enquanto o `painel/1` não congela na etapa B do pacote, garante performance na retenção/view e deixa espaço limpo para o Centro de Comando (Adendo 1) sem aumentar o escopo da `p1`.
- **F3 (`Edge Function ingest` — Aragorn · alta · Argon high):**
  - **O que muda:**
    1. Isolar os imports `npm:ajv@8/dist/2020.js` e `npm:ajv-formats@3` exclusivamente em `supabase/functions/ingest/index.ts`, injetando a função `validarEsquema` no módulo puro `supabase/functions/_shared/ingest.ts`;
    2. Verificar e atualizar o limite de 1 envio por minuto (`ultimo_envio_em`) **somente após** o corpo passar pelas validações de tamanho (413), JSON (400), esquema (422) e segredos (422);
    3. Na resposta `422` por segredo detectado, retornar `{ erro: "segredo_detectado", caminho, regra }` sem ecoar o valor da string rejeitada.
  - **Por quê:** permite que `node --test supabase/functions/` rode no Node 24 sem erro de protocolo `npm:`, impede que testes de erro (400/413/422) na fumaça bloqueiem o envio válido seguinte com `429`, e evita vazar segredo em logs de erro (Pontos 8.4 e 8.9).
- **F4 (`Scripts da máquina` — Aragorn · moderada · Flash medium):**
  - **O que muda:** nenhum ajuste de escopo; apenas garantir que `enviar-exemplo.mjs` gere um `coletado_em` (`new Date().toISOString()`) posterior ao do seed.
  - **Por quê:** garante que o teste de fumaça teste a inserção e a atualização de `ultimo_envio_em` sem colidir com o timestamp fixo do seed.
- **F5 (`Seed fictício` — Elrond · moderada · Flash medium):**
  - **O que muda:** no `supabase/seed.sql`, gravar a máquina `notebook-exemplo` com `ultimo_envio_em = '2026-10-23T15:00:00Z'` (no passado, e não `now()`).
  - **Por quê:** se `ultimo_envio_em` for `now()` no `db reset`, rodar `node scripts/enviar-exemplo.mjs` logo em seguida bateria no rate limit de 1/minuto (`429`) em vez de retornar `200` (Ponto 8.9).

### 2. Ordem `sociedade/ordens/p2-leitura.md` (sem aumentar o escopo)
- **Seção `## Dependências novas`:**
  - **O que muda:** fixar a lista aprovada por Odival (Pergunta 3): `react-router-dom` (v6, compatível com React 18), `ajv`, `ajv-formats`, `@testing-library/react` (dev) e `@playwright/test` (dev, usando os navegadores já existentes em `~/.cache/ms-playwright`), **removendo** `json-schema-to-typescript`.
  - **Por quê:** decisão de Odival; tipos escritos à mão e conferidos por teste triplo evitam dependências transitivas desnecessárias.
- **F1 (`Casca e rotas` — Legolas · moderada · Flash medium):**
  - **O que muda:**
    1. Extrair o conteúdo atual de `src/app/App.tsx` para `src/app/AnalisadorPage.tsx` (rota `/analisador`) com contêiner `flex-1 min-h-0 h-full` para o XYFlow não perder altura;
    2. Aplicar na casca (`src/app/PainelShell.tsx` e `src/app/rpgTheme.tsx`) a paleta RPG **"Noite de Valfenda e Ouro Velho"** (`stone-950`, `stone-900`, `amber-600/900`, títulos em serifada `'Cinzel', Georgia, serif` sem bloquear por rede);
    3. Deixar na navegação da casca (lateral em `>= 1280 px` e barra inferior compacta em `360 px`) o espaço reservado/sinalizado como `"Fase B (p3)"` para as telas **Sociedade (Cartas)**, **Tarefa nova**, **Perguntas** e **Conversa**, sem criar páginas novas nem aumentar o escopo da `p2`;
    4. No `src/__tests__/selfImport.test.ts`, atualizar a asserção de rotas/páginas raiz para refletir as rotas da casca e apontar o teste de expansão e prompt para `AnalisadorPage`.
  - **Por quê:** atende aos Adendos 1 e 2 e à decisão de Odival na Pergunta 2 sem cruzar arquivos com F3/F4 nem tocar em `src/ui/*`.
- **F2 (`Contrato e fonte no front` — Elrond · moderada · Flash medium):**
  - **O que muda:** especificar que `src/painel/contrato/painel1.types.ts` é escrito à mão e que `src/__tests__/painelContrato.test.ts` confere (a) igualdade byte a byte (SHA-256) entre `src/painel/contrato/painel-1.schema.json` e `sociedade/central/painel-1.schema.json`, (b) tipagem estática do exemplo oficial e (c) validação `Ajv2020` nas fixtures.
  - **Por quê:** formaliza a conferência dos tipos sem `json-schema-to-typescript` (Ponto 8.5).
- **F3 (`Hoje e "montar mensagem"` — Legolas · alta · Argon high):**
  - **O que muda:** aplicar os títulos e molduras RPG da seção 6.2 de `docs/arquitetura.md` (*"I. Espera pelo Conselho"*, *"II. Terras em Névoa · Desconhecido"* com selo `"NUNCA EM DIA"`, *"III. Forjas e Núcleos"* e *"IV. Pergaminho de Abertura"*) e manter a linha `Worktree:` idêntica ao teste-ouro da seção 5.3.
  - **Por quê:** decisão de Odival nas Perguntas 1 e 2.
- **F4 (`Projetos` — Legolas · moderada · Flash medium):**
  - **O que muda:** aplicar a metáfora visual de **Regiões**, **Marcos da Jornada** (stepper das 6 estações + `encerrada` e `desconhecida`), **Acampamentos** (`pastas`) e **Mensagens de Gwaihir** (`passagens` recolhidas por padrão).
  - **Por quê:** incorpora o clima RPG (Adendo 2) diretamente nos componentes de `src/painel/projetos/**` sem estourar o teto de linhas.
- **F5 (`Acessibilidade e capturas` — Galadriel · moderada · Flash medium):**
  - **O que muda:** conferir contraste AA (`>= 4.5:1`) na paleta noite/ouro velho e garantir que nenhum estado (`em dia`, `defasado`, `desconhecido`, `erro`) dependa apenas de cor ou ornamento (sempre ícone + rótulo textual).
  - **Por quê:** exigência da seção 5.6 e da regra D05.

### 3. Proposta de alocação da tela de Cartas ("Sociedade") e sequência `p3`–`p6`
- **Decisão de Odival (Perguntas 2 e 4):**
  - A identidade visual RPG entra já na **`p2-leitura`** (em Casca, Hoje e Projetos), enquanto a tela **"Sociedade" (Cartas dos agentes, seção 5.7)** vai para a **`p3`**, mantendo a `p2-leitura` enxuta e dentro do teto de ~1.500 linhas.
  - Sequência confirmada para a fase B:
    - **`p3`:** Tela "Sociedade" (Cartas dos agentes com `cartas.json`), Tarefa nova + Compositor visual (seleção no grafo + analisador de esquema SQL `sqlMigrationParser.ts`), Perguntas e Conversa (sem disparo remoto ainda);
    - **`p4`:** Login PKCE e `FonteSupabase` reais, ponte local (`sc.py ponte`) com Claude e Codex por clique, Gwaihir no GPT-6-Luna (resumo ≤ 2 KB + triagem com persona em 2 camadas: FTS5 local + caderno aprovado) e avisos PWA (Web Push), seguidos do adaptador Google (Gemini CLI / Antigravity);
    - **`p5`:** Executores em nuvem (Jules primeiro) e outras máquinas;
    - **`p6`:** Cadeia autônoma sob seção `"Autorização prévia"` da ordem (seção 9.9) e migração do Gwaihir para modelo aberto local com embeddings na máquina nova.

## Propostas ao contrato (`painel/1` e esquemas irmãos no pacote)

*(Nenhuma alteração foi feita em `sociedade/central/painel-1.schema.json`; propostas abaixo para a etapa B/D do pacote `sociedade_do_codigo`.)*

1. **Incluir `"gwaihir"` no enum de papéis (`$defs.escala.papel` do `painel/1`):**
   - De: `["arquiteto", "coordenador", "revisor", "aragorn", "elrond", "galadriel", "legolas", "jules"]`
   - Para: `["arquiteto", "coordenador", "revisor", "gwaihir", "aragorn", "elrond", "galadriel", "legolas", "jules"]`.
2. **Adicionar campo opcional `atributos_agentes` no topo do `painel/1` (para as Cartas da seção 5.7 / D08 / D10):**
   ```json
   "atributos_agentes": {
     "type": "array",
     "maxItems": 16,
     "items": {
       "type": "object",
       "additionalProperties": false,
       "required": ["papel", "etapas_atuadas", "aceites_de_primeira", "achados_bloqueadores", "passagens_feitas"],
       "properties": {
         "papel": { "type": "string", "maxLength": 40 },
         "etapas_atuadas": { "type": ["integer", "null"], "minimum": 0 },
         "aceites_de_primeira": { "type": ["integer", "null"], "minimum": 0 },
         "achados_bloqueadores": { "type": ["integer", "null"], "minimum": 0 },
         "passagens_feitas": { "type": ["integer", "null"], "minimum": 0 }
       }
     }
   }
   ```
3. **Adicionar campo opcional `ponte` no topo do `painel/1` (para a `p4`):**
   ```json
   "ponte": {
     "type": ["object", "null"],
     "additionalProperties": false,
     "required": ["ativa", "ultimo_batimento_em", "adaptadores"],
     "properties": {
       "ativa": { "type": "boolean" },
       "ultimo_batimento_em": { "type": ["string", "null"], "format": "date-time" },
       "adaptadores": { "type": "array", "maxItems": 12, "items": { "type": "string", "maxLength": 32 } }
     }
   }
   ```
4. **Evolução conjunta de `sc.py abertura` (`sc_interacao.py`) e do painel (Ponto 8.7 / Q188):**
   - Na etapa B/D do pacote, atualizar `cmd_abertura` e o gerador do painel juntos para que a linha `Worktree:` resolva a pasta real da ferramenta/papel a partir de `projeto.pastas` (`canonica` para arquiteto, `copia_revisao` para revisor, `worktree` para coordenador), mantendo `~/.sociedade/trabalho/<projeto>/<etapa>` como fallback quando a pasta ainda não existir.
5. **Novos esquemas irmãos em `sociedade/central/` para a `p3`/`p4`:**
   - `cartas-1.schema.json` e `sociedade/central/cartas.json` (especificados na seção 9-B.3 de `docs/arquitetura.md`);
   - `comando-1.schema.json` para validar `tarefas`, `acoes`, `eventos` e `perguntas` (especificado na seção 10.3 de `docs/arquitetura.md`).

## Perguntas a Odival

1. **Pergunta 1 (Ponto 8.7 / Q188 — Linha `Worktree:` na mensagem de abertura):**
   - *Pergunta:* Na mensagem de abertura (ponto 8.7 / Q188), a linha `Worktree:` hoje usa o padrão fixo `~/.sociedade/trabalho/<projeto>/<etapa>`, mas o `painel/1` traz as pastas reais de cada ferramenta (`canonica`, `worktree`, `clone`, `copia_revisao`). Como você prefere que ela se comporte?
   - *Recomendação do Argon:* Manter igual ao `sc.py abertura` 3.4.0 na `p2` (preservando o teste-ouro atual) e propor ao pacote mudar os dois juntos depois para usar a pasta real da ferramenta/papel.
   - *Resposta de Odival:* **(Recomendado) Manter igual ao `sc.py abertura` 3.4.0 na `p2` (preservando o teste-ouro atual) e propor ao pacote mudar os dois juntos depois para usar a pasta real da ferramenta/papel.**

2. **Pergunta 2 (Adendo 2 / Seções 5.6 e 5.7 — Escopo do tema RPG e da tela de Cartas entre `p2` e `p3`):**
   - *Pergunta:* Sobre o escopo da identidade visual RPG (seção 5.6) e da tela "Sociedade" com as Cartas dos agentes (seção 5.7 / adendo 2): a `p2-leitura` tem teto de ~1.500 linhas e 5 fatias focadas em Casca, Hoje e Projetos. Onde você prefere encaixar o tema RPG e a tela de Cartas?
   - *Recomendação do Argon:* Aplicar a identidade visual RPG (paleta noite/ouro velho, marcos da jornada e molduras) já na `p2` em Hoje e Projetos, e levar a tela "Sociedade" (Cartas dos agentes) para a `p3` (com o item já previsto na navegação da casca).
   - *Resposta de Odival:* **(Recomendado) Aplicar a identidade visual RPG (paleta noite/ouro velho, marcos da jornada e molduras) já na `p2` em Hoje e Projetos, e levar a tela "Sociedade" (Cartas dos agentes) para a `p3` (com o item já previsto na navegação da casca).**

3. **Pergunta 3 (Pontos 8.1 e 8.5 / `p2-leitura` — Dependências novas no npm):**
   - *Pergunta:* Sobre as dependências novas no npm (seção "Dependências novas" da `p2-leitura` e regra D09/Limites do perfil): quais pacotes você aprova para entrarem na fase A?
   - *Recomendação do Argon:* Aprovar `react-router-dom` (v6), `ajv`, `ajv-formats`, `@testing-library/react` (dev) e `@playwright/test` (dev, sem baixar navegadores), dispensando `json-schema-to-typescript` (tipos escritos à mão e conferidos por teste).
   - *Resposta de Odival:* **(Recomendado) Aprovar `react-router-dom` (v6), `ajv`, `ajv-formats`, `@testing-library/react` (dev) e `@playwright/test` (dev, sem baixar navegadores), dispensando `json-schema-to-typescript` (tipos escritos à mão e conferidos por teste).**

4. **Pergunta 4 (Seção 9.6 e Adendos 2 e 3 — Sequência das etapas `p3` a `p6`):**
   - *Pergunta:* Na sequência das etapas da fase B (seção 9.6), com as adições das Cartas (decidida para `p3`), do Compositor visual com SQL (9.8), do PWA/Web Push (9.1) e da Autonomia sob "Autorização prévia" (9.9), como você prefere organizar `p3` a `p6`?
   - *Recomendação do Argon:* `p3`: Cartas ("Sociedade"), Tarefa nova + Compositor visual (grafo + SQL), Perguntas e Conversa (sem disparo); `p4`: login/Supabase real, ponte local (Claude/Codex/Google), Gwaihir (GPT-6-Luna + FTS5) e PWA/Web Push; `p5`: nuvem (Jules) e outras máquinas; `p6`: cadeia autônoma sob "Autorização prévia" e modelo aberto local.
   - *Resposta de Odival:* **(Recomendado) `p3`: Cartas ("Sociedade"), Tarefa nova + Compositor visual (grafo + SQL), Perguntas e Conversa (sem disparo); `p4`: login/Supabase real, ponte local (Claude/Codex/Google), Gwaihir (GPT-6-Luna + FTS5) e PWA/Web Push; `p5`: nuvem (Jules) e outras máquinas; `p6`: cadeia autônoma sob "Autorização prévia" e modelo aberto local.**

## Evidências

### 1. Saída do `sc.py assumir`
Comando executado:
```bash
python3 /home/odival/.gemini/config/skills/sociedade-do-codigo/scripts/sc.py assumir coordenador --plataforma "Antigravity" --modelo "Gemini 4 Argon" --esforco "high" --subagentes "alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash"
```
Saída (código 0):
```text
Papel assumido: coordenador (Antigravity, Google, Gemini 4 Argon, high)
Arquivo do papel: /home/odival/.gemini/config/skills/sc-papeis/references/papel-gandalf.md
Ordem da etapa: (nenhuma etapa ativa ou informada)
Última passagem: nenhuma passagem registrada para este papel.
```

### 2. Arquivos lidos (restritos ao "Leia só" da passagem e adendos)
- `/home/odival/.gemini/config/skills/sociedade-do-codigo/SKILL.md`
- `sociedade/subordens/painel-complemento-argon.md`
- `sociedade/subordens/painel-complemento-argon-adendo-1.md`
- `sociedade/subordens/painel-complemento-argon-adendo-2.md`
- `sociedade/subordens/painel-complemento-argon-adendo-3.md`
- `sociedade/arquitetura-painel.md`
- `sociedade/ordens/p1-fundacao.md`
- `sociedade/ordens/p2-leitura.md`
- `sociedade/perfil.md`
- `sociedade/central/LEIAME.md`
- `sociedade/central/painel-1.schema.json`
- `sociedade/central/painel-1.exemplo.json`
- `src/app/App.tsx`
- `src/__tests__/selfImport.test.ts`
- `src/features/prompt/usePromptGenerator.ts` (linhas 1–120, `redactSecrets` e `createSafeMarkdownFence`)
- `vercel.json`
- `index.html`

### 3. Arquivos gerados e capturas (`docs/`)
- Complemento arquitetural: `docs/arquitetura.md`
- Captura 360 px — Tela Hoje (Conselho RPG): `docs/painel/hoje-360-rpg.svg`
- Captura 360 px — Tela Projetos (Regiões e Jornada RPG): `docs/painel/projetos-360-rpg.svg`
- Captura 360 px — Esboço da Carta de Agente (Frente e Verso RPG): `docs/painel/carta-agente-rpg.svg`
- Este retorno: `sociedade/subordens/painel-complemento-retorno.md`

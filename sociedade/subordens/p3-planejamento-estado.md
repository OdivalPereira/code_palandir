# Estado do planejamento da p3 (24/10/2026, interrompido por limite de uso)

## Entrevista (registrar no pacote, `planejamento-4-0.md`, seção 9)
| Q | Pergunta | Recomendação | Resposta | Resultado |
|---|---|---|---|---|
| Q227 | Onde moram tarefas, perguntas e eventos na p3 | Lacrada | **Só front, sobre fixtures**; tabelas com RLS na p4 | Seguiu |
| Q228 | Uma etapa ou duas | Visível: uma etapa | **Uma etapa** (~6 fatias, teto ~2.500 linhas) | Seguiu |
| Q229 | Quem escreve forças e fraquezas das cartas | Visível: Círdan rascunha, Odival edita | **Círdan rascunha, Odival edita** | Seguiu |
| Q230 | Gwaihir como receptor na p3 | Visível: reservado até a p4 | **Reservado até a p4** ("Fase B · p4") | Seguiu |
| Q231 | Quem executa a p3 | Visível: Argon no Antigravity | **Claude Code com subagentes** (pede exceção R3 registrada; revisão no Codex) | Divergiu |

Lacre da Q227 (conferível com `printf '%s' '<texto>' | sha256sum`):
- [`5cd7a1b7ce3060000f71118556f4483a49633f904a0eb5b3f1e305a6172aa2d7`] `Q227 | recomendacao lacrada: opcao A, so front sobre fixtures ficticias validadas pelo comando/1; tarefas, acoes, eventos e perguntas viram tabelas com RLS so na p4, junto com o login real e a FonteSupabase; na p3 a Tarefa nova e a resposta a uma Pergunta geram texto para Odival colar, e o rascunho da tarefa fica so na memoria da aba | nonce 4f1a-q227-9c2e`

## Feito
- `sociedade/central/cartas-1.schema.json` e `sociedade/central/comando-1.schema.json` (sem commit).

## Falta
1. `sociedade/central/cartas.json` (9 cartas: os 7 ativos, Gwaihir em espera e Jules em reserva; poderes de `sc-papeis`, forças e fraquezas rascunhadas do registro e dos pareceres) e `comando-1.exemplo.json` fictício (3 tarefas, eventos, 4 perguntas, uma lacrada respondida com o SHA-256 real); validar ambos com o validador mínimo; atualizar `central/LEIAME.md`.
2. Ordem `sociedade/ordens/p3-comando.md`, fatias:
   - F1 casca e rotas (`/sociedade`, `/tarefa-nova`, `/perguntas`, `/conversa`), sem o Gwaihir ativo;
   - F2 contratos no front (cópias byte a byte, tipos, Ajv, fixtures, `comandoStore`);
   - F3 Cartas;
   - F4 Perguntas (lacre conferido por SHA-256, seguiu/divergiu) e Conversa, com revisão interna;
   - F5a `sqlMigrationParser` e nós `table`/`column` no grafo (mexe em tipos, `graphBuilder`, `GraphCanvas` e importação de `.sql`), com revisão interna;
   - F5b Tarefa nova, `buildTaskDraftFromSelection`, botão "Abrir como Tarefa nova" no Analisador e teste-ouro da mensagem ao arquiteto;
   - F6 acessibilidade e capturas.
   Executor: Claude Code (Q231); revisão: Barbárvore no Codex, protocolo reduzido.
3. Registrar Q227–Q231 e a exceção R3 da p3 no pacote; commits com o "sim" de Odival; `sc.py abrir` e worktree a partir de `painel/base` (`247cc30`).

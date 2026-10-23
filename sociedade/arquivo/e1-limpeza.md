> **Retirada em 23/10/2026, sem execução.** O Code Palandir passa a ser o painel da Sociedade do Código (Q206 e Q207 do pacote), e a premissa desta ordem (o produto não cita a Sociedade) deixou de valer. O rodapé neutro do relatório exportado volta a ser discutido na fase B do painel.

# Ordem e1-limpeza — o código e o relatório exportado deixam de citar a Sociedade e seus papéis

Para: Gandalf (Antigravity, Gemini, esforço alto) · CONVERSA NOVA
Etapa: e1-limpeza · Base: `33f2c0f` · Worktree: `~/.sociedade/trabalho/code_palandir/e1-limpeza` (criado pelo Círdan com `sc_worktree.py criar` depois da aprovação) · Ramo: `etapa/e1-limpeza`
Especialistas: Elrond (F1), Galadriel (F2) · Revisão interna: nenhuma (sem alto impacto) · Jules: nenhuma
Revisão independente: Barbárvore (Codex, OpenAI), no candidato consolidado.

## Objetivo
O produto não carrega rastros do método de trabalho: nenhum comentário, nome de teste ou texto gerado cita a "Sociedade do Código" nem os papéis (Gandalf, Aragorn, Elrond, Galadriel, Legolas, Celebrimbor, Radagast, Faramir, Bilbo).

Como Odival percebe: o relatório Markdown exportado pela ferramenta termina com um rodapé neutro do Code Palandir, sem "Ferramenta Oficial da Sociedade do Código" nem "Regras O(1)"; a busca abaixo não acha nada em `src/`; a suíte, os tipos e o build seguem verdes, com os mesmos 140 testes.

## Leia só
1. `sociedade/perfil.md`, seções "Papéis locais", "Regras de domínio" e "Portão por área"
2. `src/services/graphExporters.ts` (cabeçalho, linhas 1–40, e rodapé, linhas 100–110), `src/services/mermaidGenerator.ts` (linhas 1–20)
3. `src/engine/architecturalMetrics.ts` (linhas 1–15), `src/engine/analyzers/nextAppRouterDetector.ts` (linhas 15–30)
4. Os `describe()` de `src/__tests__/{architecturalMetrics,nextAppRouter,graphExporters}.test.ts` e `src/__tests__/forensicsPanel.test.tsx`, mais as asserções do rodapé em `graphExporters.test.ts`, se houver
5. Mapa: `grep -rniE "sociedade|gandalf|aragorn|elrond|galadriel|legolas|celebrimbor|radagast|faramir|bilbo" src`

## Fatias
1. **Textos do produto** · especialista: Elrond · escreva só: `src/services/graphExporters.ts`, `src/services/mermaidGenerator.ts`, `src/engine/architecturalMetrics.ts`, `src/engine/analyzers/nextAppRouterDetector.ts` · aceite: comentários descrevem o que o módulo faz, sem atribuir a método ou papel; linha "Gerado por" = "Code Palandir"; rodapé do relatório neutro (por exemplo "Relatório gerado pelo Code Palandir."); nenhuma mudança de lógica, assinatura ou formato fora dessas linhas de texto.
2. **Nomes dos testes** · especialista: Galadriel · escreva só: `src/__tests__/architecturalMetrics.test.ts`, `src/__tests__/nextAppRouter.test.ts`, `src/__tests__/graphExporters.test.ts`, `src/__tests__/forensicsPanel.test.tsx` · aceite: `describe()` sem nome de papel; asserção que dependa do texto antigo do rodapé passa a conferir o rodapé novo; o mesmo número de testes (140).

A F2 depende do texto do rodapé da F1. Os arquivos das duas fatias não se cruzam (`verificar_disjuncao.py`).

## Paradas
- Mudança de escopo, de contrato ou instalação: volta ao arquiteto e ao usuário.
- Teto de cerca de 1.500 linhas de produto por candidato (aqui, esperado < 40).
- Qualquer mudança além de texto (lógica, schema `SerializedGraphBundle`, dependência): para e devolve.
- Sem push, PR ou merge: o Odival faz.

## Entregas verificáveis
Os ids da conversa do Antigravity (E4 e E5) entram aqui antes da conferência, com o id que o Odival informar ao abrir a conversa.

```entregas
E1 | commit_existe | etapa/e1-limpeza
E2 | arquivos_em | 33f2c0f..etapa/e1-limpeza | src/ | sociedade/
E3 | atestado_aprovado | sociedade/pareceres/atestado-e1-limpeza.json | etapa/e1-limpeza
E4 | delegacoes | antigravity | <id da conversa> | 2
E5 | conversa_nova | antigravity | <id da conversa>
```

## Retorno
Até 2 KB no chat: veredito, lista de entregas preenchida, commits, atestado e pendências. O detalhe vai para `sociedade/subordens/e1-limpeza-retorno.md`.

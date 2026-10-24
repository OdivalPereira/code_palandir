# Ordem p2b-versao — os dois resíduos do A1 (desconhecido continua desconhecido)

Para: Gandalf (Antigravity, Gemini 3.8 Flash, esforço high) · De: Círdan · CONVERSA NOVA
Etapa: p2b-versao · Base: `2028ff2` · Worktree: `~/.sociedade/trabalho/code_palandir/p2b-versao` · Ramo: `etapa/p2b-versao`
Especialistas: Legolas (F1) · Revisão interna: nenhuma · Jules: nenhuma
Portão: por fatia (padrão); área `app` do perfil
Revisão independente: Barbárvore (Codex, GPT-6.1-Sol, high), protocolo reduzido, sobre o delta desde `2028ff2`
Cadeia: a `p2-leitura` encerrou sem aceite (Q226); **o aceite desta etapa autoriza o merge da cadeia p2 + p2b** em `painel/base`.

## Objetivo
Fechar os dois resíduos do A1 que a reconferência da p2 deixou (regra D08, "desconhecido ≠ vazio"):
- **A1.1:** uma instalação com diagnóstico no próprio campo ainda aparece "em dia" no Conselho, porque `HojePage.tsx` não passa os diagnósticos para a classificação;
- **A1.2:** com `fonte_versao` nula e alteração local, a classificação dá "defasado" em vez de "desconhecido".

**Como Odival percebe:** no Conselho e nas Regiões, só aparece "em dia" quando a versão, a referência do pacote e o campo estão todos confirmados. Com referência nula ou diagnóstico, aparece "desconhecido" com o motivo.

## Leia só
1. `sociedade/pareceres/parecer-p2-leitura.md`: os achados A1.1 e A1.2
2. `sociedade/perfil.md`: D08
3. `src/painel/regras/classificarVersao.ts`
4. `src/painel/hoje/HojePage.tsx` (Forjas e Núcleos) e as chamadas em `src/painel/projetos/ProjetosPage.tsx`
5. `src/__tests__/painelVersao.test.ts`, mais `src/painel/contrato/painel1.types.ts` só para o formato de `diagnosticos`

## Fatias
*Nível e modelo pelo cardápio do perfil: moderada = Gemini 3.8 Flash medium.*
1. **Desconhecido vence (A1.1 e A1.2)**
   - especialista: Legolas · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `src/painel/regras/**`, `src/painel/hoje/**`, `src/painel/projetos/**`, `src/__tests__/painelVersao.test.ts`, `src/__tests__/painelHoje.test.tsx`, `src/__tests__/painelProjetos.test.tsx`
   - aceite (E):
     - a regra, nesta ordem de precedência:
       1. versão nula, `fonte_versao` nula ou diagnóstico do campo: `desconhecido`, com o motivo (referência nula ou o texto do diagnóstico);
       2. depois, alteração local ou versão diferente: `defasado`;
       3. só então `em_dia`;
     - a alteração local pode aparecer junto no rótulo do desconhecido (por exemplo "referência do pacote desconhecida · alteração local"), mas não muda o estado;
     - os diagnósticos cujo `campo` aponta para a instalação (por exemplo `pacote.instalacoes[0].versao`) chegam à classificação dela no Conselho; o mesmo vale para os núcleos, como já é hoje;
     - `painelVersao.test.ts` traz uma tabela com o resultado esperado **escrito por extenso** em cada linha, sem derivar o esperado do próprio código; ela cobre fonte nula com alteração local e diagnóstico com versão igual e com versão diferente;
     - teste de tela com o cenário do revisor (cópia fictícia do exemplo com o diagnóstico `{projeto: null, campo: 'pacote.instalacoes[0].versao', motivo: 'versão não confirmada (fictício)'}`): a instalação não mostra "(em dia)" e mostra o motivo;
     - os 307 testes atuais seguem verdes, ajustados só onde a regra mudou, com justificativa no retorno.

## Paradas
- Nada fora de A1.1 e A1.2. Não toque em `src/painel/mensagem/`, `src/app/`, `src/ui/`, `supabase/`, `scripts/`, `server/`, `package.json` nem `package-lock.json`.
- Se a conversa for interrompida, Odival retoma com uma mensagem que começa com `RETOMADA`.
- Até 3 tentativas por bloqueio; depois pare e devolva.
- Teto: cerca de 150 linhas de produto.
- Sem push, PR ou merge: Odival faz.

## Entregas verificáveis
`Preencher no manifesto p2b-versao-entregas.md, não na ordem.`

```entregas
E1 | commit_existe | etapa/p2b-versao
E2 | arquivos_em | 2028ff2..etapa/p2b-versao | src/ | sociedade/
E3 | atestado_aprovado | sociedade/pareceres/atestado-p2b-versao.json | etapa/p2b-versao
E4 | delegacoes | antigravity | <id da conversa> | 1
E5 | conversa_nova | antigravity | <id da conversa>
```

## Retorno
Formato: `Para · De · Etapa / Situação / Feito / Pendente ou decisão pedida / Próximo passo de quem recebe / Detalhe`.

O retorno vai para `sociedade/subordens/p2b-versao-retorno.md`, com:
- `## Resumo` (até 25 linhas), com as contagens tiradas da saída dos testes, nunca estimadas;
- `## Evidências`, com o portão e a tabela de decisão.

No chat, até 2 KB.

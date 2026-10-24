# Subordem F1 — Desconhecido vence (A1.1 e A1.2)

Para: Legolas (Antigravity, Gemini 3.8 Flash, esforço medium) · De: Gandalf (coordenador)
Etapa: p2b-versao · Fatia: F1 · Nível: moderada

## Objetivo
Corrigir os dois resíduos do achado A1 apontados na reconferência da etapa p2-leitura (regra D08, "desconhecido ≠ vazio"):
1. **A1.1:** Uma instalação com diagnóstico no próprio campo ainda aparece "em dia" no Conselho (`HojePage.tsx`), porque `HojePage.tsx` não passava os diagnósticos para a classificação.
2. **A1.2:** Com `fonte_versao` nula e alteração local, a classificação dava "defasado" em vez de "desconhecido".

## Leia só
1. `sociedade/pareceres/parecer-p2-leitura.md`: achados A1.1 e A1.2 (linhas 90-95)
2. `sociedade/perfil.md`: regra D08
3. `src/painel/regras/classificarVersao.ts`
4. `src/painel/hoje/HojePage.tsx` e `src/painel/projetos/ProjetosPage.tsx`
5. `src/__tests__/painelVersao.test.ts` e `src/painel/contrato/painel1.types.ts`

## Escreva só
- `src/painel/regras/**`
- `src/painel/hoje/**`
- `src/painel/projetos/**`
- `src/__tests__/painelVersao.test.ts`
- `src/__tests__/painelHoje.test.tsx`
- `src/__tests__/painelProjetos.test.tsx`

## Critérios de Aceite (E)
1. **Ordem de precedência em `classificarVersao`:**
   - 1º: Versão nula, `fonte_versao` nula ou diagnóstico do campo: `desconhecido`, com o motivo (referência nula, versão desconhecida ou o texto/quantidade do diagnóstico).
   - 2º: Depois, alteração local ou versão diferente: `defasado`.
   - 3º: Só então `em_dia`.
2. **Alteração local com desconhecido:**
   - A alteração local pode aparecer junto no motivo/rótulo do desconhecido (por exemplo `"referência do pacote desconhecida · alteração local"`), mas **não muda o estado** (continua `desconhecido`).
3. **Diagnósticos da instalação chegam ao Conselho:**
   - Os diagnósticos cujo `campo` aponta para a instalação (por exemplo `pacote.instalacoes[0].versao`, ou pelo índice `pacote.instalacoes[idx].versao`) chegam à classificação dela no Conselho (`HojePage.tsx`); o mesmo vale para os núcleos, como já é hoje.
4. **Tabela de testes explícita em `painelVersao.test.ts`:**
   - `painelVersao.test.ts` traz uma tabela com o resultado esperado **escrito por extenso** em cada linha, sem derivar o esperado do próprio código.
   - Cobre expressamente:
     - `fonteVersao: null` com `alteracaoLocal: true` -> `desconhecido`
     - diagnóstico com versão igual -> `desconhecido`
     - diagnóstico com versão diferente -> `desconhecido`
5. **Teste de tela do cenário do revisor:**
   - Teste de tela (em `src/__tests__/painelHoje.test.tsx`) com o cenário do revisor Barbárvore: cópia fictícia do exemplo com o diagnóstico `{ projeto: null, campo: 'pacote.instalacoes[0].versao', motivo: 'versão não confirmada (fictício)' }`.
   - A instalação NÃO mostra `(em dia)` e mostra o motivo.
6. **Suíte verde:**
   - Todos os 307 testes atuais continuam verdes (ou ajustados onde a regra mudou, com justificativa no retorno).
   - `npx tsc --noEmit` limpo.

## Paradas
- Não toque em nada fora de `escreva só`.
- Não toque em `src/painel/mensagem/`, `src/app/`, `src/ui/`, `supabase/`, `scripts/`, `server/`, `package.json`, `package-lock.json`.
- Sem push, PR ou merge.
- Teto: cerca de 150 linhas de produto.

## Retorno esperado
Em `sociedade/subordens/p2b-versao-f1-legolas-retorno.md` e no chat:
- Resumo das mudanças feitas
- Saída dos testes dirigidos (`npm test`) e contagem de testes
- Justificativa de qualquer teste adaptado

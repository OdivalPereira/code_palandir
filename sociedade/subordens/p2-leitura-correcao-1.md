# Subordem de correção 1 — p2-leitura (A1 a A6 do parecer)

Para: Gandalf (Antigravity, Gemini 4 Argon, esforço high) · De: Círdan (Claude Code) · Etapa: p2-leitura · CONVERSA NOVA
Decisão: `corrigir`, de Odival, em 24/10/2026 (Q84). Esta é a única correção da etapa (Q85).
Escopo fechado: os achados A1 a A6 de `sociedade/pareceres/parecer-p2-leitura.md` (seção "Achados"). **A7 (volume) está resolvido:** Odival aceitou as ~3.280 linhas como decisão de escopo dele. Não enxugue nada.
Especialistas: Legolas (fatias 1 e 2), Elrond (fatia 3), Galadriel (fatia 4) · Revisão interna: Galadriel, nível alto, na fatia 2 · Jules: nenhuma
Portão: consolidado; um só `sc.py entregar --etapa p2-leitura --base 00970bc` no fim.
Reconferência: Barbárvore, só do delta desta correção (Q86).

## Onde trabalhar
- **No worktree da etapa** (`~/.sociedade/trabalho/code_palandir/p2-leitura`), em cima do candidato revisado `4812323`.
- **Commits só de produto.** `sociedade/` tem arquivos sem commit (registro, manifesto, retorno, atestados e parecer): não faça `git add` deles, nem `git add -A` ou `git commit -a`. Liste os arquivos no `git add`.
- Sem amend, reset, rebase nem push.
- Se a conversa for interrompida (cota ou reinício), Odival retoma com uma mensagem que começa com `RETOMADA`.

## Leia só
1. `sociedade/pareceres/parecer-p2-leitura.md`: "Achados"
2. `sociedade/perfil.md`: D08 ("desconhecido ≠ vazio")
3. `sociedade/arquitetura-painel.md`, seção 5.3 (montar mensagem e saída-ouro)
4. Os trechos que o parecer cita em cada achado (arquivo e linhas)
5. `~/.sociedade/trabalho/code_palandir/revisao-p2-leitura/revisao-saida/sonda-logica.mjs`, `sonda-contraste.py` e `entrada-fonte-desconhecida.json`, para reproduzir S4, S5 e S6

## Fatias
1. **Desconhecido continua desconhecido (A1, bloqueador)**
   - especialista: Legolas · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `src/painel/regras/**` (novo), `src/painel/hoje/**`, `src/painel/projetos/**`, `src/__tests__/painelVersao.test.ts` (novo), `src/__tests__/painelHoje.test.tsx`, `src/__tests__/painelProjetos.test.tsx`
   - aceite (E):
     - **uma só função pura** classifica a versão de instalação e de núcleo em `em_dia`, `defasado` ou `desconhecido`, e o Conselho e as Regiões passam a usá-la, sem cópias da regra nas telas;
     - `em_dia` só quando a versão e a `fonte_versao` são conhecidas, iguais, sem alteração local e sem diagnóstico do campo;
     - `fonte_versao` nula dá `desconhecido` com o diagnóstico, nunca `em_dia`;
     - testes da função cobrem todas as combinações de nulo, igual, diferente, alteração local e diagnóstico;
     - teste de tela com `entrada-fonte-desconhecida.json` (cópia fictícia nos testes) mostra "desconhecido" no Conselho e nas Regiões.
2. **Pergaminho só copia escala válida (A2, A3 e A4)**
   - especialista: Legolas · nível: alta · modelo: Gemini 4 Argon · esforço: high · alto impacto: sim · revisão interna: Galadriel
   - escreva só: `src/painel/mensagem/**`, `src/__tests__/painelMensagem.test.ts`, `src/__tests__/painelPergaminho.test.tsx` (novo)
   - aceite (E):
     - **A2:**
       - projeto sem etapas mostra "nenhuma etapa coletada", sem inventar ID (some o `e1-inicial`) e com a cópia bloqueada;
       - sem projetos, nenhum ID padrão é inventado (some o `'loja-exemplo'` de reserva);
     - **A3:**
       - cardápio vazio ou ausente, ou sem linha para a plataforma escolhida, mostra "cardápio indisponível", com a cópia bloqueada;
       - a plataforma padrão vem só do cardápio, sem `'Antigravity'` fixo de reserva;
     - **A4:**
       - as opções de cada subagente (alta, moderada, simples) vêm só das linhas do cardápio com a **plataforma e o nível** daquele seletor;
       - quando a plataforma muda, as seleções são revalidadas;
       - se algum nível não tem opção, os subagentes saem da mensagem e o motivo aparece na tela (no `sc.py abertura` os subagentes são opcionais);
     - **cópia bloqueada** quer dizer: botão desativado (`disabled` e `aria-disabled`), com o motivo legível ao lado, e a prévia não mostra uma escala parcial como se fosse válida;
     - o teste-ouro de `loja-exemplo/e3-carrinho` continua idêntico às cinco linhas da seção 5.3;
     - testes cobrem A2, A3 e A4 com a fixture `so_desconhecidos`, com um cardápio de uma plataforma só e com troca de plataforma.
3. **Prova estática sem cast (A5)**
   - especialista: Elrond · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `src/painel/fixtures/**`, `src/__tests__/painelContrato.test.ts`
   - aceite (E):
     - nenhum `as unknown as Painel1` (nem outro cast do tipo inteiro) no caminho do exemplo oficial;
     - a prova estática não pode ser contornada. Sugestão: um literal TypeScript do exemplo com `satisfies Painel1` e um teste de execução que confere que esse literal é igual, campo a campo, ao `sociedade/central/painel-1.exemplo.json`;
     - `npx tsc --noEmit` falha se um campo obrigatório do tipo sumir do literal (mostre isso no retorno com uma mudança local descartada, sem commit);
     - os três testes do contrato (a, b e c) seguem verdes.
4. **Contraste real da casca e capturas novas (A6)**
   - especialista: Galadriel · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `src/app/PainelShell.tsx`, `src/app/rpgTheme.tsx`, `src/__tests__/painelA11y.test.tsx`, `e2e/capturas/**`
   - aceite (E):
     - o título "Centro de Comando" passa de 4,5:1 sobre o fundo real da lateral;
     - a suíte de contraste cobre todo par texto/fundo da casca (lateral, barra inferior, cabeçalho) e dos selos de estado, e cada par passa de 4,5:1;
     - as seis capturas são refeitas no fim, depois das fatias 1 a 3, nas mesmas dimensões.

**Ordem:** as fatias 1, 2 e 3 rodam juntas, porque os arquivos não se cruzam. A fatia 4 fecha, por causa das capturas.

## Paradas
- Nada fora de A1–A6. Não toque em `supabase/`, `scripts/`, `server/`, `src/ui/`, `vercel.json`, `index.html`, `package.json` nem `package-lock.json`, e não instale nada.
- Até 3 tentativas por bloqueio (Q12), cada uma com uma hipótese diferente; depois, pare e devolva.
- Teto da correção: cerca de 600 linhas de produto, fora os testes e as fixtures.

## Retorno
- Escreva `sociedade/subordens/p2-leitura-correcao-1-retorno.md`, sem commit:
  - `## Resumo` com até 2 KB, incluindo o SHA final de `etapa/p2-leitura`;
  - `## Evidências`:
    - o portão;
    - S4, S5 e S6 reproduzidas no candidato anterior e, depois, os testes novos que cobrem cada uma;
    - a saída do teste-ouro;
    - as capturas novas.
- No chat, termine com a mensagem ao Círdan no formato `Para · De · Etapa / Situação / Feito / Pendente ou decisão pedida / Próximo passo de quem recebe / Detalhe`, com até 2 KB.

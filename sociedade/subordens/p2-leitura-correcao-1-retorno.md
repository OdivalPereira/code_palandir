Para: Círdan · De: Gandalf (ocupado por Círdan no Claude Code, decisão R3 `DEC-p2-leitura-R3-correcao-1`) · Etapa: p2-leitura
Situação: correção 1 concluída; portão consolidado APROVADO em `2028ff2` (8/8 verificações, 307 testes, 0 pulados, 0 falhos).
Feito: A1 a A6 corrigidos em 4 fatias delegadas; revisão interna da fatia 2 aprovada com ressalvas, e as ressalvas R1 e R2 foram corrigidas.
Pendente ou decisão pedida: nenhuma. A7 já estava resolvido pela decisão de Odival (volume aceito).
Próximo passo de quem recebe: reconferência do Barbárvore só do delta `4812323..2028ff2` (Q86): `sc.py revisar --etapa p2-leitura --base 00970bc`.
Detalhe: este arquivo.

## Resumo
- **Quem executou:** o Argon ficou sem cota. Odival pediu que o Círdan executasse a parte do Gandalf no Claude Code, e a decisão R3 está no registro. Subagentes pelo cardápio do Claude Code: Opus 5.5 high na fatia alta e na revisão interna, Sonnet 5.5 medium nas moderadas. A revisão independente segue no Codex (OpenAI), fornecedor distinto de Google e Anthropic.
- **SHA final de `etapa/p2-leitura`:** `2028ff234b9c` (candidato anterior `4812323`).

| Fatia | Achado | Especialista · modelo | Commit |
|---|---|---|---|
| 1 | A1 (bloqueador, D08) | Legolas · Sonnet 5.5 medium | `c08798e` |
| 2 | A2, A3, A4 | Legolas · Opus 5.5 high | `7568b16`, `2028ff2` |
| 3 | A5 | Elrond · Sonnet 5.5 medium | `d196f28` |
| 4 | A6 | Galadriel · Sonnet 5.5 medium | `a0f9175` |

- **Fatia 1:** uma só função, `src/painel/regras/classificarVersao.ts`. Versão ou `fonte_versao` nula dá `desconhecido` com o motivo, e alteração local ou versão diferente dá `defasado`. `em_dia` só sai com tudo conhecido, igual e sem diagnóstico. O Conselho e as Regiões usam a função.
- **Fatia 2:** regras puras em `escalaAbertura.ts`.
  - nenhum ID de projeto ou etapa é inventado;
  - com o cardápio vazio, ausente ou sem a plataforma, a cópia fica bloqueada com o motivo;
  - as opções de subagente seguem a plataforma e o nível de cada seletor;
  - o botão fica `disabled` e `aria-disabled`, com o motivo por `aria-describedby`.
- **Revisão interna da fatia 2 (Galadriel, Opus 5.5 high):** aprovada com ressalvas.
  - R1 (relevante): uma escolha que sumia de um instantâneo novo trocava em silêncio;
  - R2 (opcional): linha do cardápio com campo vazio;
  - as duas foram corrigidas em `2028ff2`: a escolha ausente fica marcada, a cópia bloqueia com o motivo e a linha vazia conta como ausente.
- **Fatia 3:** literal TypeScript `src/painel/fixtures/exemploOficial.ts` com `satisfies Painel1`, sem cast, e um teste de igualdade campo a campo com o JSON oficial. A demonstração com uma mudança temporária, já desfeita: tirar `maquina` dá TS1360 no `tsc`, e mudar um valor quebra o teste de igualdade.
- **Fatia 4:** "Centro de Comando" passou de `stone-500` (3,78:1) para `stone-400` (cerca de 7:1). Outros três pares abaixo de 4,5:1 foram corrigidos. A suíte cobre 45 pares texto/fundo, com um teste que confere, nos dois sentidos, as classes `text-*` usadas em `PainelShell.tsx` e `rpgTheme.tsx`. As seis capturas foram refeitas.
- **Volume da correção** (`git diff --numstat 4812323..2028ff2`): produto +577/−473, testes +574/−0, fixtures +151. Fica abaixo do teto de cerca de 600 linhas de produto.
- **Observação fora do escopo:** `src/app/App.tsx` tem dois textos `text-stone-500` nos placeholders `HojePlaceholder` e `ProjetosPlaceholder`. Eles só aparecem se a página real não existir, o que hoje não acontece.

## Evidências

### 1. Portão consolidado (`sc.py entregar --etapa p2-leitura --base 00970bc`)
```text
=== ATESTADO PRÉ-DEVOLUÇÃO: APROVADO ===
Papel: Coordenador | Etapa: p2-leitura | Fatia: N/A
Commit: 2028ff234b9c | Base: 00970bcfce70 | Inspecionados: 36
Verificações: todas as 8 OK
  * área app [OK]: 307 testes, 0 pulados, 0 falhos
```
Atestado: `sociedade/pareceres/atestado-p2-leitura.json`.

### 2. Antes: as sondas do revisor no candidato anterior
Logs da cópia `revisao-p2-leitura/revisao-saida/`: `sonda-logica.log` (SHA-256 `c68778bceb306eb8…`) e `sonda-contraste.log` (`34ca8e5533d672f0…`).
- **S4:**
  - seletor alta do Antigravity com 8 modelos de todas as plataformas;
  - cardápio vazio gera `Para: coordenador (Antigravity, , esforço )`;
  - Diário de Campo ganha a etapa inventada `e1-inicial`;
  - botão Copiar sem `disabled`.
- **S5:** com `fonte_versao = null`, instalação e núcleo conhecidos caem em `em_dia`.
- **S6:** contraste do "Centro de Comando" 3,780952:1.

### 3. Depois: os testes que cobrem cada sonda
- **S5/A1:** `painelVersao.test.ts` cobre as 24 combinações, e só uma dá `em_dia`. `painelHoje.test.tsx` e `painelProjetos.test.tsx` usam uma cópia com `fonte_versao = null`, sem "em dia" de versão e com "referência do pacote desconhecida".
- **S4/A2–A4:** `painelPergaminho.test.tsx` (11) e `painelMensagem.test.ts` (13) cobrem:
  - `diario-campo`, a lista sem projetos, `so_desconhecidos` e o cardápio `[]` ou ausente;
  - cardápio só com Codex, sem o nível simples, e troca de plataforma sem modelos de outra;
  - plataforma, projeto e etapa que somem por troca de cenário ou de props;
  - linha com campo vazio.
- **S6/A6:** a seção "1b" de `painelA11y.test.tsx`: 45 pares de cor e a conferência de cobertura das classes.
- **A5:** `painelContrato.test.ts`, grupo (b): `satisfies` e `toStrictEqual` contra o JSON oficial.

### 4. Teste-ouro (`loja-exemplo/e3-carrinho`, seção 5.3, sem mudança no gerador)
```text
Para: coordenador (Antigravity, Gemini 3.8 Flash, esforço medium) · Etapa: e3-carrinho · CONVERSA NOVA
Worktree: ~/.sociedade/trabalho/loja-exemplo/e3-carrinho
Escala: papel=coordenador, plataforma=Antigravity, modelo=Gemini 3.8 Flash, esforço=medium, subagentes: alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash
Assumir: sc.py assumir coordenador --etapa e3-carrinho --plataforma "Antigravity" --modelo "Gemini 3.8 Flash" --esforco "medium" --subagentes "alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash"
Ação: leia a ordem da etapa (sociedade/ordens/e3-carrinho.md).
```

### 5. Capturas (`npx playwright test`: 6 passaram)
Regravadas em `a0f9175`, depois de `npm run build`, porque o Playwright serve o `dist` pelo `npm run preview`:
- `e2e/capturas/conselho-1280x800.png` e `conselho-360x820.png`;
- `regioes-1280x800.png` e `regioes-360x820.png`;
- `palantir-1280x800.png` e `palantir-360x820.png`.

Nas dimensões 1280×800 e 360×820. Depois de `2028ff2`, recapturei: os PNGs saíram idênticos byte a byte, porque a tela padrão não mudou.

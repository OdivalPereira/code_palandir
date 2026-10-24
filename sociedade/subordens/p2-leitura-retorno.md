Para: Círdan · De: Gandalf · Etapa: p2-leitura
Situação: 5 fatias concluídas, revisão interna da F3 aprovada pela Galadriel e portão aprovado no commit 4812323
Feito: F1 (Casca RPG e rotas, Legolas, 5941f22), F2 (Contrato painel/1 e FonteFixture, Elrond, 821a0de), F3 (O Conselho e Pergaminho de Abertura, Legolas Argon + revisão interna Galadriel Argon, 07f105a), F4 (Regiões / Projetos, Legolas, 1251e86), F5 (Acessibilidade WCAG AA e capturas Playwright em 1280x800 e 360x820, Galadriel, 4812323)
Pendente ou decisão pedida: (1) em `sc.py conferir`, E1..E4 estão `feito` e E5 marca `2 ordens na mesma conversa` apenas porque houve retomada (`"continue de onde parou"`) após reinício do servidor Antigravity; (2) proposta opcional para a etapa B/D do pacote sincronizar `sc.py abertura` e o painel quando `Worktree:` passar a usar `projeto.pastas`
Próximo passo de quem recebe: conferir entregas (`sc.py conferir --ordem sociedade/ordens/p2-leitura.md`) e preparar a cópia de revisão independente para o Barbárvore (`sc.py revisar --etapa p2-leitura --base 00970bc`)
Detalhe: sociedade/subordens/p2-leitura-retorno.md

## Resumo

1. **F1 — Casca RPG e rotas (`5941f22`, Legolas · Flash medium):** Extraído o analisador original intacto para `src/app/AnalisadorPage.tsx` (`flex-1 min-h-0` preservando 100% da altura do XYFlow) e implementados `src/app/PainelShell.tsx`, `src/app/rpgTheme.tsx` (paleta "Noite de Valfenda e Ouro Velho", títulos em `'Cinzel', Georgia, 'Times New Roman', serif` local) e `src/app/App.tsx` com as 4 rotas (`/`, `/projetos`, `/projetos/:id`, `/analisador`) e itens reservados (`Sociedade`, `Tarefa nova`, `Perguntas`, `Conversa` com selo `"Fase B · p3"`).
2. **Justificativa do ajuste em `src/__tests__/selfImport.test.ts`:** A asserção de rotas foi atualizada de `['/']` para a lista ordenada exata das 4 rotas da casca (`['/', '/analisador', '/projetos', '/projetos/:id']`), com limites inferiores para a contagem de páginas/nós colapsados (`>= 5`) e redirecionamento do teste de expansão e geração de prompt para `AnalisadorPage`.
3. **F2 — Contrato e fonte no front (`821a0de`, Elrond · Flash medium):** Escrito `src/painel/contrato/painel1.types.ts` à mão com `| null` estrito (D08), copiado `painel-1.schema.json` idêntico byte a byte (`SHA-256 fdf345d7...`), criado validador Ajv 2020, cenários de fixture (`valido`, `vazio`, `so_desconhecidos`, `limites`, `parcial`, `invalido`), `FonteFixture` e `usePainelStore` independente.
4. **F3 — O Conselho e Pergaminho de Abertura (`07f105a`, Legolas · Argon high + Revisão Interna Galadriel · Argon high):** Implementadas as seções I (`Espera pelo Conselho` na ordem da seção 5.3), II (`Terras em Névoa · Desconhecido` com selo `"NUNCA EM DIA"` destacando `Diário de Campo`), III (`Forjas e Núcleos`) e IV (`Pergaminho de Abertura` com `redactSecrets`, modelos exclusivos do `cardapio` e layout 7/12 + 5/12 em 1280 px). Revisão interna da Galadriel aprovada em 7/7 itens.
5. **F4 — Regiões / Projetos (`1251e86`, Legolas · Flash medium):** Implementada `src/painel/projetos/ProjetosPage.tsx` com Lista de Regiões, Marcos da Jornada (6 estações + `encerrada` e `desconhecida`), Acampamentos (`pastas`), Companhia (`interacoes` com alerta quando `modelo_no_log` é `null` ou diverge) e Mensagens de Gwaihir (`passagens` recolhidas por padrão).
6. **F5 — Acessibilidade e capturas (`4812323`, Galadriel · Flash medium):** Suíte `painelA11y.test.tsx` (38 testes cobrindo D05, oráculo WCAG AA `>= 4.5:1`, semântica ícone+rótulo e estados `carregando`, `vazio`, `erro`, `parcial`, `sucesso`) e 6 capturas Playwright em `1280x800` e `360x820`.

## Evidências

### 1. Portão por fatia e consolidado (`sc.py entregar`)
- **F1 (`5941f22`):** `atestado-p2-leitura-F1.json` — APROVADO (140 testes, 0 falhos)
- **F2 (`821a0de`):** `atestado-p2-leitura-F2.json` — APROVADO (156 testes, 0 falhos)
- **F3 (`07f105a`):** `atestado-p2-leitura-F3.json` — APROVADO (166 testes, 0 falhos) + Revisão interna Galadriel APROVADA
- **F4 (`1251e86`):** `atestado-p2-leitura-F4.json` — APROVADO (174 testes, 0 falhos)
- **F5 (`4812323`):** `atestado-p2-leitura-F5.json` — APROVADO (212 testes, 0 falhos)
- **Consolidado (`00970bc..4812323`):** `sociedade/pareceres/atestado-p2-leitura.json` — APROVADO (8/8 verificações OK, 31 arquivos inspecionados, 22 suítes Vitest / 212 testes verdes, `tsc --noEmit` e `npm run build` limpos)
- **Disjunção (`verificar_disjuncao.py`):** `disjunto: 5 executores, 19 caminhos, nenhum cruzamento`

### 2. Saída do Teste-Ouro (`loja-exemplo/e3-carrinho`, seção 5.3)
```text
Para: coordenador (Antigravity, Gemini 3.8 Flash, esforço medium) · Etapa: e3-carrinho · CONVERSA NOVA
Worktree: ~/.sociedade/trabalho/loja-exemplo/e3-carrinho
Escala: papel=coordenador, plataforma=Antigravity, modelo=Gemini 3.8 Flash, esforço=medium, subagentes: alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash
Assumir: sc.py assumir coordenador --etapa e3-carrinho --plataforma "Antigravity" --modelo "Gemini 3.8 Flash" --esforco "medium" --subagentes "alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash"
Ação: leia a ordem da etapa (sociedade/ordens/e3-carrinho.md).
```

### 3. Capturas Playwright (`npx playwright test` — 6 passed)
- `e2e/capturas/conselho-1280x800.png` (175.622 bytes)
- `e2e/capturas/conselho-360x820.png` (62.479 bytes)
- `e2e/capturas/regioes-1280x800.png` (125.505 bytes)
- `e2e/capturas/regioes-360x820.png` (57.990 bytes)
- `e2e/capturas/palantir-1280x800.png` (130.848 bytes)
- `e2e/capturas/palantir-360x820.png` (36.349 bytes)

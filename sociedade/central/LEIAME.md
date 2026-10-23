# Contrato do painel

- `painel-1.schema.json`: cópia byte a byte de `sociedade/central/painel-1.schema.json` do pacote (`sociedade_do_codigo`, `origin/main` em 61b93e6, 22/10/2026). SHA-256: `fdf345d7dbfd654e8cd64f2f432b500ae02a5de2004af553148a63c4e7d56a2c`. Ainda é rascunho; congela na etapa B do pacote (Q190).
- `painel-1.exemplo.json`: instantâneo **fictício** (projetos, pastas e máquina inventados), válido contra o esquema. Cobre os casos que o painel precisa mostrar: etapa em revisão com passagens, pendências de vários tipos, instalação defasada, clone suspeito e um projeto só com desconhecidos.

Só a governança muda estes arquivos (D06). As cópias usadas pelo app e pela Edge Function são conferidas por teste contra estes.

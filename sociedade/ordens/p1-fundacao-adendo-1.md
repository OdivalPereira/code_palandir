# Adendo 1 à ordem p1-fundacao — portas próprias e convivência com o account_palandir

Para: Gandalf (Antigravity, Gemini 4 Argon, esforço high) · De: Círdan · Etapa: p1-fundacao
Situação: o Supabase local do **account_palandir** está rodando nas portas padrão (54321 a 54329), com a Sociedade trabalhando nele. A p1 não pode disputar essas portas.
Feito: este adendo, que vale junto com a ordem e não muda o escopo.
Pendente ou decisão: nenhuma.
Próximo passo: aplicar as regras abaixo na F1 e na F4.
Detalhe: este arquivo.

## Regras
1. **F1, `supabase/config.toml`:** `project_id = "code_palandir"` e todas as portas na faixa 553xx:
   - API 55321, banco 55322, Studio 55323, e-mail de teste 55324;
   - as demais portas do arquivo também na faixa 553xx (por exemplo, analytics 55327, pooler 55329, shadow DB 55320).
   - Aceite (E): `supabase start` sobe ao lado do account_palandir sem conflito.
2. **F3 e F4:** a URL local da `ingest` e do banco é `http://127.0.0.1:55321`. Os scripts e o teste de integração aceitam só `127.0.0.1` e `localhost`.
3. **Nunca** pare, reinicie, remova nem altere containers, volumes ou redes de outro projeto. Isso vale para `supabase stop --all`, `docker stop`, `docker rm`, `docker system prune` e `docker volume rm`. Só os do `project_id = "code_palandir"`. Se uma porta estiver ocupada, pare a fatia e devolva ao Círdan.
4. Os testes da etapa sobem e derrubam só o Supabase deste projeto (`supabase start`/`stop` dentro do worktree).

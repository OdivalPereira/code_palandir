# Code Palandir

## Configuração de variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example` e ajuste os valores conforme o seu ambiente.

### Google AI (Gemini)

1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey) e gere uma API key.
2. Copie a chave gerada e preencha `GOOGLE_AI_API_KEY`.
3. Opcional: ajuste `GOOGLE_AI_MODEL_ID` para o modelo desejado (ex.: `gemini-2.5-flash`).
4. Defina `AI_PROVIDER` como `google` para usar a API Gemini.

### GitHub OAuth

1. Acesse **GitHub > Settings > Developer settings > OAuth Apps**.
2. Clique em **New OAuth App**.
3. Preencha:
   - **Application name**: nome livre.
   - **Homepage URL**: URL do seu front-end (ex.: `http://localhost:8080`).
   - **Authorization callback URL**: `GITHUB_OAUTH_CALLBACK_URL` (ex.: `http://localhost:8787/api/auth/callback`).
4. Após criar o app, copie **Client ID** e **Client Secret** para `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`.

### Observação sobre CORS

O backend aplica CORS usando `APP_BASE_URL`. Para evitar bloqueios:

- Execute o front-end na **mesma origem** do backend quando possível (mesmo domínio/porta), **ou**
- Configure `APP_BASE_URL` com a URL exata onde o front-end está rodando.

Se `APP_BASE_URL` não corresponder à origem do navegador, as requisições podem ser bloqueadas por CORS.

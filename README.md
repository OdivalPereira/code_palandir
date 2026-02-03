# Code Palandir

## Como rodar o projeto

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor:
   ```bash
   # Porta padrão do backend: 8787
   npm run server
   ```
3. Em outro terminal, rode o front-end:
   ```bash
   # Porta padrão do Vite: 5174
   npm run dev
   ```

## Instalação limpa

Se você suspeitar de problemas com dependências ou lockfile, faça uma instalação limpa:

1. Remova dependências e o lockfile:
   ```bash
   rm -rf node_modules package-lock.json
   ```
2. (Opcional) Limpe o cache do npm:
   ```bash
   npm cache clean --force
   ```
3. Reinstale as dependências:
   ```bash
   npm install
   # ou, se preferir reproduzir o lockfile existente:
   npm ci
   ```

**Erros comuns**

- **Lockfile corrompido**: remova `package-lock.json` e refaça a instalação.
- **Versões de Node incompatíveis**: verifique se sua versão do Node é compatível com o projeto e com as dependências (ex.: pacotes exigindo Node 18+).

### Smoke test (API)

Com o backend rodando, execute:

```bash
npm run smoke-test
```

Por padrão, o script usa `SERVER_BASE_URL` (ou `http://localhost:8787` se não estiver definido). Para apontar para outra base, defina `SMOKE_TEST_BASE_URL`:

```bash
SMOKE_TEST_BASE_URL=http://localhost:8787 npm run smoke-test
```

### Portas padrão recomendadas

- **Backend**: `8787`
- **Vite**: `5174`

### Proxy do Vite e WebSocket

O front-end utiliza o proxy do Vite para encaminhar chamadas REST para `/api` até o backend e também para o WebSocket em `/realtime`. Mantenha o servidor rodando para que essas rotas funcionem corretamente no ambiente local.

## Configuração de variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example` e ajuste os valores conforme o seu ambiente.

### Variáveis obrigatórias

Estas variáveis precisam estar presentes para o backend iniciar:

- `APP_BASE_URL` (ex.: `http://localhost:5174`)
- `SERVER_BASE_URL` (ex.: `http://localhost:8787`)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_OAUTH_CALLBACK_URL` (ex.: `http://localhost:8787/api/auth/callback`)

Quando `AI_PROVIDER=google`, também são obrigatórias:

- `AI_PROVIDER=google`
- `GOOGLE_AI_API_KEY`

Exemplo de `.env` mínimo:

```bash
APP_BASE_URL=http://localhost:5174
SERVER_BASE_URL=http://localhost:8787
GITHUB_CLIENT_ID=seu_client_id
GITHUB_CLIENT_SECRET=seu_client_secret
GITHUB_OAUTH_CALLBACK_URL=http://localhost:8787/api/auth/callback
```

Exemplo adicional para Google AI:

```bash
AI_PROVIDER=google
GOOGLE_AI_API_KEY=sua_chave_google
GOOGLE_AI_MODEL_ID=gemini-2.5-flash
```

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
   - **Homepage URL**: URL do seu front-end (ex.: `http://localhost:5174`).
   - **Authorization callback URL**: `GITHUB_OAUTH_CALLBACK_URL` (ex.: `http://localhost:8787/api/auth/callback`).
4. Após criar o app, copie **Client ID** e **Client Secret** para `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`.

### Observação sobre CORS

O backend aplica CORS usando `APP_BASE_URL`. Para evitar bloqueios:

- Execute o front-end na **mesma origem** do backend quando possível (mesmo domínio/porta), **ou**
- Configure `APP_BASE_URL` com a URL exata onde o front-end está rodando.

Se `APP_BASE_URL` não corresponder à origem do navegador, as requisições podem ser bloqueadas por CORS.

## Troubleshooting

- **401 ao usar IA**: faça login antes de usar recursos de IA.
- **500 ao chamar o cliente de IA**: verifique se a chave do provedor (ex.: `GOOGLE_AI_API_KEY`) está configurada.
- **Erro do GitHub**: pode ser rate limit ou branch default não configurada. Verifique a autenticação, limite de requisições e se o repositório possui uma branch padrão.

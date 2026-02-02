import crypto from 'crypto';
import http from 'http';
import { URL } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const port = Number(process.env.PORT ?? 8787);
const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5173';
const serverBaseUrl = process.env.SERVER_BASE_URL ?? `http://localhost:${port}`;
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const githubCallbackUrl =
  process.env.GITHUB_OAUTH_CALLBACK_URL ?? `${serverBaseUrl}/api/auth/callback`;
const aiApiKey = process.env.GOOGLE_AI_API_KEY ?? '';
const aiModelId = process.env.GOOGLE_AI_MODEL_ID ?? 'gemini-2.5-flash';
const aiRequestLimit = Number(process.env.AI_RATE_LIMIT_MAX ?? '30');
const aiRequestWindowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS ?? '300000');

const sessions = new Map();
const rateLimits = new Map();
const aiClient = aiApiKey ? new GoogleGenAI({ apiKey: aiApiKey, vertexai: true }) : null;

const buildSetCookieHeader = ({ name, value, maxAge }) => {
  const pieces = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    `SameSite=Lax`,
  ];

  if (process.env.NODE_ENV === 'production') {
    pieces.push('Secure');
  }

  if (typeof maxAge === 'number') {
    pieces.push(`Max-Age=${maxAge}`);
  }

  return pieces.join('; ');
};

const parseCookies = (cookieHeader = '') =>
  Object.fromEntries(
    cookieHeader
      .split(';')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf('=');
        if (index === -1) {
          return [cookie, ''];
        }
        return [cookie.slice(0, index), cookie.slice(index + 1)];
      }),
  );

const jsonResponse = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let buffer = '';
    req.on('data', (chunk) => {
      buffer += chunk;
      if (buffer.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!buffer) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(buffer));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const getJsonPayload = async (req, res) => {
  try {
    return await readJsonBody(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    if (message === 'Payload too large') {
      jsonResponse(res, 413, { error: 'Payload too large.' });
    } else {
      jsonResponse(res, 400, { error: 'Invalid JSON.' });
    }
    return null;
  }
};

const redirectResponse = (res, location) => {
  res.writeHead(302, { Location: location });
  res.end();
};

const withCors = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', appBaseUrl);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return false;
  }

  return true;
};

const getSession = (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  let sessionId = cookies.sid;

  if (sessionId && sessions.has(sessionId)) {
    return { id: sessionId, data: sessions.get(sessionId) };
  }

  sessionId = crypto.randomUUID();
  const data = {};
  sessions.set(sessionId, data);

  res.setHeader('Set-Cookie', buildSetCookieHeader({ name: 'sid', value: sessionId }));

  return { id: sessionId, data };
};

const requireAuthenticatedSession = (req, res) => {
  const session = getSession(req, res);
  if (!session.data.accessToken) {
    jsonResponse(res, 401, { error: 'Authentication required.' });
    return null;
  }
  return session;
};

const checkRateLimit = (req, res, sessionId) => {
  const key = sessionId ?? req.socket.remoteAddress ?? 'anonymous';
  const now = Date.now();
  const existing = rateLimits.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + aiRequestWindowMs });
    return true;
  }
  if (existing.count >= aiRequestLimit) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    jsonResponse(res, 429, { error: 'Rate limit exceeded.' });
    return false;
  }
  existing.count += 1;
  rateLimits.set(key, existing);
  return true;
};

const clearSession = (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.sid;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.setHeader('Set-Cookie', buildSetCookieHeader({ name: 'sid', value: '', maxAge: 0 }));
};

const handleLogin = (req, res) => {
  if (!githubClientId) {
    res.writeHead(500);
    res.end('Missing GITHUB_CLIENT_ID.');
    return;
  }

  const session = getSession(req, res);
  const state = crypto.randomUUID();
  session.data.oauthState = state;

  const params = new URLSearchParams({
    client_id: githubClientId,
    redirect_uri: githubCallbackUrl,
    state,
    scope: 'read:user repo',
  });

  redirectResponse(res, `https://github.com/login/oauth/authorize?${params.toString()}`);
};

const handleCallback = async (req, res, url) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    res.writeHead(400);
    res.end('Missing OAuth code or state.');
    return;
  }

  const session = getSession(req, res);
  if (state !== session.data.oauthState) {
    res.writeHead(403);
    res.end('Invalid OAuth state.');
    return;
  }

  if (!githubClientId || !githubClientSecret) {
    res.writeHead(500);
    res.end('Missing GitHub OAuth configuration.');
    return;
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: githubClientId,
      client_secret: githubClientSecret,
      code,
      redirect_uri: githubCallbackUrl,
    }),
  });

  if (!tokenResponse.ok) {
    res.writeHead(502);
    res.end('Failed to exchange OAuth token.');
    return;
  }

  const payload = await tokenResponse.json();

  if (payload.error) {
    res.writeHead(400);
    res.end(payload.error_description ?? 'OAuth error.');
    return;
  }

  session.data.accessToken = payload.access_token ?? null;
  delete session.data.oauthState;

  redirectResponse(res, `${appBaseUrl}/?auth=success`);
};

const handleLogout = (req, res) => {
  clearSession(req, res);
  res.writeHead(204);
  res.end();
};

const handleSession = (req, res) => {
  const session = getSession(req, res);
  jsonResponse(res, 200, {
    accessToken: session.data.accessToken ?? null,
    isAuthenticated: Boolean(session.data.accessToken),
  });
};

const handleAiAnalyzeFile = async (req, res, session) => {
  if (!aiClient) {
    jsonResponse(res, 500, { error: 'AI client not configured.' });
    return;
  }
  if (!checkRateLimit(req, res, session.id)) {
    return;
  }
  const payload = await getJsonPayload(req, res);
  if (!payload) {
    return;
  }
  const code = payload?.code;
  const filename = payload?.filename;

  if (typeof code !== 'string' || typeof filename !== 'string') {
    jsonResponse(res, 400, { error: 'Invalid payload.' });
    return;
  }

  const prompt = `
    Analyze the source code of ${filename}.
    Extract the top-level structure: classes, functions, exported variables, and API endpoints.
    Return a list of these elements.
    For each, provide a brief description and the signature/snippet.
  `;

  const response = await aiClient.models.generateContent({
    model: aiModelId,
    contents: {
      role: 'user',
      parts: [
        { text: prompt },
        { text: `CODE:\n${code.slice(0, 20000)}` },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['function', 'class', 'variable', 'api_endpoint'] },
            codeSnippet: { type: Type.STRING },
            description: { type: Type.STRING },
          },
        },
      },
    },
  });

  if (!response.text) {
    jsonResponse(res, 200, { nodes: [] });
    return;
  }
  jsonResponse(res, 200, { nodes: JSON.parse(response.text) });
};

const handleAiRelevantFiles = async (req, res, session) => {
  if (!aiClient) {
    jsonResponse(res, 500, { error: 'AI client not configured.' });
    return;
  }
  if (!checkRateLimit(req, res, session.id)) {
    return;
  }
  const payload = await getJsonPayload(req, res);
  if (!payload) {
    return;
  }
  const query = payload?.query;
  const filePaths = payload?.filePaths;

  if (typeof query !== 'string' || !Array.isArray(filePaths)) {
    jsonResponse(res, 400, { error: 'Invalid payload.' });
    return;
  }

  const prompt = `
    I have a project with the following file structure.
    User Query: "${query}"
    
    Identify which files are likely to contain the logic relevant to the query.
    Return a list of file paths.
  `;

  const response = await aiClient.models.generateContent({
    model: aiModelId,
    contents: {
      role: 'user',
      parts: [
        { text: prompt },
        { text: `FILES:\n${filePaths.join('\n')}` },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          relevantFiles: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  if (!response.text) {
    jsonResponse(res, 200, { relevantFiles: [] });
    return;
  }
  const parsed = JSON.parse(response.text);
  jsonResponse(res, 200, { relevantFiles: parsed.relevantFiles ?? [] });
};

const server = http.createServer(async (req, res) => {
  if (!withCors(req, res)) {
    return;
  }

  const url = new URL(req.url ?? '/', serverBaseUrl);

  if (req.method === 'GET' && url.pathname === '/api/auth/login') {
    handleLogin(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/callback') {
    try {
      await handleCallback(req, res, url);
    } catch (error) {
      console.error('OAuth callback error', error);
      res.writeHead(500);
      res.end('Unexpected OAuth error.');
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    handleLogout(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/session') {
    handleSession(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/analyze-file') {
    try {
      const session = requireAuthenticatedSession(req, res);
      if (!session) return;
      await handleAiAnalyzeFile(req, res, session);
    } catch (error) {
      console.error('AI analyze error', error);
      jsonResponse(res, 500, { error: 'AI analysis failed.' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/relevant-files') {
    try {
      const session = requireAuthenticatedSession(req, res);
      if (!session) return;
      await handleAiRelevantFiles(req, res, session);
    } catch (error) {
      console.error('AI relevance error', error);
      jsonResponse(res, 500, { error: 'AI relevance failed.' });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});

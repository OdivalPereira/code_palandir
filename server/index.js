import crypto from 'crypto';
import http from 'http';
import { URL } from 'url';

const port = Number(process.env.PORT ?? 8787);
const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5173';
const serverBaseUrl = process.env.SERVER_BASE_URL ?? `http://localhost:${port}`;
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const githubCallbackUrl =
  process.env.GITHUB_OAUTH_CALLBACK_URL ?? `${serverBaseUrl}/api/auth/callback`;

const sessions = new Map();

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

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});

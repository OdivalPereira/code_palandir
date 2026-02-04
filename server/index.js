import 'dotenv/config';
import crypto from 'crypto';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { URL, fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Type } from '@google/genai';
import {
  AI_REQUEST_SCHEMA,
  AiTimeoutError,
  createAiClient,
  extractUsageTokens,
  generateJsonResponse,
  normalizeAiProvider,
  withRetryAndTimeout,
} from './ai-client.js';

const port = Number(process.env.PORT ?? 3000);
const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5174';
const serverBaseUrl = process.env.SERVER_BASE_URL ?? `http://localhost:${port}`;
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const githubCallbackUrl =
  process.env.GITHUB_OAUTH_CALLBACK_URL ?? `${serverBaseUrl}/api/auth/callback`;
const recommendedGoogleAiModelId = 'gemini-2.5-flash';
const aiApiKey = process.env.GOOGLE_AI_API_KEY ?? '';
const aiModelId = process.env.GOOGLE_AI_MODEL_ID ?? recommendedGoogleAiModelId;
const aiProvider = normalizeAiProvider(process.env.AI_PROVIDER);
const aiRequestLimit = Number(process.env.AI_RATE_LIMIT_MAX ?? '30');
const aiRequestWindowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS ?? '300000');
const indexingPollIntervalMs = Number(process.env.INDEXING_POLL_INTERVAL_MS ?? '5000');
const indexingJobDurationMs = Number(process.env.INDEXING_JOB_DURATION_MS ?? '1000');
const aiPromptCostPer1k = Number(process.env.AI_COST_PROMPT_PER_1K ?? '0');
const aiOutputCostPer1k = Number(process.env.AI_COST_OUTPUT_PER_1K ?? '0');

const validateEnv = () => {
  const errors = [];
  const requireValue = (name, value) => {
    if (!value || String(value).trim().length === 0) {
      errors.push(`${name} é obrigatório.`);
    }
  };
  const requireUrl = (name, value) => {
    requireValue(name, value);
    if (!value) return;
    try {
      new URL(value);
    } catch (error) {
      errors.push(`${name} deve ser uma URL válida.`);
    }
  };

  requireUrl('APP_BASE_URL', process.env.APP_BASE_URL);
  requireUrl('SERVER_BASE_URL', process.env.SERVER_BASE_URL);
  requireValue('GITHUB_CLIENT_ID', process.env.GITHUB_CLIENT_ID);
  requireValue('GITHUB_CLIENT_SECRET', process.env.GITHUB_CLIENT_SECRET);
  requireUrl('GITHUB_OAUTH_CALLBACK_URL', process.env.GITHUB_OAUTH_CALLBACK_URL);

  if (aiProvider === 'google') {
    requireValue('AI_PROVIDER', process.env.AI_PROVIDER);
    requireValue('GOOGLE_AI_API_KEY', process.env.GOOGLE_AI_API_KEY);
    if (
      process.env.GOOGLE_AI_MODEL_ID &&
      process.env.GOOGLE_AI_MODEL_ID !== recommendedGoogleAiModelId
    ) {
      console.warn(
        `GOOGLE_AI_MODEL_ID diferente do recomendado para produção (${recommendedGoogleAiModelId}).`,
      );
    }
  }

  if (errors.length > 0) {
    const message = `Configuração de ambiente inválida:\n- ${errors.join('\n- ')}`;
    console.error(message);
    process.exit(1);
  }
};

validateEnv();

const sessions = new Map();
const rateLimits = new Map();
const aiClient = aiApiKey ? createAiClient({ apiKey: aiApiKey, provider: aiProvider }) : null;
const indexingJobs = new Map();
let isIndexingWorkerRunning = false;
const savedSessions = new Map();
const realtimeSessions = new Map();
const SESSION_SCHEMA_VERSION = 1;
const PROJECT_SUMMARY_PROMPT_BASE = `Você é um arquiteto de software. Com base nos inputs fornecidos (arquivos e grafo),
gere uma visão geral do projeto.

Requisitos:
- Produza um resumo claro (até 8 frases) descrevendo propósito, módulos principais e fluxos críticos.
- Produza um diagrama lógico em Mermaid usando flowchart TD.
- Responda em pt-br.
- Retorne apenas JSON válido conforme o schema, sem markdown ou explicações extras.`;

const buildIntentPrompt = ({ uiSchema, existingInfrastructure }) => `You are a backend architect analyzing a React frontend component.

COMPONENT: ${uiSchema.component}
FIELDS: ${JSON.stringify(uiSchema.fields, null, 2)}
ACTIONS: ${JSON.stringify(uiSchema.actions, null, 2)}
DATA FLOW: ${JSON.stringify(uiSchema.dataFlow, null, 2)}
HOOKS USED: ${(uiSchema.hooks ?? []).join(', ')}
EXISTING INFRASTRUCTURE: ${existingInfrastructure.length > 0 ? existingInfrastructure.join(', ') : 'None detected'}

Based on this frontend component, determine what backend infrastructure is needed to make it fully functional:

1. **Database Tables**: What tables are needed? Include columns with types.
2. **API Endpoints**: What endpoints are required? Include HTTP methods and paths.
3. **Services**: What external services are needed? (auth, email, storage, etc.)

Be practical and suggest ONLY what's necessary for this specific component to function.
Use common conventions (e.g., REST paths, PostgreSQL types for Supabase).`;

const getStackInstructions = (stack) => {
  const instructions = {
    supabase: `Use Supabase patterns:
- Database: PostgreSQL with RLS policies
- Auth: Supabase Auth with email/password
- API: Supabase Edge Functions (Deno) or direct client calls
- Storage: Supabase Storage for files`,
    firebase: `Use Firebase patterns:
- Database: Firestore with security rules
- Auth: Firebase Auth with email/password
- API: Cloud Functions (Node.js)
- Storage: Firebase Storage for files`,
    express: `Use Express.js patterns:
- Database: PostgreSQL with Prisma ORM
- Auth: JWT with bcrypt
- API: Express routes with middleware
- Validation: Zod schemas`,
    nextjs: `Use Next.js patterns:
- Database: Prisma with PostgreSQL
- Auth: NextAuth.js or Clerk
- API: API Routes or Server Actions
- Validation: Zod schemas`,
  };

  return instructions[stack] || instructions.supabase;
};

const formatFields = (fields) => {
  if (!Array.isArray(fields) || fields.length === 0) return '- No form fields detected';
  return fields
    .map(
      (field) =>
        `- **${field.name}** (${field.type})${field.required ? ' [required]' : ''}${field.validation ? ` [${field.validation}]` : ''}`,
    )
    .join('\n');
};

const formatActions = (actions) => {
  if (!Array.isArray(actions) || actions.length === 0) return '- No actions detected';
  return actions
    .map(
      (action) =>
        `- **${action.type}**: ${action.handler}${action.label ? ` ("${action.label}")` : ''}${action.apiCall ? ` → ${action.apiCall}` : ''}`,
    )
    .join('\n');
};

const formatTables = (tables) => {
  if (!Array.isArray(tables) || tables.length === 0) return '- No tables required';
  return tables
    .map((table) => {
      const cols = Array.isArray(table.columns)
        ? table.columns.map((col) => `${col.name}: ${col.type}`).join(', ')
        : '';
      return `- **${table.name}**: ${cols}`;
    })
    .join('\n');
};

const formatEndpoints = (endpoints) => {
  if (!Array.isArray(endpoints) || endpoints.length === 0) return '- No endpoints required';
  return endpoints
    .map((endpoint) => `- \`${endpoint.method} ${endpoint.path}\`: ${endpoint.description || ''}`)
    .join('\n');
};

const formatServices = (services) => {
  if (!Array.isArray(services) || services.length === 0) return '- No additional services required';
  return services
    .map((service) => `- **${service.name}** (${service.type}): ${service.description}`)
    .join('\n');
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isAiTimeoutError = (error) => error instanceof AiTimeoutError;
const getAiErrorMessage = (error, fallback = 'Unknown AI error') => {
  if (isAiTimeoutError(error)) {
    return 'A requisição para a IA expirou. Tente novamente.';
  }
  return error instanceof Error ? error.message : fallback;
};
const getAiErrorStatus = (error) => (isAiTimeoutError(error) ? 504 : 500);

const collectValidationErrors = (checks) =>
  checks.flatMap((check) => (check.ok ? [] : [check.message]));

const validateGeneratePromptPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return ['Payload inválido. Envie um objeto JSON.'];
  }
  const errors = collectValidationErrors([
    {
      ok: isNonEmptyString(payload.task),
      message: 'task é obrigatório e deve ser uma string.',
    },
    {
      ok: payload.context === undefined || typeof payload.context === 'string',
      message: 'context deve ser uma string quando fornecido.',
    },
    {
      ok: payload.files === undefined || Array.isArray(payload.files),
      message: 'files deve ser um array de strings quando fornecido.',
    },
  ]);

  if (Array.isArray(payload.files)) {
    const invalidFile = payload.files.find((file) => typeof file !== 'string');
    if (invalidFile !== undefined) {
      errors.push('files deve conter apenas strings.');
    }
  }

  return errors;
};

const validateAiChatPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return ['Payload inválido. Envie um objeto JSON.'];
  }
  const validModes = ['explore', 'create', 'alter', 'fix', 'connect', 'ask'];
  const errors = collectValidationErrors([
    {
      ok: isNonEmptyString(payload.mode) && validModes.includes(payload.mode),
      message: `mode é obrigatório e deve ser um destes: ${validModes.join(', ')}.`,
    },
    {
      ok: isNonEmptyString(payload.userMessage),
      message: 'userMessage é obrigatório e deve ser uma string.',
    },
    {
      ok: payload.projectContext === undefined || typeof payload.projectContext === 'string',
      message: 'projectContext deve ser uma string quando fornecido.',
    },
    {
      ok: payload.conversationHistory === undefined || Array.isArray(payload.conversationHistory),
      message: 'conversationHistory deve ser um array quando fornecido.',
    },
    {
      ok: payload.element === undefined || (payload.element && typeof payload.element === 'object'),
      message: 'element deve ser um objeto quando fornecido.',
    },
  ]);

  if (Array.isArray(payload.conversationHistory)) {
    payload.conversationHistory.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        errors.push(`conversationHistory[${index}] deve ser um objeto com role e content.`);
        return;
      }
      if (!isNonEmptyString(entry.role)) {
        errors.push(`conversationHistory[${index}].role deve ser uma string.`);
      }
      if (!isNonEmptyString(entry.content)) {
        errors.push(`conversationHistory[${index}].content deve ser uma string.`);
      }
    });
  }

  if (payload.element !== undefined) {
    const { element } = payload;
    if (!element || typeof element !== 'object') {
      errors.push('element deve ser um objeto com name, type e path.');
    } else {
      if (!isNonEmptyString(element.name)) {
        errors.push('element.name é obrigatório e deve ser uma string.');
      }
      if (!isNonEmptyString(element.type)) {
        errors.push('element.type é obrigatório e deve ser uma string.');
      }
      if (!isNonEmptyString(element.path)) {
        errors.push('element.path é obrigatório e deve ser uma string.');
      }
    }
  }

  return errors;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexingStorePath = path.join(__dirname, 'indexing-store.json');
const sessionStorePath = path.join(__dirname, 'session-store.json');
const aiAuditLogPath = path.join(__dirname, 'ai-audit-log.jsonl');

const isFiniteNumber = (value) => Number.isFinite(value);

const estimateAiCostUsd = (usage) => {
  if (!usage) return null;
  const promptTokens = usage.promptTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  if (!isFiniteNumber(promptTokens) && !isFiniteNumber(outputTokens)) return null;
  const promptCost = isFiniteNumber(promptTokens)
    ? (promptTokens / 1000) * aiPromptCostPer1k
    : 0;
  const outputCost = isFiniteNumber(outputTokens)
    ? (outputTokens / 1000) * aiOutputCostPer1k
    : 0;
  const total = promptCost + outputCost;
  return Number.isFinite(total) ? Number(total.toFixed(6)) : null;
};

const appendAiAuditLog = async (record) => {
  try {
    await fs.appendFile(aiAuditLogPath, `${JSON.stringify(record)}\n`);
  } catch (error) {
    console.error('Failed to append AI audit log', error);
  }
};

const readAiAuditLog = async () => {
  try {
    const content = await fs.readFile(aiAuditLogPath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    console.error('Failed to read AI audit log', error);
    return [];
  }
};

const readIndexingStore = async () => {
  try {
    const content = await fs.readFile(indexingStorePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.jobs)) {
      parsed.jobs.forEach((job) => {
        if (job?.id) {
          const normalizedJob =
            job.status === 'in_progress'
              ? { ...job, status: 'pending', updatedAt: new Date().toISOString() }
              : job;
          indexingJobs.set(job.id, normalizedJob);
        }
      });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('Failed to read indexing store', error);
    }
  }
};

const persistIndexingStore = async () => {
  const payload = {
    jobs: Array.from(indexingJobs.values()),
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(indexingStorePath, JSON.stringify(payload, null, 2));
};

const readSessionStore = async () => {
  try {
    const content = await fs.readFile(sessionStorePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.sessions)) {
      parsed.sessions.forEach((entry) => {
        if (entry?.id && entry?.session) {
          savedSessions.set(entry.id, entry);
        }
      });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('Failed to read session store', error);
    }
  }
};

const persistSessionStore = async () => {
  const payload = {
    sessions: Array.from(savedSessions.values()),
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(sessionStorePath, JSON.stringify(payload, null, 2));
};

const ensureRealtimeSession = (sessionId) => {
  const existing = realtimeSessions.get(sessionId);
  if (existing) return existing;
  const session = { presence: new Map(), sockets: new Set() };
  realtimeSessions.set(sessionId, session);
  return session;
};

const serializePresence = (presenceMap) => Array.from(presenceMap.values());

const broadcastRealtime = (sessionId, payload, excludeSocket) => {
  const session = realtimeSessions.get(sessionId);
  if (!session) return;
  const message = JSON.stringify(payload);
  session.sockets.forEach((socket) => {
    if (excludeSocket && socket === excludeSocket) return;
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  });
};

const updateJob = async (jobId, updates) => {
  const existing = indexingJobs.get(jobId);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  indexingJobs.set(jobId, updated);
  await persistIndexingStore();
  return updated;
};

const runIndexingJob = async (job) => {
  await updateJob(job.id, { status: 'in_progress' });
  try {
    await new Promise((resolve) => setTimeout(resolve, indexingJobDurationMs));
    await updateJob(job.id, { status: 'ok', error: null, completedAt: new Date().toISOString() });
  } catch (error) {
    await updateJob(job.id, {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

const processIndexingQueue = async () => {
  if (isIndexingWorkerRunning) return;
  const nextJob = Array.from(indexingJobs.values()).find((job) => job.status === 'pending');
  if (!nextJob) return;
  isIndexingWorkerRunning = true;
  try {
    await runIndexingJob(nextJob);
  } finally {
    isIndexingWorkerRunning = false;
  }
};

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

const withRequestId = (payload, requestId) => (
  requestId ? { ...payload, requestId } : payload
);

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

const getJsonPayload = async (req, res, requestId) => {
  try {
    return await readJsonBody(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    if (message === 'Payload too large') {
      jsonResponse(res, 413, withRequestId({ error: 'Payload too large.' }, requestId));
    } else {
      jsonResponse(res, 400, withRequestId({ error: 'Invalid JSON.' }, requestId));
    }
    return null;
  }
};

const migrateSessionPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const rawVersion = payload.schemaVersion ?? 0;
  const schemaVersion = Number(rawVersion);
  if (!Number.isFinite(schemaVersion)) return null;
  if (schemaVersion > SESSION_SCHEMA_VERSION) return null;
  if (schemaVersion === SESSION_SCHEMA_VERSION) {
    return payload;
  }
  if (schemaVersion === 0) {
    return {
      ...payload,
      schemaVersion: SESSION_SCHEMA_VERSION,
    };
  }
  return null;
};

const isValidSessionPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.schemaVersion !== 'number') return false;
  if (!payload.graph || typeof payload.graph !== 'object') return false;
  if (!payload.selection || typeof payload.selection !== 'object') return false;
  if (!Array.isArray(payload.prompts)) return false;

  const { graph, selection, prompts } = payload;
  if (!Array.isArray(graph.highlightedPaths)) return false;
  if (!Array.isArray(graph.expandedDirectories)) return false;
  if (!('rootNode' in graph)) return false;
  if (!('selectedNodeId' in selection)) return false;

  if ('layout' in payload && payload.layout !== null && payload.layout !== undefined) {
    if (!payload.layout || typeof payload.layout !== 'object') return false;
    if (typeof payload.layout.graphHash !== 'string') return false;
    if (!payload.layout.positions || typeof payload.layout.positions !== 'object') return false;
    const positions = payload.layout.positions;
    const positionValues = Object.values(positions);
    if (positionValues.some((position) => (
      !position
      || typeof position !== 'object'
      || typeof position.x !== 'number'
      || typeof position.y !== 'number'
    ))) {
      return false;
    }
  }

  return prompts.every((item) => {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.id !== 'string') return false;
    if (typeof item.title !== 'string') return false;
    if (typeof item.content !== 'string') return false;
    return item.type === 'code' || item.type === 'comment' || item.type === 'context';
  });
};

const extractSessionPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.session && typeof payload.session === 'object') {
    return {
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : null,
      session: payload.session,
    };
  }
  return {
    sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : null,
    session: payload,
  };
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

const requireAuthenticatedSession = (req, res, requestId) => {
  const session = getSession(req, res);
  if (!session.data.accessToken) {
    jsonResponse(res, 401, withRequestId({ error: 'Authentication required.' }, requestId));
    return null;
  }
  return session;
};

const checkRateLimit = (req, res, sessionId, requestId) => {
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
    jsonResponse(res, 429, withRequestId({ error: 'Rate limit exceeded.' }, requestId));
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

const handleUserRepos = async (req, res, session) => {
  const accessToken = session.data.accessToken;
  if (!accessToken) {
    jsonResponse(res, 401, { error: 'Not authenticated.' });
    return;
  }
  try {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      jsonResponse(res, response.status, { error: 'Failed to fetch repositories.' });
      return;
    }
    const repos = await response.json();
    const result = repos.map((repo) => ({
      full_name: repo.full_name,
      name: repo.name,
      owner: repo.owner?.login ?? '',
      description: repo.description ?? '',
      updated_at: repo.updated_at,
      private: repo.private ?? false,
    }));
    jsonResponse(res, 200, { repos: result });
  } catch (error) {
    console.error('Failed to fetch user repos', error);
    jsonResponse(res, 500, { error: 'Unexpected error fetching repos.' });
  }
};

const handleSession = (req, res) => {
  const session = getSession(req, res);
  jsonResponse(res, 200, {
    accessToken: session.data.accessToken ?? null,
    isAuthenticated: Boolean(session.data.accessToken),
  });
};

const handleAiAnalyzeFile = async (req, res, session, requestId) => {
  if (!aiClient) {
    jsonResponse(res, 500, withRequestId({ error: 'AI client not configured.' }, requestId));
    return;
  }
  if (!checkRateLimit(req, res, session.id, requestId)) {
    return;
  }
  const payload = await getJsonPayload(req, res, requestId);
  if (!payload) {
    return;
  }
  const code = payload?.code;
  const filename = payload?.filename;

  if (typeof code !== 'string' || typeof filename !== 'string') {
    jsonResponse(res, 400, withRequestId({ error: 'Invalid payload.' }, requestId));
    return;
  }

  const requestType = AI_REQUEST_SCHEMA.analyzeFile.prompt.id;
  const startedAt = Date.now();
  let response = null;
  let error = null;
  let errorMessage = null;
  try {
    response = await generateJsonResponse({
      client: aiClient,
      model: aiModelId,
      type: requestType,
      params: {
        filename,
        code: code.slice(0, 20000),
      },
    });
  } catch (caughtError) {
    error = caughtError;
    errorMessage = getAiErrorMessage(caughtError);
  }

  const data = response?.data ?? null;
  const meta = response?.meta ?? null;
  const latencyMs = meta?.latencyMs ?? Date.now() - startedAt;
  const usage = meta?.usage ?? null;
  const costUsd = estimateAiCostUsd(usage);
  const success = Boolean(data);

  await appendAiAuditLog({
    id: crypto.randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    requestType,
    model: aiModelId,
    provider: aiProvider,
    latencyMs,
    success,
    error: errorMessage,
    usage,
    costUsd,
  });

  if (errorMessage) {
    jsonResponse(
      res,
      getAiErrorStatus(error),
      withRequestId({ error: errorMessage }, requestId),
    );
    return;
  }

  jsonResponse(
    res,
    200,
    withRequestId({ nodes: Array.isArray(data) ? data : [] }, requestId),
  );
};

const handleAiRelevantFiles = async (req, res, session, requestId) => {
  if (!aiClient) {
    jsonResponse(res, 500, withRequestId({ error: 'AI client not configured.' }, requestId));
    return;
  }
  if (!checkRateLimit(req, res, session.id, requestId)) {
    return;
  }
  const payload = await getJsonPayload(req, res, requestId);
  if (!payload) {
    return;
  }
  const query = payload?.query;
  const filePaths = payload?.filePaths;

  if (typeof query !== 'string' || !Array.isArray(filePaths)) {
    jsonResponse(res, 400, withRequestId({ error: 'Invalid payload.' }, requestId));
    return;
  }

  const requestType = AI_REQUEST_SCHEMA.relevantFiles.prompt.id;
  const startedAt = Date.now();
  let response = null;
  let error = null;
  let errorMessage = null;
  try {
    response = await generateJsonResponse({
      client: aiClient,
      model: aiModelId,
      type: requestType,
      params: {
        query,
        filePaths,
      },
    });
  } catch (caughtError) {
    error = caughtError;
    errorMessage = getAiErrorMessage(caughtError);
  }

  const data = response?.data ?? null;
  const meta = response?.meta ?? null;
  const latencyMs = meta?.latencyMs ?? Date.now() - startedAt;
  const usage = meta?.usage ?? null;
  const costUsd = estimateAiCostUsd(usage);
  const success = Boolean(data);

  await appendAiAuditLog({
    id: crypto.randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    requestType,
    model: aiModelId,
    provider: aiProvider,
    latencyMs,
    success,
    error: errorMessage,
    usage,
    costUsd,
  });

  if (errorMessage) {
    jsonResponse(
      res,
      getAiErrorStatus(error),
      withRequestId({ error: errorMessage }, requestId),
    );
    return;
  }

  jsonResponse(
    res,
    200,
    withRequestId({ relevantFiles: data?.relevantFiles ?? [] }, requestId),
  );
};

const handleAiProjectSummary = async (req, res, session, requestId) => {
  if (!aiClient) {
    jsonResponse(res, 500, withRequestId({ error: 'AI client not configured.' }, requestId));
    return;
  }
  if (!checkRateLimit(req, res, session.id, requestId)) {
    return;
  }
  const payload = await getJsonPayload(req, res, requestId);
  if (!payload) {
    return;
  }
  const promptBase =
    typeof payload?.promptBase === 'string' && payload.promptBase.trim().length > 0
      ? payload.promptBase
      : PROJECT_SUMMARY_PROMPT_BASE;
  const filePaths = Array.isArray(payload?.filePaths) ? payload.filePaths : null;
  const graph = payload?.graph;
  const context = Array.isArray(payload?.context)
    ? payload.context.filter((item) => typeof item === 'string')
    : [];

  if (!filePaths || !graph || typeof graph !== 'object') {
    jsonResponse(res, 400, withRequestId({ error: 'Invalid payload.' }, requestId));
    return;
  }

  const trimmedPaths = filePaths.slice(0, 400);
  const graphSnapshot = {
    nodes: Array.isArray(graph.nodes) ? graph.nodes.slice(0, 400) : [],
    edges: Array.isArray(graph.edges) ? graph.edges.slice(0, 800) : [],
  };

  const requestType = AI_REQUEST_SCHEMA.projectSummary.prompt.id;
  const startedAt = Date.now();
  let response = null;
  let error = null;
  let errorMessage = null;
  try {
    response = await generateJsonResponse({
      client: aiClient,
      model: aiModelId,
      type: requestType,
      params: {
        promptBase,
        filePaths: trimmedPaths,
        graph: graphSnapshot,
        context,
      },
    });
  } catch (caughtError) {
    error = caughtError;
    errorMessage = getAiErrorMessage(caughtError);
  }

  const data = response?.data ?? null;
  const meta = response?.meta ?? null;
  const latencyMs = meta?.latencyMs ?? Date.now() - startedAt;
  const usage = meta?.usage ?? null;
  const costUsd = estimateAiCostUsd(usage);
  const success = Boolean(data);

  await appendAiAuditLog({
    id: crypto.randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    requestType,
    model: aiModelId,
    provider: aiProvider,
    latencyMs,
    success,
    error: errorMessage,
    usage,
    costUsd,
  });

  if (errorMessage) {
    jsonResponse(
      res,
      getAiErrorStatus(error),
      withRequestId({ error: errorMessage }, requestId),
    );
    return;
  }

  jsonResponse(
    res,
    200,
    withRequestId(
      {
        summary: data?.summary ?? '',
        diagram: data?.diagram ?? '',
      },
      requestId,
    ),
  );
};

const handleAnalyzeIntent = async (req, res, session, requestId) => {
  if (!aiClient) {
    jsonResponse(res, 500, withRequestId({ error: 'AI client not configured.' }, requestId));
    return;
  }
  if (!checkRateLimit(req, res, session.id, requestId)) {
    return;
  }
  const payload = await getJsonPayload(req, res, requestId);
  if (!payload) {
    return;
  }
  const uiSchema = payload?.uiSchema;
  const fileContent =
    typeof payload?.fileContent === 'string' ? payload.fileContent : payload?.componentCode;
  const existingInfrastructure = Array.isArray(payload?.existingInfrastructure)
    ? payload.existingInfrastructure.filter((item) => typeof item === 'string')
    : [];

  if (!uiSchema || typeof uiSchema !== 'object' || typeof fileContent !== 'string') {
    jsonResponse(res, 400, withRequestId({ error: 'Invalid payload.' }, requestId));
    return;
  }

  const prompt = buildIntentPrompt({ uiSchema, existingInfrastructure });
  const startedAt = Date.now();
  let response = null;
  let error = null;
  let errorMessage = null;
  try {
    response = await withRetryAndTimeout(() =>
      aiClient.models.generateContent({
        model: aiModelId,
        contents: {
          role: 'user',
          parts: [
            { text: prompt },
            { text: `COMPONENT CODE:\n${fileContent.slice(0, 12000)}` },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tables: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    columns: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          type: { type: Type.STRING },
                          constraints: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                        },
                      },
                    },
                  },
                },
              },
              endpoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    method: { type: Type.STRING },
                    path: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                },
              },
              services: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      }),
    );
  } catch (caughtError) {
    error = caughtError;
    errorMessage = getAiErrorMessage(caughtError);
  }

  let data = null;
  if (response?.text) {
    try {
      data = JSON.parse(response.text);
    } catch (error) {
      data = null;
      errorMessage = errorMessage ?? 'Failed to parse AI response.';
    }
  }

  const latencyMs = Date.now() - startedAt;
  const usage = extractUsageTokens(response);
  const costUsd = estimateAiCostUsd(usage);
  const success = Boolean(data);

  await appendAiAuditLog({
    id: crypto.randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    requestType: 'analyzeIntent',
    model: aiModelId,
    provider: aiProvider,
    latencyMs,
    success,
    error: errorMessage,
    usage,
    costUsd,
  });

  if (errorMessage) {
    jsonResponse(
      res,
      getAiErrorStatus(error),
      withRequestId({ error: errorMessage }, requestId),
    );
    return;
  }

  jsonResponse(
    res,
    200,
    withRequestId(
      {
        tables: Array.isArray(data?.tables) ? data.tables : [],
        endpoints: Array.isArray(data?.endpoints) ? data.endpoints : [],
        services: Array.isArray(data?.services) ? data.services : [],
      },
      requestId,
    ),
  );
};

const handleAnalyze = async (req, res, session, requestId) => {
  await handleAnalyzeIntent(req, res, session, requestId);
};

const handleOptimizePrompt = async (req, res, session, requestId) => {
  if (!aiClient) {
    jsonResponse(res, 500, withRequestId({ error: 'AI client not configured.' }, requestId));
    return;
  }
  if (!checkRateLimit(req, res, session.id, requestId)) {
    return;
  }
  const payload = await getJsonPayload(req, res, requestId);
  if (!payload) {
    return;
  }

  const fileContent =
    typeof payload?.fileContent === 'string' ? payload.fileContent : payload?.componentCode;
  const selectedNode = payload?.selectedNode;
  const userIntent = typeof payload?.userIntent === 'string' ? payload.userIntent : '';
  const uiIntentSchema = payload?.uiIntentSchema;
  const backendRequirements = payload?.backendRequirements;
  const projectStructure = payload?.projectStructure;
  const preferredStack = payload?.preferredStack || 'supabase';
  const resolvedIntent =
    userIntent.trim() ||
    (selectedNode && typeof selectedNode?.name === 'string'
      ? `Implementar funcionalidade para ${selectedNode.name}`
      : '');

  if (
    !uiIntentSchema
    || typeof uiIntentSchema !== 'object'
    || !backendRequirements
    || typeof backendRequirements !== 'object'
    || !projectStructure
    || typeof projectStructure !== 'object'
    || typeof resolvedIntent !== 'string'
    || !fileContent
  ) {
    jsonResponse(res, 400, withRequestId({ error: 'Invalid payload.' }, requestId));
    return;
  }

  const stackInstructions = getStackInstructions(preferredStack);
  const systemPrompt = `You are a senior software architect creating detailed, actionable prompts for AI coding assistants (Cursor, Windsurf, GitHub Copilot).

Your task is to generate a step-by-step implementation guide that another AI can follow to create backend infrastructure for a React frontend component.

${stackInstructions}

The output MUST be:
1. **Prescriptive**: Include exact file names, function signatures, table schemas, and code snippets
2. **Ordered by dependency**: Create database tables before API endpoints, services before components
3. **Complete**: Include error handling, validation, and type definitions
4. **Ready to copy-paste**: Format as clear markdown that works directly as an AI prompt

Structure your response as:
1. A brief summary of what will be created
2. Step-by-step instructions with code blocks
3. Verification steps at the end`;

  const userPrompt = `Create a backend implementation prompt based on this analysis:

## User Intent
"${resolvedIntent}"

## Analyzed Frontend Component: ${uiIntentSchema.component}

### Form Fields
${formatFields(uiIntentSchema.fields)}

### Actions
${formatActions(uiIntentSchema.actions)}

### Data Flow
- Direction: ${uiIntentSchema.dataFlow?.direction}
- Inferred Entity: ${uiIntentSchema.dataFlow?.entityGuess} (${Math.round((uiIntentSchema.dataFlow?.confidence ?? 0) * 100)}% confidence)

## Required Backend Infrastructure

### Database Tables
${formatTables(backendRequirements.tables)}

### API Endpoints
${formatEndpoints(backendRequirements.endpoints)}

### Services
${formatServices(backendRequirements.services)}

## Current Project State
- Has Backend: ${projectStructure.hasBackend ? 'Yes' : 'No'}
- Current Stack: ${Array.isArray(projectStructure.stack) ? projectStructure.stack.join(', ') : '' || 'React/Vite only'}
- Existing Endpoints: ${Array.isArray(projectStructure.existingEndpoints) ? projectStructure.existingEndpoints.join(', ') : '' || 'None'}

Generate a comprehensive, copy-paste-ready prompt for implementing this backend with ${preferredStack}.`;

  const startedAt = Date.now();
  let response = null;
  let error = null;
  let errorMessage = null;
  try {
    response = await withRetryAndTimeout(() =>
      aiClient.models.generateContent({
        model: aiModelId,
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
      }),
    );
  } catch (caughtError) {
    error = caughtError;
    errorMessage = getAiErrorMessage(caughtError);
  }

  const prompt = typeof response?.text === 'string' ? response.text : '';
  const latencyMs = Date.now() - startedAt;
  const usage = extractUsageTokens(response);
  const costUsd = estimateAiCostUsd(usage);
  const success = Boolean(prompt);

  await appendAiAuditLog({
    id: crypto.randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    requestType: 'optimizePrompt',
    model: aiModelId,
    provider: aiProvider,
    latencyMs,
    success,
    error: errorMessage,
    usage,
    costUsd,
  });

  if (errorMessage) {
    jsonResponse(
      res,
      getAiErrorStatus(error),
      withRequestId({ error: errorMessage }, requestId),
    );
    return;
  }

  jsonResponse(res, 200, withRequestId({ prompt }, requestId));
};

const handleOptimize = async (req, res, session, requestId) => {
  await handleOptimizePrompt(req, res, session, requestId);
};

const handleAiMetrics = async (req, res) => {
  const records = await readAiAuditLog();
  const totalRequests = records.length;
  const successCount = records.filter((record) => record?.success).length;
  const errorCount = totalRequests - successCount;
  const totalLatency = records.reduce(
    (sum, record) => sum + (isFiniteNumber(record?.latencyMs) ? record.latencyMs : 0),
    0,
  );
  const totalCost = records.reduce(
    (sum, record) => sum + (isFiniteNumber(record?.costUsd) ? record.costUsd : 0),
    0,
  );
  const averageLatencyMs = totalRequests > 0 ? totalLatency / totalRequests : 0;
  const averageCostUsd = totalRequests > 0 ? totalCost / totalRequests : 0;
  const hitRate = totalRequests > 0 ? successCount / totalRequests : 0;
  const recent = records.slice(-15).reverse();

  jsonResponse(res, 200, {
    summary: {
      totalRequests,
      successCount,
      errorCount,
      hitRate,
      averageLatencyMs,
      totalCostUsd: totalCost,
      averageCostUsd,
      lastUpdated: new Date().toISOString(),
    },
    recent,
  });
};

/**
 * Handler para gerar prompts otimizados via AI Agent.
 */
const handleGeneratePrompt = async (req, res, session, requestId) => {
  if (!aiClient) {
    jsonResponse(res, 500, withRequestId({ error: 'AI client not configured.' }, requestId));
    return;
  }

  const payload = await getJsonPayload(req, res, requestId);
  if (!payload) return;

  const validationErrors = validateGeneratePromptPayload(payload);
  if (validationErrors.length > 0) {
    jsonResponse(
      res,
      400,
      withRequestId({ error: validationErrors.join(' ') }, requestId),
    );
    return;
  }

  const { task, context, files } = payload;

  const requestType = AI_REQUEST_SCHEMA.generatePrompt.prompt.id;
  const startedAt = Date.now();
  let response = null;
  let error = null;
  let errorMessage = null;

  try {
    response = await generateJsonResponse({
      client: aiClient,
      model: aiModelId,
      type: requestType,
      params: { task, context, files },
    });
  } catch (caughtError) {
    error = caughtError;
    errorMessage = getAiErrorMessage(caughtError, 'Failed to generate prompt.');
    console.error({
      requestId,
      error: caughtError,
      route: req.url,
      message: 'Generate prompt error',
    });
  }

  const data = response?.data ?? {};
  const meta = response?.meta ?? null;
  const latencyMs = meta?.latencyMs ?? Date.now() - startedAt;
  const usage = meta?.usage ?? null;
  const costUsd = estimateAiCostUsd(usage);
  const success = Boolean(data?.content);

  await appendAiAuditLog({
    id: crypto.randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    requestType,
    model: aiModelId,
    provider: aiProvider,
    latencyMs,
    success,
    error: errorMessage,
    usage,
    costUsd,
  });

  if (errorMessage) {
    jsonResponse(
      res,
      getAiErrorStatus(error),
      withRequestId({ error: errorMessage }, requestId),
    );
    return;
  }

  const result = {
    prompt: data.content,
    metadata: {
      techniques: data.techniquesApplied,
      sections: data.sections,
    },
    usage,
  };

  jsonResponse(res, 200, withRequestId(result, requestId));
};

/**
 * Handler para chat contextual com IA.
 * Suporta 6 modos: explore, create, alter, fix, connect, ask
 */
const handleAiContextualChat = async (req, res, session, requestId) => {
  if (!aiClient) {
    jsonResponse(res, 500, withRequestId({ error: 'AI client not configured.' }, requestId));
    return;
  }
  if (!checkRateLimit(req, res, session.id, requestId)) {
    return;
  }

  const payload = await getJsonPayload(req, res, requestId);
  if (!payload) {
    return;
  }

  const validationErrors = validateAiChatPayload(payload);
  if (validationErrors.length > 0) {
    jsonResponse(
      res,
      400,
      withRequestId({ error: validationErrors.join(' ') }, requestId),
    );
    return;
  }

  const { mode, element, userMessage, conversationHistory, projectContext } = payload;

  const requestType = AI_REQUEST_SCHEMA.contextualChat.prompt.id;
  const startedAt = Date.now();
  let response = null;
  let error = null;
  let errorMessage = null;

  try {
    response = await generateJsonResponse({
      client: aiClient,
      model: aiModelId,
      type: requestType,
      params: {
        mode,
        element: element ?? null,
        userMessage: userMessage.slice(0, 8000),
        conversationHistory: Array.isArray(conversationHistory)
          ? conversationHistory.slice(-10) // Limitar histórico
          : [],
        projectContext: typeof projectContext === 'string'
          ? projectContext.slice(0, 4000)
          : null,
      },
    });
  } catch (caughtError) {
    error = caughtError;
    errorMessage = getAiErrorMessage(caughtError);
  }

  const data = response?.data ?? null;
  const meta = response?.meta ?? null;
  const latencyMs = meta?.latencyMs ?? Date.now() - startedAt;
  const usage = meta?.usage ?? null;
  const costUsd = estimateAiCostUsd(usage);
  const success = Boolean(data);

  await appendAiAuditLog({
    id: crypto.randomUUID(),
    requestId,
    timestamp: new Date().toISOString(),
    requestType,
    model: aiModelId,
    provider: aiProvider,
    mode,
    latencyMs,
    success,
    error: errorMessage,
    usage,
    costUsd,
  });

  if (errorMessage) {
    jsonResponse(res, getAiErrorStatus(error), withRequestId({ error: errorMessage }, requestId));
    return;
  }

  if (!success) {
    const responsePayload = {
      response: 'Não consegui interpretar a resposta da IA, tente reformular.',
      suggestions: [],
      followUpQuestions: [],
      latencyMs,
      ...(usage ? { usage } : {}),
    };
    jsonResponse(res, 200, withRequestId(responsePayload, requestId));
    return;
  }

  const responsePayload = {
    response: data?.response ?? '',
    suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
    followUpQuestions: Array.isArray(data?.followUpQuestions) ? data.followUpQuestions : [],
    latencyMs,
    ...(usage ? { usage } : {}),
  };
  jsonResponse(res, 200, withRequestId(responsePayload, requestId));
};

const handleCreateIndexJob = async (req, res) => {
  const payload = await getJsonPayload(req, res);
  if (payload === null && req.headers['content-length'] && req.headers['content-length'] !== '0') {
    return;
  }
  const job = {
    id: crypto.randomUUID(),
    status: 'pending',
    payload: payload ?? null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
  indexingJobs.set(job.id, job);
  await persistIndexingStore();
  jsonResponse(res, 202, job);
};

const handleIndexJobStatus = (req, res, jobId) => {
  const job = indexingJobs.get(jobId);
  if (!job) {
    jsonResponse(res, 404, { error: 'Job not found.' });
    return;
  }
  jsonResponse(res, 200, job);
};

const handleIndexJobList = (req, res) => {
  jsonResponse(res, 200, { jobs: Array.from(indexingJobs.values()) });
};

const handleSaveSession = async (req, res) => {
  const payload = await getJsonPayload(req, res);
  if (payload === null) {
    return;
  }
  const extracted = extractSessionPayload(payload);
  if (!extracted) {
    jsonResponse(res, 400, { error: 'Invalid session payload.' });
    return;
  }
  const migrated = migrateSessionPayload(extracted.session);
  if (!migrated || !isValidSessionPayload(migrated)) {
    jsonResponse(res, 400, { error: 'Invalid session payload.' });
    return;
  }
  const now = new Date().toISOString();
  const sessionId = extracted.sessionId ?? crypto.randomUUID();
  const existing = savedSessions.get(sessionId);
  const entry = {
    id: sessionId,
    session: migrated,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  savedSessions.set(sessionId, entry);
  await persistSessionStore();
  jsonResponse(res, 200, { sessionId, session: migrated });
};

const handleOpenSession = (req, res, sessionId) => {
  const entry = savedSessions.get(sessionId);
  if (!entry) {
    jsonResponse(res, 404, { error: 'Session not found.' });
    return;
  }
  const migrated = migrateSessionPayload(entry.session);
  if (!migrated || !isValidSessionPayload(migrated)) {
    jsonResponse(res, 409, { error: 'Session data is invalid.' });
    return;
  }
  jsonResponse(res, 200, { sessionId: entry.id, session: migrated });
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

  if (req.method === 'GET' && url.pathname === '/api/github/repos') {
    const session = getSession(req, res);
    await handleUserRepos(req, res, session);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/analyze-file') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;
      await handleAiAnalyzeFile(req, res, session, requestId);
    } catch (error) {
      console.error({
        requestId,
        error,
        route: url.pathname,
        message: 'AI analyze error',
      });
      jsonResponse(res, 500, withRequestId({ error: 'AI analysis failed.' }, requestId));
    }
    return;
  }

  // Phase 1: Detect framework via AI
  if (req.method === 'POST' && url.pathname === '/api/analyze/detect-framework') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;

      const payload = await getJsonPayload(req, res, requestId);
      if (!payload) return;

      const { packageJson, entryFiles } = payload;

      // Build prompt for AI
      const prompt = `You are a frontend framework detector. Analyze the following project files and determine which frontend framework is being used.

package.json content:
${packageJson || 'Not provided'}

Entry files:
${(entryFiles || []).map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')}

Based on this analysis, determine:
1. The main frontend framework (react, vue, angular, svelte, nextjs, nuxt, or other)
2. Your confidence level (0-1)
3. The main entry point file
4. Router library if any (react-router-dom, vue-router, etc)
5. State management library if any (zustand, redux, vuex, pinia, etc)

Respond in JSON format ONLY.`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, enum: ['react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'other'] },
          confidence: { type: Type.NUMBER },
          entryPoint: { type: Type.STRING },
          routerType: { type: Type.STRING },
          stateManagement: { type: Type.STRING }
        },
        required: ['name', 'confidence', 'entryPoint']
      };

      const startMs = Date.now();
      const result = await withRetryAndTimeout(
        async (signal) => {
          const response = await aiClient.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: schema
            }
          }, { signal });
          return response;
        },
        { maxRetries: 2, timeoutMs: 30000 }
      );

      const latencyMs = Date.now() - startMs;
      const framework = generateJsonResponse(result);

      // Log AI usage
      const usage = extractUsageTokens(result);
      await appendAiAuditLog({
        id: requestId,
        timestamp: Date.now(),
        requestType: 'detect-framework',
        model: aiModelId,
        provider: aiProvider,
        latencyMs,
        success: true,
        usage,
        costUsd: estimateAiCostUsd(usage)
      });

      return jsonResponse(res, 200, withRequestId({ framework }, requestId));
    } catch (error) {
      console.error({ requestId, error, route: url.pathname, message: 'Framework detection error' });
      return jsonResponse(res, 500, withRequestId({ error: 'Framework detection failed.' }, requestId));
    }
  }

  // Phase 2: Build UI Graph via AI
  if (req.method === 'POST' && url.pathname === '/api/analyze/ui-hierarchy') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;

      const payload = await getJsonPayload(req, res, requestId);
      if (!payload) return;

      const { framework, files, entryPoint } = payload;

      // Build prompt for AI
      const prompt = `You are a specialized frontend architect analyzer. 
      Your goal is to extract the UI COMPONENT HIERARCHY from the provided project files.
      
      Framework: ${framework}
      Entry Point: ${entryPoint || 'unknown'}
      
      Files provided:
      ${(files || []).map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')}
      
      Instructions:
      1. Start from the root (App or Index).
      2. Trace down the imports and component usage to build a visual tree.
      3. Identify:
         - Pages (routes)
         - Layouts
         - Major Sections (Header, Sidebar, Main Content)
         - Interactive Elements (Buttons, Forms, Inputs, Lists, Modals)
      4. IGNORE utility functions, helper constants, or backend logic unless they are UI components.
      5. For each node, extract key props (onClick handlers, unique IDs, etc.).
      
      Return a JSON object matching this schema recursively:
      {
        "root": {
          "id": "app-root",
          "name": "App",
          "label": "App",
          "type": "app", // app, page, layout, section, component, button, input, form, modal, list
          "sourceFile": "path/to/file",
          "children": [] // recursive
        },
        "totalNodes": number,
        "framework": "${framework}"
      }
      `;

      const schema = {
        type: Type.OBJECT,
        properties: {
          root: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              label: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['app', 'page', 'layout', 'section', 'component', 'button', 'input', 'form', 'modal', 'list'] },
              sourceFile: { type: Type.STRING },
              props: { type: Type.OBJECT }, // Map<string, string>
              children: {
                type: Type.ARRAY,
                items: { type: Type.OBJECT, properties: {}, description: "Recursive node structure" }
                // Note: deeply recursive schemas can be tricky for some AI models, 
                // but Gemini usually handles recursive descriptions well in prompt.
                // For strict schema validation, we might need a simpler definition here or rely on the prompt instructions.
              }
            },
            required: ['id', 'name', 'type', 'children']
          },
          totalNodes: { type: Type.NUMBER },
          framework: { type: Type.STRING }
        },
        required: ['root', 'totalNodes', 'framework']
      };

      const startMs = Date.now();
      const result = await withRetryAndTimeout(
        async (signal) => {
          const response = await aiClient.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              // Note: omitting strict schema for 'children' recursion issues, relying on prompt
            }
          }, { signal });
          return response;
        },
        { maxRetries: 1, timeoutMs: 60000 } // Longer timeout for graph build
      );

      const latencyMs = Date.now() - startMs;
      const graph = generateJsonResponse(result);

      // Basic validation/cleanup if AI missed properties
      if (graph.root && !graph.root.children) graph.root.children = [];

      // Log AI usage
      const usage = extractUsageTokens(result);
      await appendAiAuditLog({
        id: requestId,
        timestamp: Date.now(),
        requestType: 'ui-hierarchy',
        model: aiModelId,
        provider: aiProvider,
        latencyMs,
        success: true,
        usage,
        costUsd: estimateAiCostUsd(usage)
      });

      return jsonResponse(res, 200, withRequestId({ graph }, requestId));
    } catch (error) {
      console.error({ requestId, error, route: url.pathname, message: 'UI Graph build error' });
      return jsonResponse(res, 500, withRequestId({ error: 'UI Graph build failed.' }, requestId));
    }
  }

  // Phase 4: Dependency Analysis (Reverse Mapping)
  if (req.method === 'POST' && url.pathname === '/api/analyze/dependencies') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;

      const payload = await getJsonPayload(req, res, requestId);
      if (!payload) return;

      const { frontendFiles, backendFiles, framework } = payload;

      // Build prompt for AI
      const prompt = `You are a Senior Full Stack Architect.
      
      Goal: Perform a "Reverse Dependency Mapping". 
      1. Analyze the FRONTEND code to identify external requirements (Database Tables, API Endpoints, Services).
      2. Analyze the BACKEND code (if provided) to check if these requirements are implemented.
      3. List ALL requirements, marking them as 'existing' (found in backend) or 'missing' (not found).
      
      Framework: ${framework}
      
      --- FRONTEND FILES (Requirements Source) ---
      ${(frontendFiles || []).map(f => `FILE: ${f.path}\n${f.content}`).join('\n\n')}
      
      --- BACKEND FILES (Implementation Source) ---
      ${(backendFiles || []).length > 0 ? (backendFiles || []).map(f => `FILE: ${f.path}\n${f.content}`).join('\n\n') : "NO BACKEND FILES PROVIDED."}
      
      Instructions:
      - Infer SQL tables based on data shapes in interfaces and API calls.
      - Infer API endpoints based on fetch/axios calls.
      - If a requirement matches a backend route/model, status is 'existing'.
      - If no backend match is found, status is 'missing'.
      
      Return JSON:
      {
        "tables": [
          { "name": "users", "status": "existing" | "missing", "columns": [{"name": "id", "type": "uuid"}], "reason": "Used in UserProfile.tsx" }
        ],
        "endpoints": [
          { "method": "GET", "path": "/api/users", "status": "existing" | "missing", "purpose": "Fetch users", "reason": "Called in UserList.tsx" }
        ],
        "services": [
           { "name": "AuthService", "status": "existing" | "missing", "description": "Handles login", "reason": "Imported in Login.tsx" }
        ]
      }
      `;

      const startMs = Date.now();
      const result = await withRetryAndTimeout(
        async (signal) => {
          const response = await aiClient.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          }, { signal });
          return response;
        },
        { maxRetries: 1, timeoutMs: 90000 } // Long timeout for deep analysis
      );

      const latencyMs = Date.now() - startMs;
      const analysis = generateJsonResponse(result);

      // Log usage
      const usage = extractUsageTokens(result);
      await appendAiAuditLog({
        id: requestId,
        timestamp: Date.now(),
        requestType: 'dependency-analysis',
        model: aiModelId,
        provider: aiProvider,
        latencyMs,
        success: true,
        usage,
        costUsd: estimateAiCostUsd(usage)
      });

      return jsonResponse(res, 200, withRequestId({ analysis }, requestId));

    } catch (error) {
      console.error({ requestId, error, route: url.pathname, message: 'Dependency analysis error' });
      return jsonResponse(res, 500, withRequestId({ error: 'Dependency analysis failed.' }, requestId));
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/relevant-files') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;
      await handleAiRelevantFiles(req, res, session, requestId);
    } catch (error) {
      console.error({
        requestId,
        error,
        route: url.pathname,
        message: 'AI relevance error',
      });
      jsonResponse(res, 500, withRequestId({ error: 'AI relevance failed.' }, requestId));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/project-summary') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;
      await handleAiProjectSummary(req, res, session, requestId);
    } catch (error) {
      console.error({
        requestId,
        error,
        route: url.pathname,
        message: 'AI summary error',
      });
      jsonResponse(res, 500, withRequestId({ error: 'AI summary failed.' }, requestId));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;
      await handleAnalyze(req, res, session, requestId);
    } catch (error) {
      console.error({
        requestId,
        error,
        route: url.pathname,
        message: 'Intent analysis error',
      });
      jsonResponse(
        res,
        500,
        withRequestId({ error: 'Intent analysis failed.' }, requestId),
      );
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/optimize') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;
      await handleOptimize(req, res, session, requestId);
    } catch (error) {
      console.error({
        requestId,
        error,
        route: url.pathname,
        message: 'Prompt optimization error',
      });
      jsonResponse(
        res,
        500,
        withRequestId({ error: 'Prompt optimization failed.' }, requestId),
      );
    }
    return;
  }

  // Alias route for /api/optimize-prompt (used by frontend store)
  if (req.method === 'POST' && url.pathname === '/api/optimize-prompt') {
    const requestId = crypto.randomUUID();
    try {
      const session = requireAuthenticatedSession(req, res, requestId);
      if (!session) return;
      await handleOptimizePrompt(req, res, session, requestId);
    } catch (error) {
      console.error({
        requestId,
        error,
        route: url.pathname,
        message: 'Prompt optimization error',
      });
      jsonResponse(
        res,
        500,
        withRequestId({ error: 'Prompt optimization failed.' }, requestId),
      );
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/ai/metrics') {
    try {
      await handleAiMetrics(req, res);
    } catch (error) {
      console.error('AI metrics error', error);
      jsonResponse(res, 500, { error: 'Failed to load AI metrics.' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/generate-prompt') {
    const requestId = crypto.randomUUID();
    try {
      const session = getSession(req, res);
      await handleGeneratePrompt(req, res, session, requestId);
    } catch (error) {
      console.error({
        requestId,
        error,
        route: url.pathname,
        message: 'Generate prompt error',
      });
      jsonResponse(
        res,
        500,
        withRequestId({ error: 'Generate prompt failed.' }, requestId),
      );
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/chat') {
    const requestId = crypto.randomUUID();
    try {
      const session = getSession(req, res); // Não requer autenticação GitHub
      await handleAiContextualChat(req, res, session, requestId);
    } catch (error) {
      console.error({
        requestId,
        error,
        route: url.pathname,
        message: 'AI contextual chat error',
      });
      jsonResponse(res, 500, withRequestId({ error: 'AI chat failed.' }, requestId));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/indexer/jobs') {
    try {
      await handleCreateIndexJob(req, res);
    } catch (error) {
      console.error('Index job create error', error);
      jsonResponse(res, 500, { error: 'Failed to create index job.' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/indexer/jobs') {
    handleIndexJobList(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/indexer/jobs/')) {
    const jobId = url.pathname.replace('/api/indexer/jobs/', '');
    handleIndexJobStatus(req, res, jobId);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/sessions/save') {
    try {
      await handleSaveSession(req, res);
    } catch (error) {
      console.error('Session save error', error);
      jsonResponse(res, 500, { error: 'Failed to save session.' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/sessions/')) {
    const sessionId = url.pathname.replace('/api/sessions/', '');
    handleOpenSession(req, res, sessionId);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const realtimeServer = new WebSocketServer({ server, path: '/realtime' });
realtimeServer.on('connection', (socket) => {
  const clientInfo = { sessionId: null, clientId: null };

  const send = (payload) => {
    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(payload));
  };

  socket.on('message', (data) => {
    let message = null;
    try {
      const raw = typeof data === 'string' ? data : data.toString();
      message = JSON.parse(raw);
    } catch (error) {
      console.error('Invalid realtime message', error);
      return;
    }
    if (!message || typeof message !== 'object') return;

    if (message.type === 'join') {
      const { sessionId, clientId, profile } = message;
      if (typeof sessionId !== 'string' || typeof clientId !== 'string') return;
      clientInfo.sessionId = sessionId;
      clientInfo.clientId = clientId;
      const session = ensureRealtimeSession(sessionId);
      session.sockets.add(socket);
      const existing = session.presence.get(clientId);
      const presence = {
        clientId,
        profile: profile ?? existing?.profile ?? { name: 'Guest', color: '#94a3b8' },
        cursor: existing?.cursor ?? null,
        selection: existing?.selection ?? { selectedNodeId: null },
        sequence: existing?.sequence ?? 0,
        updatedAt: Date.now(),
      };
      session.presence.set(clientId, presence);
      send({ type: 'state_sync', sessionId, presence: serializePresence(session.presence) });
      broadcastRealtime(sessionId, { type: 'presence_update', presence }, socket);
      return;
    }

    if (message.type === 'presence_update') {
      const { sessionId, clientId, presence, sequence } = message;
      if (typeof sessionId !== 'string' || typeof clientId !== 'string') return;
      const nextSequence = Number(sequence);
      if (!Number.isFinite(nextSequence)) return;
      const session = ensureRealtimeSession(sessionId);
      const current = session.presence.get(clientId);
      if (current && nextSequence <= current.sequence) {
        return;
      }
      const nextPresence = {
        clientId,
        profile: current?.profile ?? { name: 'Guest', color: '#94a3b8' },
        cursor: presence?.cursor ?? current?.cursor ?? null,
        selection: presence?.selection ?? current?.selection ?? { selectedNodeId: null },
        sequence: nextSequence,
        updatedAt: Date.now(),
      };
      session.presence.set(clientId, nextPresence);
      broadcastRealtime(sessionId, { type: 'presence_update', presence: nextPresence });
    }
  });

  socket.on('close', () => {
    const { sessionId, clientId } = clientInfo;
    if (!sessionId || !clientId) return;
    const session = realtimeSessions.get(sessionId);
    if (!session) return;
    session.sockets.delete(socket);
    if (session.presence.has(clientId)) {
      session.presence.delete(clientId);
      broadcastRealtime(sessionId, { type: 'presence_remove', clientId });
    }
    if (session.sockets.size === 0) {
      realtimeSessions.delete(sessionId);
    }
  });
});

server.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});

await readIndexingStore();
await readSessionStore();
setInterval(() => {
  processIndexingQueue().catch((error) => {
    console.error('Indexing worker error', error);
    isIndexingWorkerRunning = false;
  });
}, indexingPollIntervalMs);

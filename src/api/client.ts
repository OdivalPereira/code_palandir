import {
  AiMetricsResponse,
  BackendRequirements,
  CodeNode,
  PromptOptimizerPayload,
  ProjectGraphInput,
  ProjectSummary,
  SelectedNodePayload,
  SessionPayload,
  UIIntentSchema,
} from '../types';
import {
  getCachedAnalysis,
  getCachedRelevantFiles,
  hashContent,
  setCachedAnalysis,
  setCachedRelevantFiles,
} from '../cacheRepository';

type AnalyzeIntentPayload = {
  fileContent: string;
  selectedNode: SelectedNodePayload;
  userIntent?: string;
  uiSchema: UIIntentSchema;
  existingInfrastructure?: string[];
};

type RequestOptions = {
  credentials?: RequestCredentials;
  errorMessage?: string;
  allowedStatuses?: number[];
};

type SaveSessionResponse = {
  sessionId: string;
  session: SessionPayload;
};

type OpenSessionResponse = {
  sessionId: string;
  session: SessionPayload;
};

const ensureJsonHeaders = (headers: HeadersInit | undefined, hasBody: boolean) => {
  const resolved = new Headers(headers);
  if (hasBody && !resolved.has('Content-Type')) {
    resolved.set('Content-Type', 'application/json');
  }
  return resolved;
};

const extractErrorMessage = async (response: Response, fallback?: string) => {
  try {
    const data = (await response.json()) as { message?: string };
    if (data?.message && typeof data.message === 'string') {
      return data.message;
    }
  } catch {
    // Ignore JSON parse errors and fallback to text or generic message.
  }

  try {
    const text = await response.text();
    if (text) {
      return text;
    }
  } catch {
    // Ignore text parse errors.
  }

  return fallback ?? `Request failed (${response.status}).`;
};

export const requestResponse = async (
  input: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<Response> => {
  const hasBody = init.body !== undefined && init.body !== null;
  const headers = ensureJsonHeaders(init.headers, hasBody);
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: options.credentials ?? 'include',
  });

  const allowedStatuses = options.allowedStatuses ?? [];
  if (!response.ok && !allowedStatuses.includes(response.status)) {
    const message = await extractErrorMessage(response, options.errorMessage);
    throw new Error(message);
  }

  return response;
};

export const requestJson = async <T>(
  input: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> => {
  const response = await requestResponse(input, init, options);
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
};

export const PROJECT_SUMMARY_PROMPT_BASE = `Você é um arquiteto de software. Com base nos inputs fornecidos (arquivos e grafo),
 gere uma visão geral do projeto.

Requisitos:
- Produza um resumo claro (até 8 frases) descrevendo propósito, módulos principais e fluxos críticos.
- Produza um diagrama lógico em Mermaid usando flowchart TD.
- Responda em pt-br.
- Retorne apenas JSON válido conforme o schema, sem markdown ou explicações extras.`;

const requestApi = async <T>(path: string, payload: Record<string, unknown>): Promise<T> =>
  requestJson<T>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

const requestAi = async <T>(path: string, payload: Record<string, unknown>): Promise<T> =>
  requestJson<T>(`/api/ai/${path}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const analyzeIntent = async (
  payload: AnalyzeIntentPayload,
): Promise<BackendRequirements> => {
  const result = await requestApi<BackendRequirements>('/api/analyze', {
    fileContent: payload.fileContent,
    selectedNode: payload.selectedNode,
    userIntent: payload.userIntent ?? '',
    uiSchema: payload.uiSchema,
    existingInfrastructure: payload.existingInfrastructure ?? [],
  });

  return {
    tables: Array.isArray(result.tables) ? result.tables : [],
    endpoints: Array.isArray(result.endpoints) ? result.endpoints : [],
    services: Array.isArray(result.services) ? result.services : [],
  };
};

export const optimizePrompt = async (payload: PromptOptimizerPayload): Promise<string> => {
  const result = await requestApi<{ prompt?: string }>('/api/optimize', {
    fileContent: payload.fileContent ?? payload.componentCode ?? '',
    selectedNode: payload.selectedNode,
    userIntent: payload.userIntent,
    uiIntentSchema: payload.uiIntentSchema,
    projectStructure: payload.projectStructure,
    backendRequirements: payload.backendRequirements,
    preferredStack: payload.preferredStack,
  });

  return typeof result.prompt === 'string' ? result.prompt : '';
};

export const analyzeFile = async (
  code: string,
  filename: string,
  options?: { ttlMs?: number },
): Promise<CodeNode[]> => {
  const key = await hashContent(`${filename}:${code}`);
  const cached = await getCachedAnalysis(key);
  if (cached) {
    return cached;
  }
  try {
    const result = await requestAi<{ nodes: CodeNode[] }>('analyze-file', {
      code,
      filename,
    });
    const nodes = Array.isArray(result.nodes) ? result.nodes : [];
    await setCachedAnalysis(key, nodes, options?.ttlMs);
    return nodes;
  } catch (error) {
    console.error('File analysis failed', error);
    return [];
  }
};

export const relevantFiles = async (
  query: string,
  filePaths: string[],
  options?: { ttlMs?: number },
): Promise<string[]> => {
  const normalizedPaths = [...filePaths].sort();
  const pathsStr = normalizedPaths.join('\n');
  const contentHash = await hashContent(pathsStr);
  const cacheKey = await hashContent(`${contentHash}:${query}`);
  const cached = await getCachedRelevantFiles(cacheKey, contentHash);
  if (cached) {
    return cached;
  }

  try {
    const result = await requestAi<{ relevantFiles: string[] }>('relevant-files', {
      query,
      filePaths: normalizedPaths,
    });
    const relevant = Array.isArray(result.relevantFiles) ? result.relevantFiles : [];
    await setCachedRelevantFiles(cacheKey, relevant, contentHash, options?.ttlMs);
    return relevant;
  } catch (error) {
    console.error('Relevance search failed', error);
    return [];
  }
};

export const projectSummary = async (inputs: {
  filePaths: string[];
  graph: ProjectGraphInput;
  context?: string[];
  promptBase?: string;
}): Promise<ProjectSummary> => {
  const result = await requestAi<ProjectSummary>('project-summary', {
    promptBase: inputs.promptBase ?? PROJECT_SUMMARY_PROMPT_BASE,
    filePaths: inputs.filePaths,
    graph: inputs.graph,
    context: inputs.context ?? [],
  });
  return {
    summary: typeof result.summary === 'string' ? result.summary : '',
    diagram: typeof result.diagram === 'string' ? result.diagram : '',
  };
};

export const fetchAiMetrics = async (): Promise<AiMetricsResponse> =>
  requestJson<AiMetricsResponse>('/api/ai/metrics', {}, {
    errorMessage: 'Falha ao carregar métricas.',
  });

export const fetchSessionAccessToken = async (): Promise<string | null> => {
  const response = await requestResponse('/api/session', {}, {
    allowedStatuses: [401, 403],
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { accessToken?: string | null };
  return data.accessToken ?? null;
};

export const saveSession = async (
  session: SessionPayload,
  sessionId?: string | null,
): Promise<SaveSessionResponse> =>
  requestJson<SaveSessionResponse>('/api/sessions/save', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: sessionId ?? undefined,
      session,
    }),
  }, {
    errorMessage: 'Failed to save session.',
  });

export const openSession = async (sessionId: string): Promise<OpenSessionResponse> =>
  requestJson<OpenSessionResponse>(`/api/sessions/${sessionId}`, {}, {
    errorMessage: 'Failed to open session.',
  });

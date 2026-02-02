import {
  BackendRequirements,
  CodeNode,
  PromptOptimizerPayload,
  ProjectGraphInput,
  ProjectSummary,
  SelectedNodePayload,
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

const requestApi = async <T>(path: string, payload: Record<string, unknown>): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status}).`);
  }

  return (await response.json()) as T;
};

const requestAi = async <T>(path: string, payload: Record<string, unknown>): Promise<T> => {
  const response = await fetch(`/api/ai/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}).`);
  }

  return (await response.json()) as T;
};

export const analyzeIntent = async (
  payload: AnalyzeIntentPayload,
): Promise<BackendRequirements> => {
  const result = await requestApi<BackendRequirements>('/api/analyze-intent', {
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
  const result = await requestApi<{ prompt?: string }>('/api/optimize-prompt', {
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

export const PROJECT_SUMMARY_PROMPT_BASE = `Você é um arquiteto de software. Com base nos inputs fornecidos (arquivos e grafo),
gere uma visão geral do projeto.

Requisitos:
- Produza um resumo claro (até 8 frases) descrevendo propósito, módulos principais e fluxos críticos.
- Produza um diagrama lógico em Mermaid usando flowchart TD.
- Responda em pt-br.
- Retorne apenas JSON válido conforme o schema, sem markdown ou explicações extras.`;

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
    console.error("File analysis failed", error);
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
    console.error("Relevance search failed", error);
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

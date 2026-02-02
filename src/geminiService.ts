import { CodeNode, ProjectGraphInput, ProjectSummary } from './types';
import {
  getCachedAnalysis,
  getCachedRelevantFiles,
  hashContent,
  setCachedAnalysis,
  setCachedRelevantFiles,
} from './cacheRepository';

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

export const PROJECT_SUMMARY_PROMPT_BASE = `Você é um arquiteto de software. Com base nos inputs fornecidos (arquivos e grafo),
gere uma visão geral do projeto.

Requisitos:
- Produza um resumo claro (até 8 frases) descrevendo propósito, módulos principais e fluxos críticos.
- Produza um diagrama lógico em Mermaid usando flowchart TD.
- Responda em pt-br.
- Retorne apenas JSON válido conforme o schema, sem markdown ou explicações extras.`;

// Analyze a single file's content to extract structure
export const analyzeFileContent = async (
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

// Identify relevant files in the project based on a user query
export const findRelevantFiles = async (
  query: string,
  filePaths: string[],
  options?: { ttlMs?: number },
): Promise<string[]> => {
  // Batch paths if too many, but for now assume it fits
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
    const relevantFiles = Array.isArray(result.relevantFiles) ? result.relevantFiles : [];
    await setCachedRelevantFiles(cacheKey, relevantFiles, contentHash, options?.ttlMs);
    return relevantFiles;
  } catch (error) {
    console.error("Relevance search failed", error);
    return [];
  }
};

export const summarizeProject = async (inputs: {
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

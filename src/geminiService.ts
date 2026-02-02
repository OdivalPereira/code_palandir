import { CodeNode } from './types';
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

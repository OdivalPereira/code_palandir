import { GoogleGenAI, Type } from '@google/genai';
import { CodeNode } from './types';
import {
  getCachedAnalysis,
  getCachedRelevantFiles,
  hashContent,
  setCachedAnalysis,
  setCachedRelevantFiles,
} from './cacheRepository';

// Note: In Vite, env vars must start with VITE_
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || '', vertexai: true });
const modelId = 'gemini-2.5-flash';

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
  const prompt = `
    Analyze the source code of ${filename}.
    Extract the top-level structure: classes, functions, exported variables, and API endpoints.
    Return a list of these elements.
    For each, provide a brief description and the signature/snippet.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        role: 'user',
        parts: [
          { text: prompt },
          { text: `CODE:\n${code.slice(0, 20000)}` } // Limit context window usage
        ]
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
              description: { type: Type.STRING }
            }
          }
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text) as CodeNode[];
      await setCachedAnalysis(key, parsed, options?.ttlMs);
      return parsed;
    }
    await setCachedAnalysis(key, [], options?.ttlMs);
    return [];
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
  const prompt = `
    I have a project with the following file structure.
    User Query: "${query}"
    
    Identify which files are likely to contain the logic relevant to the query.
    Return a list of file paths.
  `;

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
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        role: 'user',
        parts: [
          { text: prompt },
          { text: `FILES:\n${pathsStr}` }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            relevantFiles: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      const relevantFiles = result.relevantFiles || [];
      await setCachedRelevantFiles(cacheKey, relevantFiles, contentHash, options?.ttlMs);
      return relevantFiles;
    }
    await setCachedRelevantFiles(cacheKey, [], contentHash, options?.ttlMs);
    return [];
  } catch (error) {
    console.error("Relevance search failed", error);
    return [];
  }
};

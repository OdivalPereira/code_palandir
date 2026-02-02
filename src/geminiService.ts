import { GoogleGenAI, Type } from '@google/genai';
import { CodeNode } from './types';

// Lazy initialization for Gemini AI - only initialize when needed
let aiInstance: GoogleGenAI | null = null;
const modelId = 'gemini-2.5-flash';

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_API_KEY environment variable is not set. Please configure your Gemini API key.');
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      vertexai: true,
    });
  }
  return aiInstance;
}

// Analyze a single file's content to extract structure
export const analyzeFileContent = async (code: string, filename: string): Promise<CodeNode[]> => {
  const prompt = `
    Analyze the source code of ${filename}.
    Extract the top-level structure: classes, functions, exported variables, and API endpoints.
    Return a list of these elements.
    For each, provide a brief description and the signature/snippet.
  `;

  try {
    const response = await getAI().models.generateContent({
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
      return JSON.parse(response.text) as CodeNode[];
    }
    return [];
  } catch (error) {
    console.error("File analysis failed", error);
    return [];
  }
};

// Identify relevant files in the project based on a user query
export const findRelevantFiles = async (query: string, filePaths: string[]): Promise<string[]> => {
  const prompt = `
    I have a project with the following file structure.
    User Query: "${query}"
    
    Identify which files are likely to contain the logic relevant to the query.
    Return a list of file paths.
  `;

  // Batch paths if too many, but for now assume it fits
  const pathsStr = filePaths.join('\n');

  try {
    const response = await getAI().models.generateContent({
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
      return result.relevantFiles || [];
    }
    return [];
  } catch (error) {
    console.error("Relevance search failed", error);
    return [];
  }
};

import { GoogleGenAI, Type } from '@google/genai';

const DEFAULT_AI_PROVIDER = 'vertex';
const SUPPORTED_AI_PROVIDERS = new Set(['vertex', 'google']);

const normalizeAiProvider = (value) => {
  if (!value || typeof value !== 'string') return DEFAULT_AI_PROVIDER;
  const normalized = value.toLowerCase();
  return SUPPORTED_AI_PROVIDERS.has(normalized) ? normalized : DEFAULT_AI_PROVIDER;
};

const createAiClient = ({ apiKey, provider }) => {
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey, vertexai: provider === 'vertex' });
};

const AI_REQUEST_SCHEMA = {
  analyzeFile: {
    prompt: {
      id: 'analyzeFile',
      variables: ['filename', 'code'],
    },
    response: {
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
  relevantFiles: {
    prompt: {
      id: 'relevantFiles',
      variables: ['query', 'filePaths'],
    },
    response: {
      type: Type.OBJECT,
      properties: {
        relevantFiles: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
  },
  projectSummary: {
    prompt: {
      id: 'projectSummary',
      variables: ['promptBase', 'filePaths', 'graph', 'context'],
    },
    response: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        diagram: { type: Type.STRING },
      },
    },
  },
};

const buildPromptParts = (type, params) => {
  switch (type) {
    case 'analyzeFile':
      return [
        {
          text: `
    Analyze the source code of ${params.filename}.
    Extract the top-level structure: classes, functions, exported variables, and API endpoints.
    Return a list of these elements.
    For each, provide a brief description and the signature/snippet.
  `,
        },
        { text: `CODE:\n${params.code}` },
      ];
    case 'relevantFiles':
      return [
        {
          text: `
    I have a project with the following file structure.
    User Query: "${params.query}"
    
    Identify which files are likely to contain the logic relevant to the query.
    Return a list of file paths.
  `,
        },
        { text: `FILES:\n${params.filePaths.join('\n')}` },
      ];
    case 'projectSummary':
      return [
        { text: params.promptBase },
        {
          text: `INPUTS:\nFILES:\n${params.filePaths.join('\n')}\n\nGRAPH:\n${JSON.stringify(
            params.graph,
          )}\n\nCONTEXT:\n${params.context.join('\n')}`,
        },
      ];
    default:
      return [];
  }
};

const extractUsageTokens = (response) => {
  const usage =
    response?.usageMetadata
    ?? response?.usage
    ?? response?.metadata?.usage
    ?? response?.meta?.usage
    ?? null;
  if (!usage || typeof usage !== 'object') return null;
  const promptTokens = Number(
    usage.promptTokenCount
      ?? usage.promptTokens
      ?? usage.inputTokens
      ?? usage.input_token_count
      ?? usage.input_tokens
      ?? null,
  );
  const outputTokens = Number(
    usage.candidatesTokenCount
      ?? usage.outputTokens
      ?? usage.output_token_count
      ?? usage.output_tokens
      ?? null,
  );
  const totalTokens = Number(
    usage.totalTokenCount
      ?? usage.totalTokens
      ?? usage.total_token_count
      ?? null,
  );

  const normalizedPrompt = Number.isFinite(promptTokens) ? promptTokens : null;
  const normalizedOutput = Number.isFinite(outputTokens) ? outputTokens : null;
  const normalizedTotal = Number.isFinite(totalTokens)
    ? totalTokens
    : Number.isFinite(normalizedPrompt) || Number.isFinite(normalizedOutput)
      ? (normalizedPrompt ?? 0) + (normalizedOutput ?? 0)
      : null;

  if (
    normalizedPrompt === null
    && normalizedOutput === null
    && normalizedTotal === null
  ) {
    return null;
  }

  return {
    promptTokens: normalizedPrompt,
    outputTokens: normalizedOutput,
    totalTokens: normalizedTotal,
  };
};

const generateJsonResponse = async ({ client, model, type, params }) => {
  if (!client) return null;
  const requestSchema = AI_REQUEST_SCHEMA[type];
  if (!requestSchema) {
    throw new Error(`Unknown AI request schema: ${type}`);
  }

  const promptParts = buildPromptParts(type, params);
  const startedAt = Date.now();
  const response = await client.models.generateContent({
    model,
    contents: {
      role: 'user',
      parts: promptParts,
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: requestSchema.response,
    },
  });
  const latencyMs = Date.now() - startedAt;

  if (!response.text) {
    return { data: null, meta: { latencyMs, usage: extractUsageTokens(response) } };
  }

  try {
    return {
      data: JSON.parse(response.text),
      meta: { latencyMs, usage: extractUsageTokens(response) },
    };
  } catch (error) {
    return { data: null, meta: { latencyMs, usage: extractUsageTokens(response) } };
  }
};

export {
  AI_REQUEST_SCHEMA,
  buildPromptParts,
  createAiClient,
  extractUsageTokens,
  generateJsonResponse,
  normalizeAiProvider,
};

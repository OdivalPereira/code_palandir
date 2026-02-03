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
  contextualChat: {
    prompt: {
      id: 'contextualChat',
      variables: ['mode', 'element', 'userMessage', 'conversationHistory', 'projectContext'],
    },
    response: {
      type: Type.OBJECT,
      properties: {
        response: { type: Type.STRING },
        suggestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['file', 'api', 'snippet', 'migration', 'table', 'service'] },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              content: { type: Type.STRING },
              path: { type: Type.STRING },
            },
          },
        },
        followUpQuestions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
  },
  generatePrompt: {
    prompt: {
      id: 'generatePrompt',
      variables: ['task', 'context', 'files'],
    },
    response: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
        techniquesApplied: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        sections: {
          type: Type.OBJECT,
          properties: {
            context: { type: Type.STRING },
            tasks: { type: Type.STRING },
            instructions: { type: Type.STRING },
            validation: { type: Type.STRING },
          },
        },
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
    case 'contextualChat':
      return buildContextualChatPrompt(params);
    case 'generatePrompt':
      return [
        {
          text: `Você é um Engenheiro de Prompt Sênior (Prompt Engineer).
Sua missão é refinar e estruturar solicitações de usuários sobre tarefas de programação, transformando-as em prompts de ALTA QUALIDADE para LLMs.

Analise o seguinte pedido:
TAREFA: "${params.task}"

CONTEXTO ADICIONAL: "${params.context || ''}"

ARQUIVOS ENVOLVIDOS:
${(params.files || []).join('\n')}

Gere um prompt otimizado seguindo as melhores práticas (Clear instructions, Role prompting, Chain of thought, Few-shot prompting se necessário).
Preencha a resposta JSON com o prompt completo em 'content', a lista de técnicas usadas em 'techniquesApplied', e quebre o prompt em seções lógicas em 'sections'.
Responda em português brasileiro.`,
        },
      ];
    default:
      return [];
  }
};

const MODE_SYSTEM_PROMPTS = {
  explore: `Você é um especialista em análise de código. O usuário quer EXPLORAR e entender um elemento do código.
Seu objetivo é:
- Explicar o que o elemento faz de forma clara
- Mostrar dependências e como ele se conecta ao resto do sistema
- Identificar padrões de uso e boas práticas aplicadas
- Sugerir documentação ou melhorias de legibilidade
Responda em português brasileiro.`,

  create: `Você é um arquiteto de software experiente. O usuário quer CRIAR algo novo relacionado a um elemento do código.
Seu objetivo é:
- Sugerir implementações que seguem as convenções do projeto
- Propor estrutura de arquivos, APIs, migrations necessárias
- Fornecer código funcional e bem documentado
- Garantir que a nova funcionalidade se integre bem ao existente
Responda em português brasileiro.`,

  alter: `Você é um especialista em refatoração de código. O usuário quer ALTERAR ou modificar um elemento existente.
Seu objetivo é:
- Entender a mudança desejada e suas implicações
- Sugerir a melhor abordagem para a modificação
- Identificar efeitos colaterais e dependências afetadas
- Fornecer código atualizado mantendo compatibilidade
Responda em português brasileiro.`,

  fix: `Você é um especialista em debugging e resolução de problemas. O usuário quer CORRIGIR um bug ou problema.
Seu objetivo é:
- Identificar a causa raiz do problema
- Sugerir a correção mais apropriada
- Prevenir regressões e problemas similares
- Fornecer testes ou validações quando aplicável
Responda em português brasileiro.`,

  connect: `Você é um especialista em integração de sistemas. O usuário quer CONECTAR elementos ou sistemas.
Seu objetivo é:
- Entender os pontos de integração necessários
- Sugerir a melhor arquitetura de conexão
- Propor APIs, eventos, ou padrões de comunicação
- Garantir baixo acoplamento e alta coesão
Responda em português brasileiro.`,

  ask: `Você é um assistente de programação experiente. O usuário tem uma PERGUNTA sobre o código ou tecnologia.
Seu objetivo é:
- Responder de forma clara e direta
- Fornecer exemplos quando útil
- Sugerir recursos adicionais se apropriado
- Ser conciso mas completo
Responda em português brasileiro.`,
};

const buildContextualChatPrompt = (params) => {
  const { mode, element, userMessage, conversationHistory, projectContext } = params;

  const systemPrompt = MODE_SYSTEM_PROMPTS[mode] || MODE_SYSTEM_PROMPTS.ask;

  const elementContext = element ? `
ELEMENTO EM FOCO:
- Nome: ${element.name}
- Tipo: ${element.type}
- Caminho: ${element.path}
${element.codeSnippet ? `- Código:\n\`\`\`\n${element.codeSnippet}\n\`\`\`` : ''}
` : '';

  const historyText = conversationHistory && conversationHistory.length > 0
    ? `\nHISTÓRICO DA CONVERSA:\n${conversationHistory.map(msg =>
      `${msg.role === 'user' ? 'Usuário' : 'Assistente'}: ${msg.content}`
    ).join('\n\n')}\n`
    : '';

  const projectText = projectContext
    ? `\nCONTEXTO DO PROJETO:\n${projectContext}\n`
    : '';

  return [
    { text: systemPrompt },
    { text: `${elementContext}${projectText}${historyText}` },
    { text: `MENSAGEM DO USUÁRIO:\n${userMessage}` },
    {
      text: `
Responda de forma útil e prática. Se identificar sugestões de código, arquivos ou APIs a criar, inclua-as no campo "suggestions" do JSON.
Se tiver perguntas de follow-up relevantes, inclua-as em "followUpQuestions".
` },
  ];
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

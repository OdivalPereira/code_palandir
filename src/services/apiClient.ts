import {
  BackendRequirements,
  PromptOptimizerPayload,
  UIIntentSchema,
} from '../types';

type AnalyzeIntentPayload = {
  uiSchema: UIIntentSchema;
  componentCode: string;
  existingInfrastructure?: string[];
};

const requestApi = async <T>(path: string, payload: Record<string, unknown>): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
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

export const analyzeIntent = async (
  payload: AnalyzeIntentPayload,
): Promise<BackendRequirements> => {
  const result = await requestApi<BackendRequirements>('/api/analyze-intent', {
    uiSchema: payload.uiSchema,
    componentCode: payload.componentCode,
    existingInfrastructure: payload.existingInfrastructure ?? [],
  });

  return {
    tables: Array.isArray(result.tables) ? result.tables : [],
    endpoints: Array.isArray(result.endpoints) ? result.endpoints : [],
    services: Array.isArray(result.services) ? result.services : [],
  };
};

export const optimizePrompt = async (payload: PromptOptimizerPayload): Promise<string> => {
  const result = await requestApi<{ prompt?: string }>('/api/optimize-prompt', payload as Record<
    string,
    unknown
  >);

  return typeof result.prompt === 'string' ? result.prompt : '';
};

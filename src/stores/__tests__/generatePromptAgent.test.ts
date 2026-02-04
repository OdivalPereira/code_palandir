import { describe, expect, it, vi } from 'vitest';

import { generatePromptAgent } from '../../api/client';

const mockFetchResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('generatePromptAgent', () => {
  it('converts api response into GeneratedPrompt shape', async () => {
    const apiResponse = {
      content: 'Prompt final gerado',
      metadata: {
        techniques: ['Estratégia 1', 123],
        sections: {
          context: 'Contexto gerado',
          tasks: 'Tarefas geradas',
          instructions: 'Instruções geradas',
          validation: 'Validação gerada',
        },
      },
      usage: {
        totalTokens: 321,
      },
      generatedAt: 1700000000000,
    };

    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(apiResponse));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generatePromptAgent({
      task: 'Gerar prompt',
      context: 'Contexto',
      files: ['arquivo.ts'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/generate-prompt',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result).toEqual({
      content: 'Prompt final gerado',
      tokenCount: 321,
      techniquesApplied: ['Estratégia 1'],
      sections: {
        context: 'Contexto gerado',
        tasks: 'Tarefas geradas',
        instructions: 'Instruções geradas',
        validation: 'Validação gerada',
      },
      generatedAt: 1700000000000,
    });

    vi.unstubAllGlobals();
  });
});

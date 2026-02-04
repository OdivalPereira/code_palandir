import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import PromptBuilder from '../../components/PromptBuilder';
import { useGraphStore } from '../graphStore';
import type { GeneratedPrompt } from '../../types';
import { generatePromptAgent } from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    generatePromptAgent: vi.fn(),
  };
});

describe('PromptBuilder', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders generated content, techniques, and sections after mock response', async () => {
    const mockResponse: GeneratedPrompt = {
      content: 'Prompt refinado pela IA',
      tokenCount: 120,
      techniquesApplied: ['Few-shot', 'Chain of thought'],
      sections: {
        context: 'Contexto refinado',
        tasks: 'Tarefas refinadas',
        instructions: 'Instruções refinadas',
        validation: 'Validação refinada',
      },
      generatedAt: 1700000000000,
    };

    const generatePromptAgentMock = vi.mocked(generatePromptAgent);
    generatePromptAgentMock.mockResolvedValue(mockResponse);

    useGraphStore.setState({
      promptItems: [
        {
          id: 'context-1',
          title: 'Contexto',
          content: 'Detalhe de contexto',
          type: 'context',
        },
        {
          id: 'comment-1',
          title: 'Objetivo',
          content: 'Quero entender a mudança',
          type: 'comment',
        },
      ],
      moduleInputs: [
        {
          id: 'module-1',
          name: 'Core',
          files: ['src/core.ts'],
          dependencies: ['react'],
        },
      ],
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PromptBuilder />);
    });

    const refineButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Refinar com IA'),
    );

    expect(refineButton).toBeTruthy();

    await act(async () => {
      refineButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('Prompt refinado pela IA');
    expect(container.textContent).toContain('Técnicas aplicadas: Few-shot, Chain of thought');
    expect(container.textContent).toContain('Contexto refinado');
    expect(container.textContent).toContain('Tarefas refinadas');
    expect(container.textContent).toContain('Instruções refinadas');
    expect(container.textContent).toContain('Validação refinada');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

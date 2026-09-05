import { describe, it, expect } from 'vitest';
import { generatePromptText, estimateTokens } from '@/features/prompt/usePromptGenerator';
import { PROMPT_TEMPLATES } from '@/features/prompt/PromptTemplates';
import type { SelectedElement } from '@/types/prompt';

describe('usePromptGenerator', () => {
  it('generates a structured prompt with selected elements and instructions', () => {
    const template = PROMPT_TEMPLATES[0]; // Feature template
    const selected: SelectedElement[] = [
      {
        id: '1',
        label: 'LoginForm',
        nodeType: 'component',
        filePath: 'src/components/LoginForm.tsx',
        codeSnippet: 'export function LoginForm() { return <form>...</form>; }',
      },
      {
        id: '2',
        label: 'onSubmit: handleSubmit',
        nodeType: 'action',
        filePath: 'src/components/LoginForm.tsx',
        codeSnippet: 'const handleSubmit = async () => { ... }',
      },
    ];

    const result = generatePromptText(template, 'Adicionar autenticação com Google OAuth', selected, 'react');

    expect(result).toContain('# Contexto para IA: Tarefa no Projeto Frontend');
    expect(result).toContain('REACT');
    expect(result).toContain('Adicionar autenticação com Google OAuth');
    expect(result).toContain('[COMPONENT] LoginForm');
    expect(result).toContain('[ACTION] onSubmit: handleSubmit');
    expect(result).toContain('src/components/LoginForm.tsx');
    expect(result).toContain('export function LoginForm()');
  });

  it('correctly estimates tokens', () => {
    const text = 'Este é um teste simples para contagem de tokens';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(30);
  });
});

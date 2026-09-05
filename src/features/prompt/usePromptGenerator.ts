import type { SelectedElement, PromptTemplate } from '@/types/prompt';
import type { SupportedFramework } from '@/types/project';

export function generatePromptText(
  template: PromptTemplate,
  userGoal: string,
  selectedElements: SelectedElement[],
  framework: SupportedFramework = 'react'
): string {
  const lines: string[] = [];

  // Header & Role
  lines.push(`# Contexto para IA: Tarefa no Projeto Frontend`);
  lines.push(``);
  lines.push(`> **Framework:** ${framework.toUpperCase()}`);
  lines.push(`> **Tipo de Solicitação:** ${template.name}`);
  lines.push(``);
  lines.push(`## Papel`);
  lines.push(template.systemRole);
  lines.push(``);

  // Goal
  lines.push(`## Objetivo Solicitado`);
  lines.push(userGoal || template.defaultGoal);
  lines.push(``);

  // Selected Elements
  lines.push(`## Elementos e Fluxos Selecionados no Projeto`);
  if (selectedElements.length === 0) {
    lines.push(`*(Nenhum elemento específico selecionado — use o contexto geral do projeto)*`);
  } else {
    lines.push(`Foram selecionados **${selectedElements.length} elemento(s)** diretamente no mapa de fluxo da aplicação:`);
    lines.push(``);

    selectedElements.forEach((el, index) => {
      lines.push(`### ${index + 1}. [${el.nodeType.toUpperCase()}] ${el.label}`);
      if (el.filePath) {
        lines.push(`- **Arquivo:** \`${el.filePath}\``);
      }
      if (el.codeSnippet) {
        const lang = detectSnippetLanguage(el.filePath);
        lines.push(`- **Código / Trecho Relevante:**`);
        lines.push('```' + lang);
        lines.push(el.codeSnippet.trim());
        lines.push('```');
      }
      lines.push(``);
    });
  }

  // Framework Best Practices
  lines.push(`## Boas Práticas da Arquitetura (${framework.toUpperCase()})`);
  lines.push(getFrameworkGuidance(framework));
  lines.push(``);

  // Instructions
  lines.push(`## Instruções Específicas`);
  lines.push(template.promptInstruction);
  lines.push(``);
  lines.push(`## Formato de Saída Esperado`);
  lines.push(`1. Resumo da abordagem proposta e arquivos impactados`);
  lines.push(`2. Arquivos alterados/criados com código TypeScript completo e sem abreviações`);
  lines.push(`3. Explicação dos pontos críticos, como testar e validações de regressão`);

  return lines.join('\n');
}

function getFrameworkGuidance(framework: SupportedFramework): string {
  switch (framework) {
    case 'nextjs':
      return '- **Diretrizes Next.js:** Respeite convenções do App Router / Pages Router. Mantenha componentes Client (`"use client"`) apenas onde houver interatividade ou hooks de browser. Use Server Components para busca de dados direta quando aplicável.';
    case 'vue':
      return '- **Diretrizes Vue 3:** Use a sintaxe Composition API com `<script setup lang="ts">`. Utilize Pinia para gerenciamento de estado global e reatividade com `ref` / `computed`.';
    case 'angular':
      return '- **Diretrizes Angular:** Utilize Standalone Components, injeção de dependência via `inject()`, e Signals para estado reativo moderno quando compatível.';
    default:
      return '- **Diretrizes React:** Use TypeScript estrito, hooks customizados para regras de negócio e reutilize stores Zustand/Redux existentes sem duplicar estado.';
  }
}

export function detectSnippetLanguage(filePath?: string): string {
  if (!filePath) return 'tsx';
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'vue':
      return 'vue';
    case 'ts':
      return 'ts';
    case 'tsx':
      return 'tsx';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'js';
    case 'jsx':
      return 'jsx';
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
      return 'css';
    case 'json':
      return 'json';
    default:
      return 'tsx';
  }
}

export function estimateTokens(text: string): number {
  // Good rule of thumb for English/Portuguese code & text: ~4 characters per token
  return Math.ceil(text.length / 4);
}


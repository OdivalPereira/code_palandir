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
        const lang = el.filePath?.endsWith('.vue') ? 'vue' : 'tsx';
        lines.push(`- **Código / Trecho Relevante:**`);
        lines.push('```' + lang);
        lines.push(el.codeSnippet.trim());
        lines.push('```');
      }
      lines.push(``);
    });
  }

  // Instructions
  lines.push(`## Instruções Específicas`);
  lines.push(template.promptInstruction);
  lines.push(``);
  lines.push(`## Formato de Saída Esperado`);
  lines.push(`1. Resumo da abordagem proposta`);
  lines.push(`2. Arquivos alterados/criados com código completo e tipado`);
  lines.push(`3. Explicação dos pontos críticos e como testar`);

  return lines.join('\n');
}

export function estimateTokens(text: string): number {
  // Good rule of thumb for English/Portuguese code & text: ~4 characters per token
  return Math.ceil(text.length / 4);
}

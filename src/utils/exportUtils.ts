/**
 * Utilitários para exportação de dados em Markdown via Blob/Download.
 */

import { Thread } from '../types';

/**
 * Formata um timestamp para string legível.
 */
const formatDate = (ts: number): string => {
    return new Date(ts).toLocaleString('pt-BR');
};

/**
 * Gera o conteúdo Markdown para um conjunto de threads.
 */
type ExportContext = {
    maxTokens?: number;
    warningThreshold?: number;
    dangerThreshold?: number;
};

export const generateMarkdownExport = (threads: Thread[], context?: ExportContext): string => {
    if (threads.length === 0) {
        return '# CodeMind AI Export\n\nNenhuma thread para exportar.';
    }

    const totalTokenCount = threads.reduce((sum, thread) => sum + thread.tokenCount, 0);
    const totalMessageCount = threads.reduce((sum, thread) => sum + thread.conversation.length, 0);

    const statusCounts = threads.reduce<Record<string, number>>((acc, thread) => {
        acc[thread.status] = (acc[thread.status] ?? 0) + 1;
        return acc;
    }, {});

    const statusBreakdown = Object.entries(statusCounts)
        .map(([status, count]) => `${status}: ${count}`)
        .join(' | ');

    let md = `# CodeMind AI Session Export\n`;
    md += `**Date:** ${formatDate(Date.now())}\n`;
    md += `**Total Threads:** ${threads.length}\n`;
    md += `**Total Messages:** ${totalMessageCount}\n`;
    md += `**Total Tokens:** ${totalTokenCount}\n`;
    if (statusBreakdown) {
        md += `**Status Breakdown:** ${statusBreakdown}\n`;
    }
    if (context?.maxTokens) {
        md += `**Token Limit:** ${context.maxTokens}\n`;
    }
    if (context?.warningThreshold != null || context?.dangerThreshold != null) {
        const warning = context?.warningThreshold != null ? `${context.warningThreshold}%` : 'N/A';
        const danger = context?.dangerThreshold != null ? `${context.dangerThreshold}%` : 'N/A';
        md += `**Warning Thresholds:** ${warning} / ${danger}\n`;
    }
    md += `\n`;
    md += `---\n\n`;

    threads.forEach((thread, index) => {
        md += `## ${index + 1}. ${thread.title}\n\n`;
        md += `- **Element:** \`${thread.baseElement.path}\` (${thread.baseElement.type})\n`;
        md += `- **Status:** ${thread.status}\n`;
        md += `- **Mode:** ${thread.currentMode}\n`;
        md += `- **Tokens:** ${thread.tokenCount}\n`;
        md += `- **Created:** ${formatDate(thread.createdAt)}\n`;
        md += `- **Updated:** ${formatDate(thread.updatedAt)}\n`;
        if (thread.modesUsed.length > 0) {
            md += `- **Modes Used:** ${thread.modesUsed.join(', ')}\n`;
        }
        md += `\n`;

        if (thread.conversation.length > 0) {
            md += `### Conversation\n\n`;
            thread.conversation.forEach((msg) => {
                const roleTitle = msg.role === 'user' ? 'User' : 'CodeMind AI';
                const icon = msg.role === 'user' ? '👤' : '🤖';

                md += `#### ${icon} ${roleTitle}\n`;
                md += `${msg.content}\n\n`;
            });
        }

        if (thread.suggestions && thread.suggestions.length > 0) {
            const included = thread.suggestions.filter(s => s.included);
            if (included.length > 0) {
                md += `### Suggestions Applied\n\n`;
                included.forEach(sug => {
                    md += `- [${sug.type}] **${sug.title}**: ${sug.description}\n`;
                    if (sug.content) {
                        md += `  \`\`\`${sug.type === 'file' ? getLangFromPath(sug.path) : 'text'}\n`;
                        md += `  ${sug.content.replace(/\n/g, '\n  ')}\n`; // Indent
                        md += `  \`\`\`\n`;
                    }
                });
                md += `\n`;
            }
        }

        md += `---\n\n`;
    });

    return md;
};

/**
 * Trigger download of text content as a file.
 */
export const downloadMarkdown = (content: string, filename: string = 'codemind-export.md') => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 0);
};

const getLangFromPath = (path?: string): string => {
    if (!path) return 'text';
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    return 'text';
};

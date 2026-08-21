import React, { useState, useMemo } from 'react';
import {
  FileText,
  Copy,
  Check,
  Trash2,
  Wrench,
  Bug,
  PlusCircle,
  FileCheck2,
  Gauge
} from 'lucide-react';
import { useBasketStore } from '../stores/basketStore';
import { useGraphStore } from '../stores/graphStore';
import { selectActiveTrail } from '../stores/graphSelectors';
import { AIActionMode } from '../types';

interface PromptStudioPanelProps {
  className?: string;
}

export const PromptStudioPanel: React.FC<PromptStudioPanelProps> = ({ className = '' }) => {
  const threads = useBasketStore((state) => state.threads);
  const totalTokens = useBasketStore((state) => state.totalTokens);
  const maxTokens = useBasketStore((state) => state.maxTokens);
  const deleteThread = useBasketStore((state) => state.deleteThread);
  const clearBasket = useBasketStore((state) => state.clearBasket);
  const activeTrail = useGraphStore(selectActiveTrail);

  const [selectedIntent, setSelectedIntent] = useState<AIActionMode>('alter');
  const [customGoalInput, setCustomGoalInput] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const intentOptions: Array<{ id: AIActionMode; label: string; icon: React.ReactNode; desc: string }> = [
    { id: 'alter', label: 'Refatorar', icon: <Wrench size={13} />, desc: 'Melhorar legibilidade, desacoplar lógica e modernizar' },
    { id: 'fix', label: 'Corrigir Bug', icon: <Bug size={13} />, desc: 'Diagnosticar e corrigir comportamentos incorretos' },
    { id: 'create', label: 'Nova Feature', icon: <PlusCircle size={13} />, desc: 'Expandir funcionalidade a partir desta trilha' },
    { id: 'explore', label: 'Explicar Fluxo', icon: <FileCheck2 size={13} />, desc: 'Mapear e documentar a arquitetura ponta a ponta' }
  ];

  // Generate production-ready prompt formatted for Cursor / Windsurf / Copilot
  const generatedPrompt = useMemo(() => {
    const intentLabel = intentOptions.find((i) => i.id === selectedIntent)?.label || 'Análise';
    const goal = customGoalInput.trim() || `${intentLabel} no fluxo de execução`;

    let prompt = `# TAREFA DE ARQUITETURA & CÓDIGO: ${goal.toUpperCase()}\n\n`;
    prompt += `## OBJETIVO\n${goal}.\n\n`;

    if (activeTrail) {
      prompt += `## CONTEXTO DO ELEMENTO DE UI\n`;
      prompt += `- **Componente Raiz:** \`${activeTrail.rootName}\` (\`${activeTrail.rootPath}\`)\n`;
      prompt += `- **Trilha de Execução:** ${activeTrail.summary}\n\n`;

      prompt += `## TRILHA DE EXECUÇÃO (TOP-DOWN FLOW)\n`;
      activeTrail.nodes.forEach((node, index) => {
        if (node.includedInContext !== false) {
          prompt += `### ${index + 1}. [${node.stage.toUpperCase()}] ${node.name}\n`;
          prompt += `- **Arquivo:** \`${node.path}\`\n`;
          if (node.description) prompt += `- **Papel:** ${node.description}\n`;
          if (node.codeSnippet) {
            prompt += `\`\`\`typescript\n${node.codeSnippet}\n\`\`\`\n\n`;
          }
        }
      });
    }

    if (threads.length > 0) {
      prompt += `## ELEMENTOS ADICIONAIS NA CESTA DE CONTEXTO\n`;
      threads.forEach((thread) => {
        thread.baseElements.forEach((el) => {
          prompt += `- \`${el.name}\` (\`${el.path}\`)\n`;
          if (el.codeSnippet) {
            prompt += `\`\`\`typescript\n${el.codeSnippet}\n\`\`\`\n`;
          }
        });
      });
    }

    prompt += `\n## DIRETRIZES DE IMPLEMENTAÇÃO\n`;
    prompt += `1. Preserve a separação de camadas (UI ➔ Store/Hook ➔ API Client ➔ Tipos).\n`;
    prompt += `2. Garanta tipagem estrita no TypeScript sem uso de \`any\` solto.\n`;
    prompt += `3. Mantenha os contratos de endpoints e DTOs sincronizados.\n`;

    return prompt;
  }, [activeTrail, threads, selectedIntent, customGoalInput]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const usagePercent = Math.min(100, Math.round((totalTokens / maxTokens) * 100));

  return (
    <div className={`flex flex-col h-full bg-slate-900/95 border-l border-slate-800 text-slate-200 ${className}`}>
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 space-y-3 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                3. Contexto & Prompt Studio
              </h2>
              <p className="text-[10px] text-slate-400">Gerador para Cursor, Windsurf e Copilot</p>
            </div>
          </div>

          {threads.length > 0 && (
            <button
              onClick={clearBasket}
              className="p-1 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded transition-colors"
              title="Limpar Cesta"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Token Budget Indicator */}
        <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1 font-mono">
              <Gauge size={12} className="text-indigo-400" /> Quota de Tokens
            </span>
            <span className="font-mono text-slate-200 font-medium">
              {totalTokens.toLocaleString()} / {maxTokens.toLocaleString()} ({usagePercent}%)
            </span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                usagePercent > 80 ? 'bg-amber-400' : usagePercent > 95 ? 'bg-rose-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.max(4, usagePercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Intent Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Intenção do Desenvolvedor
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {intentOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedIntent(opt.id)}
                className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-all text-left ${
                  selectedIntent === opt.id
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-950 hover:bg-slate-800/80 text-slate-300 border border-slate-800'
                }`}
              >
                {opt.icon}
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Goal Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400">Instrução Específica (Opcional)</label>
          <input
            type="text"
            placeholder="ex: Adicionar validação de cupom de desconto antes do checkout..."
            value={customGoalInput}
            onChange={(e) => setCustomGoalInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-600"
          />
        </div>

        {/* Context Basket Items */}
        {threads.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">
                Itens na Cesta ({threads.length})
              </span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className="flex items-center justify-between p-1.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300"
                >
                  <span className="truncate max-w-[200px]" title={thread.title}>
                    {thread.title}
                  </span>
                  <button
                    onClick={() => deleteThread(thread.id)}
                    className="text-slate-500 hover:text-rose-400 p-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Prompt Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
              Prompt Gerado
            </label>
            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
            >
              {copiedPrompt ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed whitespace-pre-wrap">
            {generatedPrompt}
          </pre>
        </div>

        {/* Action Button */}
        <button
          onClick={handleCopyPrompt}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
        >
          {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
          <span>{copiedPrompt ? 'Prompt Copiado!' : 'Copiar Prompt para Cursor / Windsurf'}</span>
        </button>
      </div>
    </div>
  );
};

export default PromptStudioPanel;

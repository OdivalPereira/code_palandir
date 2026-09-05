import React, { useState } from 'react';
import { Copy, Check, Sparkles, MessageSquare, Flame, BookOpen, FlaskConical, ShieldCheck } from 'lucide-react';
import { usePromptStore } from '@/stores/promptStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { PROMPT_TEMPLATES } from './PromptTemplates';
import { SelectedElements } from './SelectedElements';
import { Button } from '@/ui/Button';
import { Badge } from '@/ui/Badge';
import { copyToClipboard } from '@/services/clipboard';

export const PromptBuilder: React.FC = () => {
  const {
    activeTemplateId,
    setTemplateId,
    userGoal,
    setUserGoal,
    getGeneratedPrompt,
    getTokenCount,
  } = usePromptStore();

  const selectedElements = useSelectionStore((state) => state.selectedElements);
  const [copied, setCopied] = useState(false);

  const promptText = getGeneratedPrompt();
  const tokenCount = getTokenCount();

  const handleCopy = async () => {
    const success = await copyToClipboard(promptText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTemplateIcon = (category: string) => {
    switch (category) {
      case 'feature': return <Sparkles className="h-3.5 w-3.5 text-indigo-400" />;
      case 'refactor': return <Flame className="h-3.5 w-3.5 text-amber-400" />;
      case 'fix': return <MessageSquare className="h-3.5 w-3.5 text-rose-400" />;
      case 'test': return <FlaskConical className="h-3.5 w-3.5 text-emerald-400" />;
      case 'explain': return <BookOpen className="h-3.5 w-3.5 text-cyan-400" />;
      case 'audit': return <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />;
      default: return <Sparkles className="h-3.5 w-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Header & Token Badge */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Gerador de Prompt para IA
          </h3>
          <p className="text-[11px] text-slate-400">
            Gera contexto cirúrgico pronto para colar no ChatGPT/Claude/Cursor.
          </p>
        </div>
        <Badge variant={tokenCount > 8000 ? 'amber' : 'emerald'} className="text-[10px] font-mono">
          ~{tokenCount.toLocaleString()} tokens
        </Badge>
      </div>

      {/* Template Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
          Modelo de Solicitação
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {PROMPT_TEMPLATES.map((tmpl) => {
            const isSelected = tmpl.id === activeTemplateId;
            return (
              <button
                key={tmpl.id}
                onClick={() => setTemplateId(tmpl.id)}
                className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-600/15 text-indigo-200 shadow-sm'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {getTemplateIcon(tmpl.category)}
                <span className="font-medium truncate">{tmpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* User Goal Input */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
          O que você deseja que a IA altere ou implemente?
        </label>
        <textarea
          value={userGoal}
          onChange={(e) => setUserGoal(e.target.value)}
          placeholder="Ex: Conectar o clique do botão Submit ao novo endpoint /api/v2/auth e tratar erros com toast..."
          rows={3}
          className="w-full rounded-xl border border-slate-700/80 bg-slate-900 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        />
      </div>

      {/* Selected Context Elements */}
      <SelectedElements />

      {/* Copy Button */}
      <div className="pt-2">
        <Button
          onClick={handleCopy}
          className={`w-full justify-center gap-2 h-10 font-semibold shadow-lg transition-all ${
            copied
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              <span>Prompt Copiado para o Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copiar Prompt ({selectedElements.length} elementos)</span>
            </>
          )}
        </Button>
      </div>

      {/* Prompt Preview */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Preview do Prompt Gerado
          </span>
        </div>
        <div className="rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-72 border border-slate-800/80 leading-relaxed shadow-inner">
          <pre className="whitespace-pre-wrap">{promptText}</pre>
        </div>
      </div>
    </div>
  );
};

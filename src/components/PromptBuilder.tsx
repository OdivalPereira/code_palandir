import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleInput } from '../types';
import { useGraphStore } from '../stores/graphStore';
import { selectModuleInputs, selectPromptItems } from '../stores/graphSelectors';
import { Trash2, Copy, MessageSquarePlus, Sparkles, Loader2 } from 'lucide-react';
import { generatePromptAgent } from '../api/client';

const buildModulesSection = (modules: ModuleInput[]) => {
  if (modules.length === 0) {
    return 'MÓDULOS IMPACTADOS:\n- (defina os módulos impactados ou use a aba de recomendações)\n';
  }

  const moduleLines = modules.flatMap((module) => {
    const files = module.files.length > 0 ? module.files : ['(arquivos pendentes)'];
    const dependencies = module.dependencies.length > 0 ? module.dependencies : ['(dependências pendentes)'];
    return [
      `- ${module.name || 'Sem nome'}`,
      `  Arquivos: ${files.join(', ')}`,
      `  Dependências: ${dependencies.join(', ')}`
    ];
  });

  return ['MÓDULOS IMPACTADOS:', ...moduleLines, ''].join('\n');
};

const buildPlanSection = () =>
  [
    'PLANO SUGERIDO:',
    '1) Confirmar objetivo da mudança e critérios de aceite.',
    '2) Mapear fluxos e contratos afetados (API, UI, integrações).',
    '3) Implementar ajustes incrementais com validações locais.',
    '4) Atualizar testes/documentação e revisar impactos indiretos.',
    '',
    'RISCOS & CHECKPOINTS:',
    '- Risco: regressões em fluxos críticos. Checkpoint: executar testes e revisar monitoramento.',
    '- Risco: impacto em dependências ocultas. Checkpoint: validar integrações e dependências externas.',
    '- Risco: divergência de requisitos. Checkpoint: alinhar requisitos com exemplos de uso.'
  ].join('\n');

const PromptBuilder: React.FC = () => {
  const items = useGraphStore(selectPromptItems);
  const modules = useGraphStore(selectModuleInputs);
  const removePromptItem = useGraphStore((state) => state.removePromptItem);
  const clearPromptItems = useGraphStore((state) => state.clearPromptItems);
  const generateFinalPrompt = useCallback(() => {
    let prompt = 'Preciso de ajuda para entender e modificar este código.\n\n';

    const contextItems = items.filter((item) => item.type === 'context');
    if (contextItems.length > 0) {
      prompt += 'CONTEXTO:\n' + contextItems.map((item) => `- ${item.content}`).join('\n') + '\n\n';
    }

    prompt += `${buildModulesSection(modules)}\n`;

    const codeItems = items.filter((item) => item.type === 'code');
    if (codeItems.length > 0) {
      prompt += 'TRECHOS CHAVE:\n';
      codeItems.forEach((item) => {
        prompt += `\n// ${item.title}\n${item.content}\n`;
      });
      prompt += '\n';
    }

    const comments = items.filter((item) => item.type === 'comment');
    if (comments.length > 0) {
      prompt += 'OBSERVAÇÕES/PERGUNTAS:\n';
      comments.forEach((item) => {
        prompt += `- ${item.content}\n`;
      });
      prompt += '\n';
    }

    prompt += `${buildPlanSection()}\n`;

    return prompt.trimEnd();
  }, [items, modules]);

  const generatedPrompt = useMemo(() => generateFinalPrompt(), [generateFinalPrompt]);
  const [editablePrompt, setEditablePrompt] = useState(generatedPrompt);
  const [isDirty, setIsDirty] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirty) {
      setEditablePrompt(generatedPrompt);
    }
  }, [generatedPrompt, isDirty]);

  const handleRefineWithAI = async () => {
    setRefineError(null);
    setIsRefining(true);
    try {
      // Tentar inferir a tarefa principal a partir dos comentários
      const taskItem = items.find(i => i.type === 'comment');
      const task = taskItem ? taskItem.content : 'Analisar e melhorar este código';

      const context = items
        .filter(i => i.type === 'context')
        .map(i => i.content)
        .join('\n');

      const files = items
        .filter(i => i.type === 'code')
        .map(i => `// ${i.title}\n${i.content}`);

      const result = await generatePromptAgent({
        task,
        context: context || undefined,
        files: files.length > 0 ? files : undefined
      });

      if (result && result.content) {
        setEditablePrompt(result.content);
        setIsDirty(true);
      }
    } catch (e) {
      console.error('AI Agent failed', e);
      setRefineError('Falha ao refinar com IA. Tente novamente.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editablePrompt);
    alert("Prompt copied to clipboard!");
  };

  const handleReset = () => {
    setEditablePrompt(generatedPrompt);
    setIsDirty(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2">
          <MessageSquarePlus size={18} className="text-indigo-400" />
          Prompt Builder
        </h2>
        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full">
          {items.length} items
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {items.length === 0 ? (
          <div className="text-center text-slate-500 mt-10 text-sm">
            <p>Your prompt basket is empty.</p>
            <p className="mt-2">Click nodes in the graph or add comments to build your prompt.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-slate-700/50 rounded-lg border border-slate-600 p-3 group hover:border-indigo-500/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${item.type === 'code' ? 'bg-blue-500/20 text-blue-300' :
                  item.type === 'context' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-green-500/20 text-green-300'
                  }`}>
                  {item.type}
                </span>
                <button
                  onClick={() => removePromptItem(item.id)}
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <h3 className="text-sm font-medium text-slate-200 mb-1">{item.title}</h3>

              {item.type === 'code' ? (
                <pre className="bg-slate-950 p-2 rounded text-xs text-slate-400 overflow-x-auto font-mono border border-slate-800">
                  {item.content.slice(0, 150)}{item.content.length > 150 ? '...' : ''}
                </pre>
              ) : (
                <p className="text-xs text-slate-400">{item.content}</p>
              )}
            </div>
          ))
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wide text-slate-400">Prompt final (editável)</label>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-indigo-300 hover:text-indigo-200"
              disabled={items.length === 0 && modules.length === 0}
            >
              Atualizar
            </button>
          </div>
          <textarea
            value={editablePrompt}
            onChange={(event) => {
              setEditablePrompt(event.target.value);
              setIsDirty(true);
            }}
            className="w-full h-64 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-900/50 space-y-2">
        <button
          onClick={handleRefineWithAI}
          disabled={isRefining || items.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 rounded-lg font-medium transition-colors"
        >
          {isRefining ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          ✨ Refinar com IA (Agent)
        </button>
        {refineError && (
          <p className="text-xs text-red-300 text-center">{refineError}</p>
        )}
        <button
          onClick={handleCopy}
          disabled={editablePrompt.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 rounded-lg font-medium transition-colors"
        >
          <Copy size={16} />
          Copy Optimized Prompt
        </button>
        <button
          onClick={clearPromptItems}
          disabled={items.length === 0}
          className="w-full text-xs text-slate-500 hover:text-slate-300 py-1"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default PromptBuilder;

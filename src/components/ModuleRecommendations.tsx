import React, { useMemo, useState } from 'react';
import { ModuleInput } from '../types';
import { Copy, Plus, Trash2 } from 'lucide-react';

interface ModuleRecommendationsProps {
  modules: ModuleInput[];
  allFiles: string[];
  onChange: (modules: ModuleInput[]) => void;
}

const buildModulePrompt = (module: ModuleInput) => {
  const files = module.files.length > 0 ? module.files : ['(defina os arquivos do módulo)'];
  const dependencies = module.dependencies.length > 0 ? module.dependencies : ['(defina as dependências)'];
  return [
    `Módulo: ${module.name || 'Sem nome'}`,
    '',
    'Arquivos:',
    ...files.map((file) => `- ${file}`),
    '',
    'Dependências:',
    ...dependencies.map((dependency) => `- ${dependency}`),
    '',
    'Sugestões para o prompt:',
    '- Explique a responsabilidade principal do módulo e seus limites.',
    '- Descreva como as dependências são usadas e por quê.',
    '- Destaque fluxos críticos e pontos de extensão.',
    '- Indique possíveis riscos ou dívidas técnicas.',
  ].join('\n');
};

const parseCommaList = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const ModuleRecommendations: React.FC<ModuleRecommendationsProps> = ({ modules, allFiles, onChange }) => {
  const [fileFilter, setFileFilter] = useState('');

  const filteredFiles = useMemo(() => {
    const query = fileFilter.trim().toLowerCase();
    if (!query) return allFiles;
    return allFiles.filter((path) => path.toLowerCase().includes(query));
  }, [allFiles, fileFilter]);

  const updateModule = (id: string, updates: Partial<ModuleInput>) => {
    onChange(modules.map((module) => (module.id === id ? { ...module, ...updates } : module)));
  };

  const handleCopy = (module: ModuleInput) => {
    const text = buildModulePrompt(module);
    navigator.clipboard.writeText(text);
    alert('Prompt do módulo copiado!');
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <div>
          <h2 className="font-semibold text-slate-100">Recomendações por módulo</h2>
          <p className="text-xs text-slate-400">Defina arquivos e dependências para gerar prompts sugeridos.</p>
        </div>
        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full">
          {modules.length} módulos
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">Filtrar arquivos</label>
          <input
            type="text"
            placeholder="Digite para filtrar arquivos"
            value={fileFilter}
            onChange={(event) => setFileFilter(event.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {modules.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8">
            <p>Nenhum módulo definido.</p>
            <p className="mt-2">Adicione um módulo para configurar arquivos e dependências.</p>
          </div>
        ) : (
          modules.map((module) => {
            const prompt = buildModulePrompt(module);
            return (
              <div key={module.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    placeholder="Nome do módulo"
                    value={module.name}
                    onChange={(event) => updateModule(module.id, { name: event.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => onChange(modules.filter((item) => item.id !== module.id))}
                    className="ml-3 text-slate-500 hover:text-red-400"
                    aria-label="Remover módulo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Arquivos do módulo</label>
                  <select
                    multiple
                    value={module.files}
                    onChange={(event) => {
                      const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                      updateModule(module.id, { files: selected });
                    }}
                    className="w-full h-28 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {filteredFiles.map((path) => (
                      <option key={path} value={path}>
                        {path}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">Use Ctrl/Cmd para selecionar múltiplos arquivos.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Dependências</label>
                  <input
                    type="text"
                    placeholder="ex: authClient, cacheRepository"
                    value={module.dependencies.join(', ')}
                    onChange={(event) => updateModule(module.id, { dependencies: parseCommaList(event.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wide text-slate-400">Prompt sugerido</label>
                    <button
                      onClick={() => handleCopy(module)}
                      className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
                    >
                      <Copy size={12} />
                      Copiar
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={prompt}
                    className="w-full h-40 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-300 font-mono"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-900/50">
        <button
          onClick={() =>
            onChange([
              ...modules,
              {
                id: Date.now().toString(),
                name: `Módulo ${modules.length + 1}`,
                files: [],
                dependencies: []
              }
            ])
          }
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus size={16} />
          Adicionar módulo
        </button>
      </div>
    </div>
  );
};

export default ModuleRecommendations;

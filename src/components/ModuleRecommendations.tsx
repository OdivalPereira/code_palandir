import React, { useMemo, useState } from 'react';
import { FlatNode, ModuleInput, SemanticLink } from '../types';
import { Copy, Plus, Trash2 } from 'lucide-react';

interface ModuleRecommendationsProps {
  modules: ModuleInput[];
  allFiles: string[];
  graphNodes: FlatNode[];
  semanticLinks: SemanticLink[];
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

const getParentFileId = (nodeId: string) => {
  const [fileId] = nodeId.split('#');
  return fileId !== nodeId ? fileId : null;
};

const ModuleRecommendations: React.FC<ModuleRecommendationsProps> = ({
  modules,
  allFiles,
  graphNodes,
  semanticLinks,
  onChange
}) => {
  const [fileFilter, setFileFilter] = useState('');
  const [changeDescription, setChangeDescription] = useState('');
  const [changeNodeId, setChangeNodeId] = useState('');

  const filteredFiles = useMemo(() => {
    const query = fileFilter.trim().toLowerCase();
    if (!query) return allFiles;
    return allFiles.filter((path) => path.toLowerCase().includes(query));
  }, [allFiles, fileFilter]);

  const nodeOptions = useMemo(() => {
    return graphNodes
      .filter((node) => node.type !== 'directory' && node.type !== 'cluster')
      .map((node) => {
        const parentFile = getParentFileId(node.id);
        const label = parentFile
          ? `${node.name} (${parentFile})`
          : node.path || node.name;
        return { id: node.id, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [graphNodes]);

  const impactedModules = useMemo(() => {
    if (!changeNodeId) return [];
    const adjacency = new Map<string, Set<string>>();
    const addEdge = (from: string, to: string) => {
      if (!from || !to) return;
      const neighbors = adjacency.get(from) ?? new Set<string>();
      neighbors.add(to);
      adjacency.set(from, neighbors);
    };

    semanticLinks.forEach((link) => {
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;
      addEdge(source, target);
      addEdge(target, source);
    });

    graphNodes.forEach((node) => {
      const parentFile = getParentFileId(node.id);
      if (!parentFile) return;
      addEdge(node.id, parentFile);
      addEdge(parentFile, node.id);
    });

    const distances = new Map<string, number>();
    const queue: string[] = [];
    const seedNodes = new Set<string>();
    seedNodes.add(changeNodeId);
    const parentFile = getParentFileId(changeNodeId);
    if (parentFile) seedNodes.add(parentFile);
    seedNodes.forEach((id) => {
      distances.set(id, 0);
      queue.push(id);
    });

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const currentDistance = distances.get(current);
      if (currentDistance === undefined) continue;
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      neighbors.forEach((neighbor) => {
        if (distances.has(neighbor)) return;
        distances.set(neighbor, currentDistance + 1);
        queue.push(neighbor);
      });
    }

    const scoredModules = modules.map((module) => {
      let minDistance: number | null = null;
      let nearestFile: string | null = null;
      module.files.forEach((file) => {
        const distance = distances.get(file);
        if (distance === undefined) return;
        if (minDistance === null || distance < minDistance) {
          minDistance = distance;
          nearestFile = file;
        }
      });
      return { module, distance: minDistance, nearestFile };
    });

    const reachable = scoredModules.filter((entry) => entry.distance !== null);
    const unreachable = scoredModules.filter((entry) => entry.distance === null);
    reachable.sort((a, b) => {
      if (a.distance === null || b.distance === null) return 0;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return (a.module.name || '').localeCompare(b.module.name || '');
    });

    return [...reachable, ...unreachable];
  }, [changeNodeId, graphNodes, modules, semanticLinks]);

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
        <div className="space-y-3 bg-slate-900/60 border border-slate-700 rounded-lg p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Entrada da mudança</h3>
            <p className="text-xs text-slate-400">
              Defina o ponto de partida e descreva a alteração para mapear impactos.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Descrição da alteração</label>
            <textarea
              value={changeDescription}
              onChange={(event) => setChangeDescription(event.target.value)}
              placeholder="Ex: Atualizar validação do login para novos requisitos."
              className="w-full h-20 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Origem da mudança</label>
            <select
              value={changeNodeId}
              onChange={(event) => setChangeNodeId(event.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Selecione um arquivo ou símbolo</option>
              {nodeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 bg-slate-900/60 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Módulos impactados</h3>
            <span className="text-[10px] text-slate-500">
              {impactedModules.length} módulos
            </span>
          </div>
          {!changeNodeId ? (
            <p className="text-xs text-slate-500">
              Selecione a origem da mudança para calcular a proximidade dos módulos.
            </p>
          ) : modules.length === 0 ? (
            <p className="text-xs text-slate-500">
              Adicione módulos para visualizar o impacto da alteração.
            </p>
          ) : (
            <ul className="space-y-2">
              {impactedModules.map(({ module, distance, nearestFile }) => (
                <li key={module.id} className="flex items-start justify-between gap-3 border border-slate-800 rounded p-3">
                  <div>
                    <p className="text-sm text-slate-100 font-semibold">{module.name || 'Sem nome'}</p>
                    <p className="text-[11px] text-slate-500">
                      {distance === null
                        ? 'Sem caminho no grafo semântico.'
                        : `Distância ${distance} a partir de ${nearestFile ?? 'arquivo do módulo'}.`}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      distance === null ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {distance === null ? 'N/A' : `+${distance}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

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

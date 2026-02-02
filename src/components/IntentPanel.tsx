import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2, Copy, Check, Database, Server, Shield, RefreshCw } from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import { FileSystemNode, FlatNode, BackendRequirements, MissingDependency } from '../types';
import {
    parseComponentIntent,
    analyzeBackendRequirements,
    detectMissingDependencies,
    generateRequirementsSummary,
    generateQuickPrompt,
    generateBackendPrompt,
} from '../services';

interface IntentPanelProps {
    className?: string;
}

export const IntentPanel: React.FC<IntentPanelProps> = ({ className = '' }) => {
    const selectedNode = useGraphStore((state) => state.selectedNode);
    const isAnalyzingIntent = useGraphStore((state) => state.isAnalyzingIntent);
    const missingDependencies = useGraphStore((state) => state.missingDependencies);
    const backendRequirements = useGraphStore((state) => state.backendRequirements);
    const setGhostNodes = useGraphStore((state) => state.setGhostNodes);
    const setMissingDependencies = useGraphStore((state) => state.setMissingDependencies);
    const setIsAnalyzingIntent = useGraphStore((state) => state.setIsAnalyzingIntent);
    const clearGhostNodes = useGraphStore((state) => state.clearGhostNodes);

    const [userIntent, setUserIntent] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [copied, setCopied] = useState(false);
    const [preferredStack, setPreferredStack] = useState<'supabase' | 'firebase'>('supabase');

    // Check if selected node is a TSX/JSX file
    const isTsxFile = selectedNode?.type === 'file' &&
        /\.(tsx|jsx)$/.test(selectedNode.name);

    const getNodeContent = useCallback((): string => {
        if (!selectedNode || selectedNode.type !== 'file') return '';
        const fsNode = selectedNode.data as FileSystemNode | undefined;
        return fsNode?.content || '';
    }, [selectedNode]);

    const handleAnalyze = async () => {
        if (!selectedNode || !isTsxFile) return;

        const content = getNodeContent();
        if (!content) {
            alert('Conteúdo do arquivo não disponível. Clique no arquivo para carregar primeiro.');
            return;
        }

        setIsAnalyzingIntent(true);
        setGeneratedPrompt('');

        try {
            // 1. Parse component intent from TSX
            const uiSchema = parseComponentIntent(content, selectedNode.name);

            // 2. Analyze backend requirements using AI
            const requirements = await analyzeBackendRequirements(uiSchema, content, []);

            // 3. Detect missing dependencies
            const missing = detectMissingDependencies(requirements, [], selectedNode.path);

            // 4. Create ghost nodes for visualization
            const ghostNodes = createGhostNodes(missing, selectedNode);
            const ghostLinks = createGhostLinks(missing, selectedNode);

            // 5. Update store
            setGhostNodes(ghostNodes, ghostLinks);
            setMissingDependencies(missing, requirements);

            // 6. Generate prompt
            const prompt = await generateBackendPrompt({
                userIntent: userIntent || `Implementar funcionalidade para ${selectedNode.name}`,
                componentCode: content,
                uiIntentSchema: uiSchema,
                projectStructure: {
                    hasBackend: false,
                    stack: ['React', 'Vite'],
                    existingEndpoints: [],
                },
                backendRequirements: requirements,
                preferredStack,
            });

            setGeneratedPrompt(prompt);
        } catch (error) {
            console.error('Intent analysis failed:', error);
            alert('Erro ao analisar intenção. Verifique o console.');
        } finally {
            setIsAnalyzingIntent(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClear = () => {
        clearGhostNodes();
        setGeneratedPrompt('');
        setUserIntent('');
    };

    // Render component
    return (
        <div className={`bg-slate-800 border-l border-slate-700 flex flex-col ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-400" />
                    Arquiteto Reverso
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                    Selecione um componente TSX e diga o que quer que ele faça
                </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!selectedNode ? (
                    <div className="text-center text-slate-500 text-sm py-8">
                        <p>Clique em um componente TSX no grafo</p>
                    </div>
                ) : !isTsxFile ? (
                    <div className="text-center text-slate-500 text-sm py-8">
                        <p>Selecione um arquivo .tsx ou .jsx</p>
                        <p className="mt-2 text-xs">Selecionado: {selectedNode.name}</p>
                    </div>
                ) : (
                    <>
                        {/* Selected Component */}
                        <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                            <span className="text-xs text-slate-400">Componente:</span>
                            <p className="text-indigo-400 font-mono text-sm">{selectedNode.name}</p>
                        </div>

                        {/* User Intent Input */}
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">
                                O que esse componente deve fazer?
                            </label>
                            <textarea
                                value={userIntent}
                                onChange={(e) => setUserIntent(e.target.value)}
                                placeholder="Ex: Cadastrar usuário e enviar email de boas-vindas"
                                className="w-full h-20 bg-slate-900 text-white p-2 rounded border border-slate-600 text-sm resize-none focus:border-purple-500 focus:outline-none"
                            />
                        </div>

                        {/* Stack Selector */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPreferredStack('supabase')}
                                className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${preferredStack === 'supabase'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                Supabase
                            </button>
                            <button
                                onClick={() => setPreferredStack('firebase')}
                                className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${preferredStack === 'firebase'
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                Firebase
                            </button>
                        </div>

                        {/* Analyze Button */}
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzingIntent}
                            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 rounded-lg font-medium transition-colors"
                        >
                            {isAnalyzingIntent ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Analisando...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    Analisar Intenção
                                </>
                            )}
                        </button>

                        {/* Results: Missing Dependencies */}
                        {missingDependencies.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                                    Infraestrutura Necessária
                                </h3>

                                {missingDependencies.map((dep) => (
                                    <div
                                        key={dep.id}
                                        className={`p-2 rounded border text-xs ${getDepStyle(dep.type)}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {getDepIcon(dep.type)}
                                            <span className="font-medium">{dep.name}</span>
                                        </div>
                                        <p className="text-slate-400 mt-1">{dep.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Generated Prompt */}
                        {generatedPrompt && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold text-slate-300">
                                    Prompt para Cursor/Windsurf
                                </h3>
                                <pre className="bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-auto max-h-48 border border-slate-700 whitespace-pre-wrap">
                                    {generatedPrompt.slice(0, 500)}
                                    {generatedPrompt.length > 500 && '...'}
                                </pre>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCopy}
                                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm font-medium"
                                    >
                                        {copied ? (
                                            <>
                                                <Check size={14} />
                                                Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={14} />
                                                Copiar Prompt
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleClear}
                                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ============================================
// Helper Functions
// ============================================

function createGhostNodes(missing: MissingDependency[], sourceNode: FlatNode): FlatNode[] {
    return missing.map((dep, index) => ({
        id: `ghost_${dep.id}`,
        name: dep.name,
        type: dep.type === 'table' ? 'ghost_table' :
            dep.type === 'endpoint' ? 'ghost_endpoint' : 'ghost_service',
        path: `ghost_${dep.id}`,
        group: sourceNode.group + 1,
        relevant: false,
        isGhost: true,
        dependencyStatus: 'missing' as const,
        ghostData: dep,
        x: (sourceNode.x || 0) + 150 + (index * 50),
        y: (sourceNode.y || 0) + 50 + (index * 30),
    }));
}

function createGhostLinks(missing: MissingDependency[], sourceNode: FlatNode): any[] {
    return missing.map((dep) => ({
        source: sourceNode.id,
        target: `ghost_${dep.id}`,
        edgeStyle: 'dashed' as const,
        dependencyType: 'missing' as const,
    }));
}

function getDepStyle(type: MissingDependency['type']): string {
    switch (type) {
        case 'table':
            return 'border-blue-500/50 bg-blue-500/10';
        case 'endpoint':
            return 'border-green-500/50 bg-green-500/10';
        case 'service':
        case 'auth':
            return 'border-purple-500/50 bg-purple-500/10';
        default:
            return 'border-slate-600 bg-slate-700/50';
    }
}

function getDepIcon(type: MissingDependency['type']) {
    switch (type) {
        case 'table':
            return <Database size={12} className="text-blue-400" />;
        case 'endpoint':
            return <Server size={12} className="text-green-400" />;
        case 'service':
        case 'auth':
            return <Shield size={12} className="text-purple-400" />;
        default:
            return null;
    }
}

export default IntentPanel;

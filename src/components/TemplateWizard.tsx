import React, { useState } from 'react';
import { X, Check, Database, Server, Shield, ChevronRight, Sparkles } from 'lucide-react';
import { TemplateComponent } from './TemplateSidebar';
import { FlatNode, Link, MissingDependency } from '../types';
import { useGraphStore } from '../stores/graphStore';
import { selectSelectedNode, selectWizardTemplate } from '../stores/graphSelectors';

export const TemplateWizard: React.FC = () => {
    const template = useGraphStore(selectWizardTemplate);
    const targetComponent = useGraphStore(selectSelectedNode);
    const setWizardTemplate = useGraphStore((state) => state.setWizardTemplate);
    const setGhostData = useGraphStore((state) => state.setGhostData);
    if (!template) return null;
    const [step, setStep] = useState<'customize' | 'preview' | 'done'>('customize');
    const [selectedComponents, setSelectedComponents] = useState<Set<number>>(
        new Set(template.components.map((_, i) => i))
    );
    const [customNames, setCustomNames] = useState<Record<number, string>>({});
    const [preferredStack, setPreferredStack] = useState<'supabase' | 'firebase' | 'express'>('supabase');

    const toggleComponent = (index: number) => {
        setSelectedComponents(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const getComponentIcon = (type: TemplateComponent['type']) => {
        switch (type) {
            case 'table': return <Database size={14} className="text-blue-400" />;
            case 'endpoint': return <Server size={14} className="text-green-400" />;
            case 'service': return <Shield size={14} className="text-purple-400" />;
        }
    };

    const handleApply = () => {
        const selectedComps = template.components.filter((_, i) => selectedComponents.has(i));

        // Create ghost nodes for each selected component
        const baseX = targetComponent?.x || 300;
        const baseY = targetComponent?.y || 300;

        const ghostNodes: FlatNode[] = selectedComps.map((comp, idx) => {
            const customName = customNames[template.components.indexOf(comp)] || comp.name;
            const nodeType = comp.type === 'table' ? 'ghost_table' :
                comp.type === 'endpoint' ? 'ghost_endpoint' : 'ghost_service';

            return {
                id: `template_${template.id}_${idx}`,
                name: customName,
                type: nodeType,
                path: `template_${template.id}_${idx}`,
                group: (targetComponent?.group || 1) + 1,
                relevant: false,
                isGhost: true,
                dependencyStatus: 'missing' as const,
                ghostData: {
                    id: `template_${template.id}_${idx}`,
                    name: customName,
                    type: comp.type,
                    description: comp.description,
                    suggestedStack: preferredStack === 'supabase' ? 'supabase' : preferredStack === 'firebase' ? 'firebase' : 'custom',
                    requiredBy: [targetComponent?.id].filter(Boolean) as string[],
                },
                x: baseX + 150 + (idx % 3) * 100,
                y: baseY + Math.floor(idx / 3) * 80,
            };
        });

        // Create links from target component or as standalone nodes
        const ghostLinks: Link[] = targetComponent
            ? ghostNodes.map(node => ({
                source: targetComponent.id,
                target: node.id,
                edgeStyle: 'dashed' as const,
                dependencyType: 'missing' as const,
            }))
            : [];

        // Create missing dependencies list
        const deps: MissingDependency[] = selectedComps.map((comp, idx) => ({
            id: `template_${template.id}_${idx}`,
            name: customNames[template.components.indexOf(comp)] || comp.name,
            type: comp.type,
            description: comp.description,
            suggestedStack: preferredStack === 'supabase' ? 'supabase' : preferredStack === 'firebase' ? 'firebase' : 'custom',
            requiredBy: [targetComponent?.id].filter(Boolean) as string[],
        }));

        setGhostData(ghostNodes, ghostLinks, deps);
        setStep('done');

        setTimeout(() => {
            setWizardTemplate(null);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {template.icon}
                        <h2 className="font-semibold text-lg text-white">{template.name}</h2>
                    </div>
                    <button
                        onClick={() => setWizardTemplate(null)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {step === 'customize' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400">{template.description}</p>

                            {/* Stack Selector */}
                            <div>
                                <label className="text-xs font-medium text-slate-300 mb-2 block">Stack Backend</label>
                                <div className="flex gap-2">
                                    {(['supabase', 'firebase', 'express'] as const).map(stack => (
                                        <button
                                            key={stack}
                                            onClick={() => setPreferredStack(stack)}
                                            className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors capitalize ${preferredStack === stack
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                        >
                                            {stack}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Components List */}
                            <div>
                                <label className="text-xs font-medium text-slate-300 mb-2 block">
                                    Componentes ({selectedComponents.size}/{template.components.length})
                                </label>
                                <div className="space-y-2">
                                    {template.components.map((comp, idx) => (
                                        <div
                                            key={idx}
                                            className={`p-3 rounded border transition-colors cursor-pointer ${selectedComponents.has(idx)
                                                ? 'bg-slate-700/50 border-indigo-500'
                                                : 'bg-slate-900/50 border-slate-700 opacity-50'
                                                }`}
                                            onClick={() => toggleComponent(idx)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedComponents.has(idx)}
                                                    onChange={() => toggleComponent(idx)}
                                                    className="accent-indigo-500"
                                                />
                                                {getComponentIcon(comp.type)}
                                                <input
                                                    type="text"
                                                    value={customNames[idx] ?? comp.name}
                                                    onChange={(e) => setCustomNames(prev => ({ ...prev, [idx]: e.target.value }))}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex-1 bg-transparent border-b border-transparent focus:border-slate-500 text-sm text-slate-200 outline-none font-mono"
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 ml-6">{comp.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Target Info */}
                            {targetComponent && (
                                <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                        <ChevronRight size={12} />
                                        Conectando a: <span className="text-indigo-400 font-medium">{targetComponent.name}</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                <Check size={32} className="text-green-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">Template Aplicado!</h3>
                            <p className="text-sm text-slate-400 text-center">
                                {selectedComponents.size} componentes adicionados ao grafo
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'customize' && (
                    <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
                        <button
                            onClick={() => setWizardTemplate(null)}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={selectedComponents.size === 0}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded flex items-center gap-2 transition-colors"
                        >
                            <Sparkles size={14} />
                            Aplicar Template
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TemplateWizard;

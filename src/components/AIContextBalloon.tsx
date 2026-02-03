import React from 'react';
import { Search, Sparkles, Pencil, Wrench, Link2, HelpCircle, X } from 'lucide-react';
import { AIActionMode, FlatNode } from '../types';

interface AIContextBalloonProps {
    selectedNode: FlatNode;
    position: { x: number; y: number };
    onSelectAction: (mode: AIActionMode) => void;
    onClose: () => void;
}

interface ActionItem {
    mode: AIActionMode;
    icon: React.ReactNode;
    label: string;
    description: string;
    color: string;
    hoverColor: string;
}

const actions: ActionItem[] = [
    {
        mode: 'explore',
        icon: <Search size={16} />,
        label: 'Explorar',
        description: 'O que esse elemento faz?',
        color: 'text-sky-400',
        hoverColor: 'hover:bg-sky-500/20',
    },
    {
        mode: 'create',
        icon: <Sparkles size={16} />,
        label: 'Criar',
        description: 'Criar algo novo aqui',
        color: 'text-emerald-400',
        hoverColor: 'hover:bg-emerald-500/20',
    },
    {
        mode: 'alter',
        icon: <Pencil size={16} />,
        label: 'Alterar',
        description: 'Modificar funcionalidade',
        color: 'text-amber-400',
        hoverColor: 'hover:bg-amber-500/20',
    },
    {
        mode: 'fix',
        icon: <Wrench size={16} />,
        label: 'Corrigir',
        description: 'Resolver problema/bug',
        color: 'text-rose-400',
        hoverColor: 'hover:bg-rose-500/20',
    },
    {
        mode: 'connect',
        icon: <Link2 size={16} />,
        label: 'Conectar',
        description: 'Ligar a outro elemento',
        color: 'text-violet-400',
        hoverColor: 'hover:bg-violet-500/20',
    },
    {
        mode: 'ask',
        icon: <HelpCircle size={16} />,
        label: 'Perguntar',
        description: 'Pergunta livre',
        color: 'text-slate-300',
        hoverColor: 'hover:bg-slate-500/20',
    },
];

const AIContextBalloon: React.FC<AIContextBalloonProps> = ({
    selectedNode,
    position,
    onSelectAction,
    onClose,
}) => {
    // Adjust balloon position to stay within viewport
    const balloonWidth = 220;
    const balloonHeight = 320;

    const adjustedX = Math.min(
        position.x + 30,
        window.innerWidth - balloonWidth - 20
    );
    const adjustedY = Math.min(
        position.y - balloonHeight / 2,
        window.innerHeight - balloonHeight - 20
    );

    return (
        <div
            className="absolute z-50 animate-in fade-in slide-in-from-left-2 duration-200"
            style={{
                left: Math.max(20, adjustedX),
                top: Math.max(20, adjustedY),
            }}
        >
            <div className="bg-slate-900/95 backdrop-blur-lg border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-[220px]">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-800/50">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-violet-400 animate-pulse" />
                        <span className="text-xs font-medium text-slate-200">Assistente IA</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                        aria-label="Fechar"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Selected Node Info */}
                <div className="px-3 py-2 border-b border-slate-700/30">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                        Elemento selecionado
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getNodeTypeColor(selectedNode.type)}`} />
                        <span className="text-sm font-medium text-slate-100 truncate" title={selectedNode.name}>
                            {selectedNode.name}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 truncate" title={selectedNode.path}>
                        {selectedNode.path}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-2">
                        O que deseja fazer?
                    </div>
                    <div className="space-y-1">
                        {actions.map((action) => (
                            <button
                                key={action.mode}
                                onClick={() => onSelectAction(action.mode)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${action.hoverColor} group`}
                            >
                                <span className={`${action.color} group-hover:scale-110 transition-transform`}>
                                    {action.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-200 group-hover:text-white">
                                        {action.label}
                                    </div>
                                    <div className="text-[10px] text-slate-500 group-hover:text-slate-400 truncate">
                                        {action.description}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer tip */}
                <div className="px-3 py-2 border-t border-slate-700/30 bg-slate-800/30">
                    <div className="text-[10px] text-slate-500 text-center">
                        Clique em uma ação para começar
                    </div>
                </div>
            </div>
        </div>
    );
};

function getNodeTypeColor(type: FlatNode['type']): string {
    switch (type) {
        case 'directory':
            return 'bg-blue-500';
        case 'file':
            return 'bg-slate-500';
        case 'function':
            return 'bg-green-400';
        case 'class':
            return 'bg-pink-400';
        case 'api_endpoint':
            return 'bg-purple-400';
        case 'cluster':
            return 'bg-slate-700 border border-sky-300';
        case 'ghost_table':
            return 'bg-blue-500/30 border border-dashed border-blue-400';
        case 'ghost_endpoint':
            return 'bg-green-500/30 border border-dashed border-green-400';
        case 'ghost_service':
            return 'bg-purple-500/30 border border-dashed border-purple-400';
        default:
            return 'bg-slate-400';
    }
}

export default AIContextBalloon;

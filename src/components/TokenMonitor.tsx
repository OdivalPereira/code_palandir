/**
 * TokenMonitor - Monitor visual de uso de tokens.
 * 
 * Exibe barra de progresso com cores verde/amarelo/vermelho
 * baseado no uso de tokens em relação ao limite máximo.
 */

import React, { useMemo } from 'react';
import { Zap, AlertTriangle, Sparkles } from 'lucide-react';
import { useBasketStore } from '../stores/basketStore';

// ============================================
// Types
// ============================================

interface TokenMonitorProps {
    /** Exibir versão compacta (para sidebar) */
    compact?: boolean;
    /** Classe CSS adicional */
    className?: string;
}

// ============================================
// Constants
// ============================================

const STATUS_COLORS = {
    ok: {
        bg: 'bg-emerald-500/20',
        bar: 'bg-emerald-500',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
    },
    warning: {
        bg: 'bg-amber-500/20',
        bar: 'bg-amber-500',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
    },
    danger: {
        bg: 'bg-rose-500/20',
        bar: 'bg-rose-500',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
    },
};

const STATUS_ICONS = {
    ok: <Zap size={14} />,
    warning: <AlertTriangle size={14} />,
    danger: <AlertTriangle size={14} />,
};

const STATUS_LABELS = {
    ok: 'Dentro do limite',
    warning: 'Próximo do limite',
    danger: 'Limite excedido',
};

// ============================================
// Component
// ============================================

const TokenMonitor: React.FC<TokenMonitorProps> = ({ compact = false, className = '' }) => {
    // Store hooks
    const totalTokens = useBasketStore(state => state.totalTokens);
    const maxTokens = useBasketStore(state => state.maxTokens);
    const getTokenUsagePercent = useBasketStore(state => state.getTokenUsagePercent);
    const getTokenStatus = useBasketStore(state => state.getTokenStatus);
    const threads = useBasketStore(state => state.threads);

    // Derived values
    const percent = useMemo(() => getTokenUsagePercent(), [getTokenUsagePercent, totalTokens]);
    const status = useMemo(() => getTokenStatus(), [getTokenStatus, totalTokens]);
    const colors = STATUS_COLORS[status];

    // Format numbers
    const formatTokens = (n: number) => {
        if (n >= 1000) {
            return `${(n / 1000).toFixed(1)}k`;
        }
        return n.toString();
    };

    // Active threads count
    const activeThreads = threads.filter(t => t.status === 'active').length;

    if (compact) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className={`p-1 rounded ${colors.bg}`}>
                    <span className={colors.text}>{STATUS_ICONS[status]}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${colors.bar} transition-all duration-300`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                    </div>
                </div>
                <span className={`text-xs ${colors.text} font-medium`}>
                    {formatTokens(totalTokens)}
                </span>
            </div>
        );
    }

    return (
        <div className={`bg-slate-800/50 border ${colors.border} rounded-lg p-3 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className={colors.text}>{STATUS_ICONS[status]}</span>
                    <span className="text-sm font-medium text-slate-200">Uso de Tokens</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                    {STATUS_LABELS[status]}
                </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                <div
                    className={`h-full ${colors.bar} transition-all duration-300`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                    {formatTokens(totalTokens)} / {formatTokens(maxTokens)} tokens
                </span>
                <span className={colors.text}>
                    {percent.toFixed(1)}%
                </span>
            </div>

            {/* Thread info */}
            {activeThreads > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                        {activeThreads} thread{activeThreads !== 1 ? 's' : ''} ativa{activeThreads !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={() => {/* TODO: Open optimize dialog */ }}
                        className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                    >
                        <Sparkles size={12} />
                        <span>Otimizar</span>
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================
// Compact variant for embedding
// ============================================

export const TokenMonitorCompact: React.FC<{ className?: string }> = ({ className }) => (
    <TokenMonitor compact className={className} />
);

export default TokenMonitor;

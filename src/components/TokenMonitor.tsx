/**
 * TokenMonitor - Monitor visual de uso de tokens.
 * 
 * Exibe barra de progresso com cores verde/amarelo/vermelho
 * baseado no uso de tokens em relação ao limite máximo.
 */

import React, { useId, useState } from 'react';
import { Zap, AlertTriangle, AlertOctagon, Sparkles } from 'lucide-react';
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
    safe: {
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
    critical: {
        bg: 'bg-rose-500/20',
        bar: 'bg-rose-500',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
    },
};

const STATUS_ICONS = {
    safe: <Zap size={14} />,
    warning: <AlertTriangle size={14} />,
    critical: <AlertOctagon size={14} />,
};

const STATUS_LABELS = {
    safe: 'Dentro do limite',
    warning: 'Próximo do limite',
    critical: 'Limite excedido',
};

// ============================================
// Component
// ============================================

const TokenMonitor: React.FC<TokenMonitorProps> = ({ compact = false, className = '' }) => {
    // Store hooks
    const totalTokens = useBasketStore(state => state.totalTokens);
    const maxTokens = useBasketStore(state => state.maxTokens);
    const warningThreshold = useBasketStore(state => state.warningThreshold);
    const dangerThreshold = useBasketStore(state => state.dangerThreshold);
    const threads = useBasketStore(state => state.threads);
    const activeThreadId = useBasketStore(state => state.activeThreadId);
    const compactThread = useBasketStore(state => state.compactThread);
    const [isCompacting, setIsCompacting] = useState(false);

    // Derived values
    const percent = maxTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;
    const status =
        percent >= dangerThreshold
            ? 'critical'
            : percent >= warningThreshold
              ? 'warning'
              : 'safe';
    const colors = STATUS_COLORS[status];

    // Format numbers
    const formatTokens = (n: number) => {
        if (n >= 1000) {
            return `${(n / 1000).toFixed(1)}k`;
        }
        return n.toString();
    };
    const formatFullTokens = (n: number) =>
        new Intl.NumberFormat('pt-BR').format(n);
    const formatPercent = (n: number) =>
        new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(n);

    const tooltipId = useId();
    const tooltipText = `${formatFullTokens(totalTokens)} / ${formatFullTokens(maxTokens)} tokens (${formatPercent(percent)}%)`;

    // Active threads count
    const activeThreads = threads.filter(t => t.status === 'active').length;
    const canCompact = Boolean(activeThreadId) && !isCompacting;

    const handleCompact = () => {
        if (!activeThreadId || isCompacting) return;
        setIsCompacting(true);
        try {
            compactThread(activeThreadId);
        } finally {
            window.setTimeout(() => setIsCompacting(false), 300);
        }
    };

    if (compact) {
        return (
            <div
                className={`flex items-center gap-2 ${className}`}
                title={tooltipText}
                aria-describedby={tooltipId}
                tabIndex={0}
            >
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
                <span id={tooltipId} className="sr-only">
                    {tooltipText}
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
            <div
                className="flex items-center justify-between text-xs"
                title={tooltipText}
                aria-describedby={tooltipId}
                tabIndex={0}
            >
                <span className="text-slate-400">
                    {formatTokens(totalTokens)} / {formatTokens(maxTokens)} tokens
                </span>
                <span className={colors.text}>
                    {percent.toFixed(1)}%
                </span>
                <span id={tooltipId} className="sr-only">
                    {tooltipText}
                </span>
            </div>

            {/* Thread info */}
            {activeThreads > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                        {activeThreads} thread{activeThreads !== 1 ? 's' : ''} ativa{activeThreads !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={handleCompact}
                        disabled={!canCompact}
                        className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors disabled:cursor-not-allowed disabled:text-sky-300/50"
                    >
                        <Sparkles size={12} />
                        <span>{isCompacting ? 'Compactando...' : 'Otimizar'}</span>
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

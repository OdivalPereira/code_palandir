/**
 * ThreadLibrary - Biblioteca de threads salvas.
 * 
 * Permite buscar, filtrar e carregar threads anteriores para continuar o trabalho.
 */

import React, { useState, useMemo, useRef } from 'react';
import {
    Search,
    BookOpen,
    Calendar,
    Tag,
    Trash2,
    CornerUpRight,
    X,
    MessageSquare,
    Download,
    Upload
} from 'lucide-react';
import { useBasketStore } from '../stores/basketStore';
import { SavedThread, AIActionMode, AI_ACTION_LABELS } from '../types';

// ============================================
// Types
// ============================================

interface ThreadLibraryProps {
    onClose: () => void;
    className?: string;
}

// ============================================
// Utils
// ============================================

const MODE_COLORS: Record<AIActionMode, string> = {
    explore: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    create: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    alter: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    fix: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    connect: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
    ask: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
};

const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(timestamp));
};

// ============================================
// Component
// ============================================

const ThreadLibrary: React.FC<ThreadLibraryProps> = ({ onClose, className = '' }) => {
    const library = useBasketStore(state => state.library);
    const loadFromLibrary = useBasketStore(state => state.loadFromLibrary);
    const deleteFromLibrary = useBasketStore(state => state.deleteFromLibrary);
    const exportThreadsSnapshot = useBasketStore(state => state.exportThreadsSnapshot);
    const restoreThreadsSnapshot = useBasketStore(state => state.restoreThreadsSnapshot);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const importInputRef = useRef<HTMLInputElement | null>(null);

    // Extract all unique tags
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        library.forEach(t => t.tags?.forEach(tag => tags.add(tag)));
        return Array.from(tags).sort();
    }, [library]);

    // Filter threads
    const filteredThreads = useMemo(() => {
        return library.filter(thread => {
            // Search filter
            const searchLower = searchTerm.toLowerCase().replace(/#/g, '');
            const matchesSearch =
                thread.title.toLowerCase().includes(searchLower) ||
                thread.userNote?.toLowerCase().includes(searchLower) ||
                thread.baseElement.name.toLowerCase().includes(searchLower) ||
                thread.tags?.some(tag => tag.toLowerCase().includes(searchLower));

            if (!matchesSearch) return false;

            // Tag filter
            if (selectedTags.length > 0) {
                if (!thread.tags) return false;
                const hasAllTags = selectedTags.every(tag => thread.tags.includes(tag));
                if (!hasAllTags) return false;
            }

            return true;
        }).sort((a, b) => b.savedAt - a.savedAt); // Most recent first
    }, [library, searchTerm, selectedTags]);

    const handleLoad = (thread: SavedThread, mode: 'restore' | 'duplicate') => {
        loadFromLibrary(thread.id, mode);
        onClose(); // Close library after loading
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja remover esta thread da biblioteca?')) {
            deleteFromLibrary(id);
        }
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    const handleExportSnapshot = () => {
        const json = exportThreadsSnapshot();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        anchor.href = url;
        anchor.download = `basket-threads-${timestamp}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        if (!confirm('Importar threads substituirá o Basket atual. Deseja continuar?')) {
            return;
        }
        importInputRef.current?.click();
    };

    const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const json = await file.text();
            const result = restoreThreadsSnapshot(json);
            if (!result.ok) {
                alert(result.error ?? 'Não foi possível importar o snapshot.');
            } else {
                alert(`Snapshot importado com sucesso (${result.importedThreads ?? 0} threads).`);
            }
        } catch {
            alert('Não foi possível ler o arquivo selecionado.');
        } finally {
            event.target.value = '';
        }
    };

    return (
        <div className={`flex flex-col h-full bg-slate-900 w-full ${className}`}>
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BookOpen className="text-sky-400" size={20} />
                        <h2 className="font-semibold text-slate-100">Biblioteca</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportSnapshot}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-700 text-slate-300 hover:border-sky-500 hover:text-sky-300 transition-colors"
                            title="Exportar snapshot do Basket"
                            type="button"
                        >
                            <Download size={12} />
                            Exportar
                        </button>
                        <button
                            onClick={handleImportClick}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-700 text-slate-300 hover:border-sky-500 hover:text-sky-300 transition-colors"
                            title="Importar snapshot do Basket"
                            type="button"
                        >
                            <Upload size={12} />
                            Importar
                        </button>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                    <input
                        type="text"
                        placeholder="Buscar threads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                </div>

                {/* Tags Filter */}
                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                        {allTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${selectedTags.includes(tag)
                                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                                    }`}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportChange}
                className="hidden"
            />

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredThreads.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <BookOpen size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Nenhuma thread encontrada</p>
                    </div>
                ) : (
                    filteredThreads.map(thread => (
                        <div
                            key={thread.id}
                            className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors"
                        >
                            {/* Card Header */}
                            <div
                                className="p-3 cursor-pointer"
                                onClick={() => setExpandedId(expandedId === thread.id ? null : thread.id)}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-medium text-slate-200 truncate">
                                            {thread.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] px-1.5 rounded border ${MODE_COLORS[thread.currentMode]}`}>
                                                {AI_ACTION_LABELS[thread.currentMode]}
                                            </span>
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <Calendar size={10} />
                                                {formatDate(thread.savedAt)}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => handleDelete(e, thread.id)}
                                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Tags */}
                                {thread.tags && thread.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {thread.tags.map(tag => (
                                            <span key={tag} className="text-[10px] text-slate-400 bg-slate-900 px-1.5 rounded">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Expanded Details */}
                            {expandedId === thread.id && (
                                <div className="border-t border-slate-700/50 bg-slate-900/30 p-3">
                                    {thread.userNote && (
                                        <div className="mb-3 text-sm text-slate-400 italic bg-slate-800/50 p-2 rounded">
                                            "{thread.userNote}"
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 mb-3">
                                        <div className="flex items-center gap-1">
                                            <MessageSquare size={10} />
                                            {thread.conversation.length} mensagens
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Tag size={10} />
                                            {thread.tokenCount} tokens
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleLoad(thread, 'restore')}
                                            className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-sm py-1.5 rounded transition-colors"
                                        >
                                            <CornerUpRight size={14} />
                                            Restaurar
                                        </button>
                                        <button
                                            onClick={() => handleLoad(thread, 'duplicate')}
                                            className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm py-1.5 rounded transition-colors"
                                        >
                                            <CornerUpRight size={14} />
                                            Duplicar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ThreadLibrary;

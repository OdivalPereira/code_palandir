/**
 * ContextualChat - Painel de chat contextual com IA.
 * 
 * Permite conversar com a IA sobre um elemento específico do código,
 * com suporte a 6 modos híbridos que podem ser trocados durante a conversa.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    X,
    Send,
    Loader2,
    Search,
    Sparkles,
    Pencil,
    Wrench,
    Link2,
    HelpCircle,
    ChevronDown,
    Plus,
    Copy,
    Check,
    FileCode,
    Database,
    Server,
    Lightbulb,
    Bot,
    User,
} from 'lucide-react';
import {
    AIActionMode,
    AI_ACTION_LABELS,
    ChatMessage,
    FlatNode,
    Thread,
    ThreadSuggestion,
} from '../types';
import { useBasketStore } from '../stores/basketStore';
import {
    sendChatMessage,
    getInputPlaceholder,
    ChatContext,
} from '../services/chatService';
import { TokenMonitorCompact } from './TokenMonitor';

// ============================================
// Types
// ============================================

interface ContextualChatProps {
    /** Nó selecionado como base da conversa */
    selectedNode: FlatNode;
    /** Modo inicial (vindo do balão) */
    initialMode: AIActionMode;
    /** Callback para fechar o chat */
    onClose: () => void;
}

// ============================================
// Mode Icons
// ============================================

const MODE_ICONS: Record<AIActionMode, React.ReactNode> = {
    explore: <Search size={14} />,
    create: <Sparkles size={14} />,
    alter: <Pencil size={14} />,
    fix: <Wrench size={14} />,
    connect: <Link2 size={14} />,
    ask: <HelpCircle size={14} />,
};

const MODE_COLORS: Record<AIActionMode, string> = {
    explore: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    create: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    alter: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    fix: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    connect: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    ask: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
    file: <FileCode size={14} />,
    api: <Server size={14} />,
    snippet: <FileCode size={14} />,
    migration: <Database size={14} />,
    table: <Database size={14} />,
    service: <Server size={14} />,
};

// ============================================
// Component
// ============================================

const ContextualChat: React.FC<ContextualChatProps> = ({
    selectedNode,
    initialMode,
    onClose,
}) => {
    // Store hooks
    const createThread = useBasketStore(state => state.createThread);
    const addMessage = useBasketStore(state => state.addMessage);
    const addPendingAssistantMessage = useBasketStore(state => state.addPendingAssistantMessage);
    const updateAssistantMessage = useBasketStore(state => state.updateAssistantMessage);
    const updateMessage = useBasketStore(state => state.updateMessage);
    const retryMessage = useBasketStore(state => state.retryMessage);
    const switchMode = useBasketStore(state => state.switchMode);
    const addSuggestion = useBasketStore(state => state.addSuggestion);
    const setFollowUpQuestions = useBasketStore(state => state.setFollowUpQuestions);
    const getActiveThread = useBasketStore(state => state.getActiveThread);

    // Local state
    const [currentThread, setCurrentThread] = useState<Thread | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showModeSelector, setShowModeSelector] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [libraryNote, setLibraryNote] = useState('');
    const [libraryTagInput, setLibraryTagInput] = useState('');
    const [libraryTags, setLibraryTags] = useState<string[]>([]);
    const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Inicializar thread ao montar
    useEffect(() => {
        const thread = createThread(selectedNode, initialMode);
        setCurrentThread(thread);
    }, [selectedNode, initialMode, createThread]);

    // Atualizar thread quando mudar no store
    useEffect(() => {
        const active = getActiveThread();
        if (active && active.id === currentThread?.id) {
            setCurrentThread(active);
        }
    }, [getActiveThread, currentThread?.id]);

    // Scroll para última mensagem
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentThread?.conversation]);

    // Focus no input
    useEffect(() => {
        inputRef.current?.focus();
    }, [currentThread?.currentMode]);

    // Enviar mensagem
    const sendMessageWithContent = useCallback(async (content: string, messageId?: string) => {
        if (!currentThread || !content.trim() || isLoading) return;

        const userMessageContent = content.trim();
        setError(null);
        setIsLoading(true);

        const userMessageId = messageId ?? addMessage(currentThread.id, 'user', userMessageContent);
        if (messageId) {
            retryMessage(currentThread.id, messageId, userMessageContent);
        }
        const pendingMessageId = addPendingAssistantMessage(currentThread.id);

        try {
            const context: ChatContext = {
                mode: currentThread.currentMode,
                element: currentThread.baseElement,
                conversationHistory: currentThread.conversation,
            };

            const response = await sendChatMessage({
                userMessage: userMessageContent,
                context,
            });

            updateAssistantMessage(currentThread.id, pendingMessageId, {
                content: response.response,
                status: 'sent',
                error: null,
            });

            updateMessage(currentThread.id, userMessageId, {
                status: 'sent',
                error: null,
            });

            for (const suggestion of response.suggestions) {
                addSuggestion(currentThread.id, suggestion);
            }

            if (response.followUpQuestions.length > 0) {
                setFollowUpQuestions(currentThread.id, response.followUpQuestions);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
            setError(message);
            updateAssistantMessage(currentThread.id, pendingMessageId, {
                content: message,
                status: 'failed',
                error: message,
            });
            updateMessage(currentThread.id, userMessageId, {
                status: 'failed',
                error: message,
            });
        } finally {
            setIsLoading(false);
            setEditingMessageId(null);
        }
    }, [
        currentThread,
        isLoading,
        retryMessage,
        addMessage,
        addPendingAssistantMessage,
        updateAssistantMessage,
        updateMessage,
        addSuggestion,
        setFollowUpQuestions,
    ]);

    const handleSend = useCallback(async () => {
        if (!currentThread || !inputValue.trim() || isLoading) return;

        const userMessageContent = inputValue.trim();
        const targetMessageId = editingMessageId ?? undefined;
        setInputValue('');
        await sendMessageWithContent(userMessageContent, targetMessageId);
    }, [currentThread, inputValue, isLoading, editingMessageId, sendMessageWithContent]);

    // Mudar modo
    const handleModeChange = useCallback((mode: AIActionMode) => {
        if (currentThread) {
            switchMode(currentThread.id, mode);
            setCurrentThread(prev => prev ? { ...prev, currentMode: mode } : null);
        }
        setShowModeSelector(false);
    }, [currentThread, switchMode]);

    // Copiar código
    const handleCopy = useCallback((id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);

    const handleRetry = useCallback((message: ChatMessage) => {
        if (!currentThread || isLoading) return;
        sendMessageWithContent(message.content, message.id);
    }, [currentThread, isLoading, sendMessageWithContent]);

    const handleEdit = useCallback((message: ChatMessage) => {
        setInputValue(message.content);
        setEditingMessageId(message.id);
        inputRef.current?.focus();
    }, []);

    // Keyboard handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleAddTag = useCallback((rawTag: string) => {
        const normalized = rawTag.trim().toLowerCase();
        if (!normalized) return;
        setLibraryTags(prev => (prev.includes(normalized) ? prev : [...prev, normalized]));
        setLibraryTagInput('');
    }, []);

    const handleRemoveTag = useCallback((tag: string) => {
        setLibraryTags(prev => prev.filter(item => item !== tag));
    }, []);

    const handleSaveToLibrary = useCallback(() => {
        if (!currentThread) {
            setSaveFeedback({ type: 'error', message: 'Nenhuma thread ativa para salvar.' });
            return;
        }

        try {
            useBasketStore.getState().saveToLibrary(
                currentThread.id,
                libraryNote.trim(),
                libraryTags,
            );
            setSaveFeedback({ type: 'success', message: 'Thread salva na biblioteca.' });
            setIsSaveModalOpen(false);
            setLibraryNote('');
            setLibraryTagInput('');
            setLibraryTags([]);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao salvar na biblioteca.';
            setSaveFeedback({ type: 'error', message });
        }
    }, [currentThread, libraryNote, libraryTags]);

    if (!currentThread) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-slate-400" size={24} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-700">
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-violet-400 animate-pulse" />
                        <span className="font-semibold text-slate-100">Chat Contextual</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Element info */}
                <div className="px-4 py-2 bg-slate-800/50">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">Sobre:</span>
                        <span className="font-medium text-slate-200">{selectedNode.name}</span>
                        <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-700/50 rounded">
                            {selectedNode.type}
                        </span>
                    </div>
                    {/* Token Monitor */}
                    <TokenMonitorCompact className="mt-2" />
                </div>

                {/* Mode selector */}
                <div className="px-4 py-2 border-t border-slate-700/50">
                    <div className="relative">
                        <button
                            onClick={() => setShowModeSelector(!showModeSelector)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${MODE_COLORS[currentThread.currentMode]}`}
                        >
                            {MODE_ICONS[currentThread.currentMode]}
                            <span>{AI_ACTION_LABELS[currentThread.currentMode]}</span>
                            <ChevronDown size={14} className={`transition-transform ${showModeSelector ? 'rotate-180' : ''}`} />
                        </button>

                        {showModeSelector && (
                            <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[160px]">
                                {(Object.keys(AI_ACTION_LABELS) as AIActionMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => handleModeChange(mode)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-700/50 transition-colors ${mode === currentThread.currentMode ? 'bg-slate-700/30' : ''
                                            }`}
                                    >
                                        <span className={MODE_COLORS[mode].split(' ')[1]}>{MODE_ICONS[mode]}</span>
                                        <span className="text-slate-200">{AI_ACTION_LABELS[mode]}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Modes used badges */}
                    {currentThread.modesUsed.length > 1 && (
                        <div className="flex items-center gap-1 mt-2">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Modos usados:</span>
                            {currentThread.modesUsed.map(mode => (
                                <span
                                    key={mode}
                                    className={`text-[10px] px-1.5 py-0.5 rounded ${MODE_COLORS[mode]}`}
                                >
                                    {AI_ACTION_LABELS[mode]}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {currentThread.conversation.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className={`p-3 rounded-full mb-4 ${MODE_COLORS[currentThread.currentMode]}`}>
                            {MODE_ICONS[currentThread.currentMode]}
                        </div>
                        <p className="text-slate-400 text-sm mb-2">
                            Modo: <span className="text-slate-200">{AI_ACTION_LABELS[currentThread.currentMode]}</span>
                        </p>
                        <p className="text-slate-500 text-xs">
                            Envie uma mensagem para começar a conversa sobre <span className="text-slate-300">{selectedNode.name}</span>
                        </p>
                    </div>
                ) : (
                    currentThread.conversation.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            onCopy={handleCopy}
                            copiedId={copiedId}
                            onRetry={handleRetry}
                            onEdit={handleEdit}
                            isLoading={isLoading}
                        />
                    ))
                )}

                {/* Error message */}
                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-rose-400 text-sm">
                        {error}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {currentThread.suggestions.length > 0 && (
                <div className="flex-shrink-0 border-t border-slate-700 px-4 py-3 bg-slate-800/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Lightbulb size={14} className="text-amber-400" />
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Sugestões</span>
                        <span className="text-[10px] text-slate-500">
                            {currentThread.suggestions.length} sugestões
                        </span>
                    </div>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto">
                        {currentThread.suggestions.map((sug) => (
                            <SuggestionCard
                                key={sug.id}
                                suggestion={sug}
                                onCopy={handleCopy}
                                copiedId={copiedId}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="flex-shrink-0 border-t border-slate-700 p-4">
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={getInputPlaceholder(currentThread.currentMode)}
                        rows={2}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading}
                        className="self-end p-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                </div>

                {/* Save to library button */}
                <button
                    onClick={() => {
                        setIsSaveModalOpen(true);
                        setSaveFeedback(null);
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                >
                    <Plus size={14} />
                    <span>Salvar na biblioteca</span>
                </button>

                {saveFeedback && (
                    <div
                        className={`mt-2 rounded-lg px-3 py-2 text-xs ${saveFeedback.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            }`}
                    >
                        {saveFeedback.message}
                    </div>
                )}
            </div>

            {isSaveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
                    <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-100">Salvar na biblioteca</h3>
                                <p className="text-xs text-slate-500">
                                    Adicione uma nota e tags para encontrar esta thread depois.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsSaveModalOpen(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                aria-label="Fechar modal de biblioteca"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4 px-4 py-4">
                            <div>
                                <label className="text-xs font-medium text-slate-300">Nota</label>
                                <textarea
                                    value={libraryNote}
                                    onChange={(event) => setLibraryNote(event.target.value)}
                                    rows={3}
                                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                                    placeholder="Adicione um contexto ou lembrete..."
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-300">Tags</label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {libraryTags.map(tag => (
                                        <span
                                            key={tag}
                                            className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200"
                                        >
                                            #{tag}
                                            <button
                                                onClick={() => handleRemoveTag(tag)}
                                                className="text-slate-400 hover:text-slate-100"
                                                aria-label={`Remover tag ${tag}`}
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        value={libraryTagInput}
                                        onChange={(event) => setLibraryTagInput(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                handleAddTag(libraryTagInput);
                                            }
                                        }}
                                        placeholder="Digite uma tag e pressione Enter"
                                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/20"
                                    />
                                    <button
                                        onClick={() => handleAddTag(libraryTagInput)}
                                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 transition-colors hover:border-sky-500/40 hover:text-slate-100"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-slate-700 px-4 py-3">
                            <button
                                onClick={() => setIsSaveModalOpen(false)}
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 transition-colors hover:border-slate-500 hover:text-slate-100"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveToLibrary}
                                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// Sub-components
// ============================================

interface MessageBubbleProps {
    message: ChatMessage;
    onCopy: (id: string, content: string) => void;
    copiedId: string | null;
    onRetry: (message: ChatMessage) => void;
    onEdit: (message: ChatMessage) => void;
    isLoading: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
    message,
    onCopy,
    copiedId,
    onRetry,
    onEdit,
    isLoading,
}) => {
    const isUser = message.role === 'user';
    const isPending = message.role === 'assistant' && message.status === 'pending';
    const isFailed = message.role === 'assistant' && message.status === 'failed';
    const isUserFailed = message.role === 'user' && message.status === 'failed';
    const roleTheme = isUser
        ? {
            bubble: 'bg-sky-500/20 border-sky-400/40 text-slate-100',
            headerText: 'text-sky-100',
            badge: 'bg-sky-500/25 border-sky-400/40 text-sky-100',
            icon: <User size={12} />,
            label: 'Você',
        }
        : {
            bubble: 'bg-slate-800 border-slate-700 text-slate-100',
            headerText: 'text-slate-200',
            badge: 'bg-slate-700/60 border-slate-600 text-slate-200',
            icon: <Bot size={12} />,
            label: 'IA',
        };

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-lg px-3 py-2 border ${roleTheme.bubble}`}
            >
                <div className="flex items-center justify-between gap-3 mb-2 text-[11px] font-medium uppercase tracking-wide">
                    <div className={`flex items-center gap-1.5 ${roleTheme.headerText}`}>
                        {roleTheme.icon}
                        <span>{roleTheme.label}</span>
                    </div>
                    <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${roleTheme.badge}`}>
                        {MODE_ICONS[message.mode]}
                        <span className="text-[10px] font-semibold normal-case">
                            {AI_ACTION_LABELS[message.mode]}
                        </span>
                    </div>
                </div>

                {/* Content */}
                {isPending ? (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Loader2 className="animate-spin" size={14} />
                        <span>{message.content || 'Pensando...'}</span>
                    </div>
                ) : (
                    <div
                        className={`text-sm whitespace-pre-wrap ${isFailed ? 'text-rose-300' : ''}`}
                    >
                        {message.content}
                    </div>
                )}

                {/* Copy button for assistant messages */}
                {!isUser && message.status === 'sent' && (
                    <button
                        onClick={() => onCopy(message.id, message.content)}
                        className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        {copiedId === message.id ? (
                            <>
                                <Check size={12} />
                                <span>Copiado!</span>
                            </>
                        ) : (
                            <>
                                <Copy size={12} />
                                <span>Copiar</span>
                            </>
                        )}
                    </button>
                )}

                {isUserFailed && (
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            onClick={() => onRetry(message)}
                            disabled={isLoading}
                            className="text-[10px] px-2 py-1 rounded border border-rose-400/40 text-rose-100 hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Tentar novamente
                        </button>
                        <button
                            onClick={() => onEdit(message)}
                            disabled={isLoading}
                            className="text-[10px] px-2 py-1 rounded border border-slate-400/40 text-slate-100 hover:bg-slate-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Editar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface SuggestionCardProps {
    suggestion: ThreadSuggestion;
    onCopy: (id: string, content: string) => void;
    copiedId: string | null;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion, onCopy, copiedId }) => {
    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-amber-400">{SUGGESTION_ICONS[suggestion.type] || <FileCode size={14} />}</span>
                    <span className="text-sm font-medium text-slate-200">{suggestion.title}</span>
                    <span className="text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-700/50 rounded">
                        {suggestion.type}
                    </span>
                </div>
                {suggestion.content && (
                    <button
                        onClick={() => onCopy(suggestion.id, suggestion.content!)}
                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        {copiedId === suggestion.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                )}
            </div>
            {suggestion.description && (
                <p className="text-xs text-slate-400 mt-1">{suggestion.description}</p>
            )}
        </div>
    );
};

export default ContextualChat;

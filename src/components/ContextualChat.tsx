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
    const handleSend = useCallback(async () => {
        if (!currentThread || !inputValue.trim() || isLoading) return;

        const userMessageContent = inputValue.trim();
        setInputValue('');
        setError(null);
        setIsLoading(true);

        // Adicionar mensagem do usuário
        addMessage(currentThread.id, 'user', userMessageContent);
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

            // Atualizar resposta da IA
            updateAssistantMessage(currentThread.id, pendingMessageId, {
                content: response.response,
                status: 'sent',
                error: null,
            });

            // Adicionar sugestões
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
        } finally {
            setIsLoading(false);
        }
    }, [
        currentThread,
        inputValue,
        isLoading,
        addMessage,
        addPendingAssistantMessage,
        updateAssistantMessage,
        addSuggestion,
        setFollowUpQuestions,
    ]);

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

    // Keyboard handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

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
                    </div>
                    <div className="space-y-2 max-h-[120px] overflow-y-auto">
                        {currentThread.suggestions.slice(-3).map((sug) => (
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

                {/* Add to basket button */}
                <button
                    onClick={() => {/* TODO: Add to basket UI */ }}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
                >
                    <Plus size={14} />
                    <span>Adicionar ao Basket</span>
                </button>
            </div>
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
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onCopy, copiedId }) => {
    const isUser = message.role === 'user';
    const isPending = message.role === 'assistant' && message.status === 'pending';
    const isFailed = message.role === 'assistant' && message.status === 'failed';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${isUser
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-100 border border-slate-700'
                    }`}
            >
                {/* Mode badge for user messages */}
                {isUser && (
                    <div className="flex items-center gap-1 mb-1 text-[10px] text-sky-200/70">
                        {MODE_ICONS[message.mode]}
                        <span>{AI_ACTION_LABELS[message.mode]}</span>
                    </div>
                )}

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

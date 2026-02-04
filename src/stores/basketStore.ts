/**
 * Basket Store - Gerencia threads de trabalho e monitora uso de tokens.
 * 
 * O Basket é a "cesta" onde o usuário acumula threads de conversa com a IA.
 * Cada thread representa uma sessão focada sobre um elemento específico.
 */

import { create } from './zustand';
import {
    AIActionMode,
    BasketState,
    ChatMessage,
    FlatNode,
    SavedThread,
    Thread,
    ThreadBaseElement,
    ThreadSuggestion,
} from '../types';

// ============================================
// Token Estimation Utils
// ============================================

/**
 * Estima número de tokens em um texto.
 * Aproximação: ~4 caracteres = 1 token para inglês/português.
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Calcula tokens totais de uma thread.
 */
function calculateThreadTokens(thread: Thread): number {
    let tokens = 0;

    // Tokens do elemento base
    tokens += estimateTokens(thread.baseElement.name + thread.baseElement.path);
    if (thread.baseElement.codeSnippet) {
        tokens += estimateTokens(thread.baseElement.codeSnippet);
    }

    // Tokens das mensagens
    for (const msg of thread.conversation) {
        tokens += msg.tokenEstimate ?? estimateTokens(msg.content);
    }

    // Tokens das sugestões incluídas
    for (const sug of thread.suggestions) {
        if (sug.included) {
            tokens += estimateTokens(sug.title + sug.description + (sug.content ?? ''));
        }
    }

    return tokens;
}

// ============================================
// Library Storage (LocalStorage)
// ============================================

const LIBRARY_STORAGE_KEY = 'codemind-thread-library';
const LEGACY_LIBRARY_STORAGE_KEY = 'codemind:thread-library';

function loadLibraryFromStorage(): SavedThread[] {
    try {
        const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }

        const legacyStored = localStorage.getItem(LEGACY_LIBRARY_STORAGE_KEY);
        if (legacyStored) {
            const threads = JSON.parse(legacyStored) as SavedThread[];
            localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(threads));
            return threads;
        }

        return [];
    } catch {
        return [];
    }
}

function saveLibraryToStorage(threads: SavedThread[]): void {
    try {
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(threads));
    } catch (e) {
        console.error('Failed to save thread library:', e);
    }
}

// ============================================
// Snapshot Serialization
// ============================================

const THREAD_SNAPSHOT_VERSION = 1;

type ThreadSnapshot = {
    version: number;
    exportedAt: number;
    activeThreadId: string | null;
    threads: Thread[];
    metadata: {
        totalTokens: number;
        maxTokens: number;
        warningThreshold: number;
        dangerThreshold: number;
    };
};

const VALID_MODES: AIActionMode[] = ['explore', 'create', 'alter', 'fix', 'connect', 'ask'];
const VALID_SUGGESTION_TYPES: ThreadSuggestion['type'][] = [
    'file',
    'api',
    'snippet',
    'migration',
    'table',
    'service',
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

function asChatMessages(value: unknown, fallbackMode: AIActionMode, now: number): ChatMessage[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => {
            if (!isRecord(item)) return null;
            const role = item.role === 'user' || item.role === 'assistant' ? item.role : null;
            const content = asString(item.content, '');
            if (!role || !content) return null;
            const status =
                item.status === 'pending' || item.status === 'sent' || item.status === 'failed'
                    ? item.status
                    : 'sent';
            return {
                id: asString(item.id, `msg-${now}-${Math.random().toString(36).substr(2, 9)}`),
                role,
                content,
                mode: VALID_MODES.includes(item.mode as AIActionMode) ? (item.mode as AIActionMode) : fallbackMode,
                timestamp: asNumber(item.timestamp, now),
                tokenEstimate: typeof item.tokenEstimate === 'number' ? item.tokenEstimate : estimateTokens(content),
                status,
                error: typeof item.error === 'string' ? item.error : undefined,
            } satisfies ChatMessage;
        })
        .filter((item): item is ChatMessage => item !== null);
}

function asSuggestions(value: unknown): ThreadSuggestion[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => {
            if (!isRecord(item)) return null;
            const type = VALID_SUGGESTION_TYPES.includes(item.type as ThreadSuggestion['type'])
                ? (item.type as ThreadSuggestion['type'])
                : null;
            const title = asString(item.title, '');
            const description = asString(item.description, '');
            if (!type || !title || !description) return null;
            const lines =
                Array.isArray(item.lines) && item.lines.length === 2
                    ? (item.lines as [number, number])
                    : undefined;
            return {
                id: asString(item.id, `sug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
                type,
                title,
                description,
                content: typeof item.content === 'string' ? item.content : undefined,
                path: typeof item.path === 'string' ? item.path : undefined,
                lines,
                included: asBoolean(item.included, true),
            } satisfies ThreadSuggestion;
        })
        .filter((item): item is ThreadSuggestion => item !== null);
}

function sanitizeThread(input: unknown, now: number): Thread | null {
    if (!isRecord(input)) return null;
    const baseElementRaw = isRecord(input.baseElement) ? input.baseElement : null;
    if (!baseElementRaw) return null;
    const baseElement: ThreadBaseElement = {
        nodeId: asString(baseElementRaw.nodeId, ''),
        name: asString(baseElementRaw.name, ''),
        path: asString(baseElementRaw.path, ''),
        type: asString(baseElementRaw.type, ''),
        codeSnippet: typeof baseElementRaw.codeSnippet === 'string' ? baseElementRaw.codeSnippet : undefined,
    };
    if (!baseElement.nodeId || !baseElement.name || !baseElement.path || !baseElement.type) {
        return null;
    }

    const currentMode = VALID_MODES.includes(input.currentMode as AIActionMode)
        ? (input.currentMode as AIActionMode)
        : 'ask';
    const modesUsed = Array.isArray(input.modesUsed)
        ? input.modesUsed.filter((mode): mode is AIActionMode => VALID_MODES.includes(mode as AIActionMode))
        : [];

    const conversation = asChatMessages(input.conversation, currentMode, now);
    const suggestions = asSuggestions(input.suggestions);
    const followUpQuestions = asStringArray(input.followUpQuestions);
    const status =
        input.status === 'active' || input.status === 'paused' || input.status === 'completed'
            ? input.status
            : 'active';

    const sanitized: Thread = {
        id: asString(input.id, `thread-${now}-${Math.random().toString(36).substr(2, 9)}`),
        title: asString(input.title, `${currentMode}: ${baseElement.name}`),
        baseElement,
        modesUsed: modesUsed.length > 0 ? modesUsed : [currentMode],
        currentMode,
        conversation,
        suggestions,
        followUpQuestions,
        tokenCount: 0,
        status,
        createdAt: asNumber(input.createdAt, now),
        updatedAt: asNumber(input.updatedAt, now),
    };

    sanitized.tokenCount = calculateThreadTokens(sanitized);
    return sanitized;
}

// ============================================
// Store Interface
// ============================================

interface BasketStore extends BasketState {
    // Thread management
    createThread: (node: FlatNode, mode: AIActionMode) => Thread;
    deleteThread: (threadId: string) => void;
    setActiveThread: (threadId: string | null) => void;
    getActiveThread: () => Thread | null;

    // Conversation
    addMessage: (threadId: string, role: 'user' | 'assistant', content: string) => string;
    addPendingAssistantMessage: (threadId: string, content?: string) => string;
    updateAssistantMessage: (
        threadId: string,
        messageId: string,
        updates: { content?: string; status?: ChatMessage['status']; error?: string | null }
    ) => void;
    updateMessage: (
        threadId: string,
        messageId: string,
        updates: { content?: string; status?: ChatMessage['status']; error?: string | null }
    ) => void;
    retryMessage: (threadId: string, messageId: string, content?: string) => void;
    switchMode: (threadId: string, newMode: AIActionMode) => void;

    // Suggestions
    addSuggestion: (threadId: string, suggestion: Omit<ThreadSuggestion, 'id' | 'included'>) => void;
    toggleSuggestionIncluded: (threadId: string, suggestionId: string) => void;
    setFollowUpQuestions: (threadId: string, questions: string[]) => void;

    // Token management
    recalculateTokens: () => void;
    getTokenUsagePercent: () => number;
    getTokenStatus: () => 'safe' | 'warning' | 'critical';

    // Library
    library: SavedThread[];
    saveToLibrary: (threadId: string, note: string, tags?: string[]) => void;
    loadFromLibrary: (savedThreadId: string) => void;
    deleteFromLibrary: (savedThreadId: string) => void;

    // Import/Export
    exportThreadsSnapshot: () => string;
    restoreThreadsSnapshot: (
        json: string
    ) => { ok: boolean; error?: string; importedThreads?: number };

    // Prompt generation
    getThreadsForPrompt: () => Thread[];
    markThreadCompleted: (threadId: string) => void;

    // Reset
    clearBasket: () => void;
}

// ============================================
// Store Implementation
// ============================================

const DEFAULT_MAX_TOKENS = 100000; // ~100k tokens de contexto
const DEFAULT_WARNING_THRESHOLD = 80; // 80%
const DEFAULT_DANGER_THRESHOLD = 95; // 95%

export const useBasketStore = create<BasketStore>((set, get) => ({
    // Initial state
    threads: [],
    activeThreadId: null,
    totalTokens: 0,
    maxTokens: DEFAULT_MAX_TOKENS,
    warningThreshold: DEFAULT_WARNING_THRESHOLD,
    dangerThreshold: DEFAULT_DANGER_THRESHOLD,
    library: loadLibraryFromStorage(),

    // ==========================================
    // Thread Management
    // ==========================================

    createThread: (node: FlatNode, mode: AIActionMode) => {
        const baseElement: ThreadBaseElement = {
            nodeId: node.id,
            name: node.name,
            path: node.path,
            type: node.type,
        };

        const now = Date.now();
        const newThread: Thread = {
            id: `thread-${now}-${Math.random().toString(36).substr(2, 9)}`,
            title: `${mode}: ${node.name}`,
            baseElement,
            modesUsed: [mode],
            currentMode: mode,
            conversation: [],
            suggestions: [],
            followUpQuestions: [],
            tokenCount: 0,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        };

        newThread.tokenCount = calculateThreadTokens(newThread);

        set(state => ({
            threads: [...state.threads, newThread],
            activeThreadId: newThread.id,
            totalTokens: state.totalTokens + newThread.tokenCount,
        }));

        return newThread;
    },

    deleteThread: (threadId: string) => {
        set(state => {
            const thread = state.threads.find(t => t.id === threadId);
            const tokensToRemove = thread?.tokenCount ?? 0;

            return {
                threads: state.threads.filter(t => t.id !== threadId),
                activeThreadId: state.activeThreadId === threadId ? null : state.activeThreadId,
                totalTokens: Math.max(0, state.totalTokens - tokensToRemove),
            };
        });
    },

    setActiveThread: (threadId: string | null) => {
        set({ activeThreadId: threadId });
    },

    getActiveThread: () => {
        const state = get();
        return state.threads.find(t => t.id === state.activeThreadId) ?? null;
    },

    // ==========================================
    // Conversation
    // ==========================================

    addMessage: (threadId: string, role: 'user' | 'assistant', content: string) => {
        const timestamp = Date.now();
        const message: ChatMessage = {
            id: `msg-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
            role,
            content,
            mode: get().threads.find(t => t.id === threadId)?.currentMode ?? 'ask',
            timestamp,
            tokenEstimate: estimateTokens(content),
            status: 'sent',
        };

        set(state => {
            const threads = state.threads.map(t => {
                if (t.id !== threadId) return t;

                const existingIndex = t.conversation.findIndex(
                    msg =>
                        msg.id === message.id ||
                        (msg.role === message.role &&
                            msg.content === message.content &&
                            msg.timestamp === message.timestamp)
                );
                const conversation =
                    existingIndex >= 0
                        ? t.conversation.map((msg, index) =>
                              index === existingIndex
                                  ? { ...msg, ...message, tokenEstimate: message.tokenEstimate }
                                  : msg
                          )
                        : [...t.conversation, message];
                const updated = {
                    ...t,
                    conversation,
                    updatedAt: Date.now(),
                };
                updated.tokenCount = calculateThreadTokens(updated);
                return updated;
            });

            return {
                threads,
                totalTokens: threads.reduce((sum, t) => sum + t.tokenCount, 0),
            };
        });

        return message.id;
    },

    addPendingAssistantMessage: (threadId: string, content = 'Pensando...') => {
        const timestamp = Date.now();
        const message: ChatMessage = {
            id: `msg-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content,
            mode: get().threads.find(t => t.id === threadId)?.currentMode ?? 'ask',
            timestamp,
            tokenEstimate: estimateTokens(content),
            status: 'pending',
        };

        set(state => {
            const threads = state.threads.map(t => {
                if (t.id !== threadId) return t;

                const updated = {
                    ...t,
                    conversation: [...t.conversation, message],
                    updatedAt: Date.now(),
                };
                updated.tokenCount = calculateThreadTokens(updated);
                return updated;
            });

            return {
                threads,
                totalTokens: threads.reduce((sum, t) => sum + t.tokenCount, 0),
            };
        });

        return message.id;
    },

    updateAssistantMessage: (
        threadId: string,
        messageId: string,
        updates: { content?: string; status?: ChatMessage['status']; error?: string | null }
    ) => {
        set(state => {
            const threads = state.threads.map(t => {
                if (t.id !== threadId) return t;

                const conversation = t.conversation.map(msg => {
                    if (msg.id !== messageId || msg.role !== 'assistant') return msg;
                    const content = updates.content ?? msg.content;
                    return {
                        ...msg,
                        content,
                        status: updates.status ?? msg.status,
                        error:
                            updates.error === null
                                ? undefined
                                : updates.error ?? msg.error,
                        tokenEstimate:
                            updates.content !== undefined
                                ? estimateTokens(content)
                                : msg.tokenEstimate,
                    };
                });

                const updated = {
                    ...t,
                    conversation,
                    updatedAt: Date.now(),
                };
                updated.tokenCount = calculateThreadTokens(updated);
                return updated;
            });

            return {
                threads,
                totalTokens: threads.reduce((sum, t) => sum + t.tokenCount, 0),
            };
        });
    },

    updateMessage: (
        threadId: string,
        messageId: string,
        updates: { content?: string; status?: ChatMessage['status']; error?: string | null }
    ) => {
        set(state => {
            const threads = state.threads.map(t => {
                if (t.id !== threadId) return t;

                const conversation = t.conversation.map(msg => {
                    if (msg.id !== messageId) return msg;
                    const content = updates.content ?? msg.content;
                    return {
                        ...msg,
                        content,
                        status: updates.status ?? msg.status,
                        error: updates.error === null ? undefined : updates.error ?? msg.error,
                        tokenEstimate:
                            updates.content !== undefined ? estimateTokens(content) : msg.tokenEstimate,
                    };
                });

                const updated = {
                    ...t,
                    conversation,
                    updatedAt: Date.now(),
                };
                updated.tokenCount = calculateThreadTokens(updated);
                return updated;
            });

            return {
                threads,
                totalTokens: threads.reduce((sum, t) => sum + t.tokenCount, 0),
            };
        });
    },

    retryMessage: (threadId: string, messageId: string, content?: string) => {
        get().updateMessage(threadId, messageId, {
            status: 'pending',
            error: null,
            content,
        });
    },

    switchMode: (threadId: string, newMode: AIActionMode) => {
        set(state => ({
            threads: state.threads.map(t => {
                if (t.id !== threadId) return t;

                const modesUsed = t.modesUsed.includes(newMode)
                    ? t.modesUsed
                    : [...t.modesUsed, newMode];

                return {
                    ...t,
                    currentMode: newMode,
                    modesUsed,
                    updatedAt: Date.now(),
                };
            }),
        }));
    },

    // ==========================================
    // Suggestions
    // ==========================================

    addSuggestion: (threadId: string, suggestion: Omit<ThreadSuggestion, 'id' | 'included'>) => {
        const fullSuggestion: ThreadSuggestion = {
            ...suggestion,
            id: `sug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            included: true, // Included by default
        };

        set(state => {
            const threads = state.threads.map(t => {
                if (t.id !== threadId) return t;

                const updated = {
                    ...t,
                    suggestions: [...t.suggestions, fullSuggestion],
                    updatedAt: Date.now(),
                };
                updated.tokenCount = calculateThreadTokens(updated);
                return updated;
            });

            return {
                threads,
                totalTokens: threads.reduce((sum, t) => sum + t.tokenCount, 0),
            };
        });
    },

    toggleSuggestionIncluded: (threadId: string, suggestionId: string) => {
        set(state => {
            const threads = state.threads.map(t => {
                if (t.id !== threadId) return t;

                const updated = {
                    ...t,
                    suggestions: t.suggestions.map(s =>
                        s.id === suggestionId ? { ...s, included: !s.included } : s
                    ),
                    updatedAt: Date.now(),
                };
                updated.tokenCount = calculateThreadTokens(updated);
                return updated;
            });

            return {
                threads,
                totalTokens: threads.reduce((sum, t) => sum + t.tokenCount, 0),
            };
        });
    },

    setFollowUpQuestions: (threadId: string, questions: string[]) => {
        set(state => {
            const threads = state.threads.map(t => {
                if (t.id !== threadId) return t;

                const updated = {
                    ...t,
                    followUpQuestions: questions,
                    updatedAt: Date.now(),
                };
                updated.tokenCount = calculateThreadTokens(updated);
                return updated;
            });

            return {
                threads,
                totalTokens: threads.reduce((sum, t) => sum + t.tokenCount, 0),
            };
        });
    },

    // ==========================================
    // Token Management
    // ==========================================

    recalculateTokens: () => {
        set(state => ({
            totalTokens: state.threads.reduce((sum, t) => sum + calculateThreadTokens(t), 0),
        }));
    },

    getTokenUsagePercent: () => {
        const state = get();
        return state.maxTokens > 0 ? (state.totalTokens / state.maxTokens) * 100 : 0;
    },

    getTokenStatus: () => {
        const percent = get().getTokenUsagePercent();
        const { warningThreshold, dangerThreshold } = get();

        if (percent >= dangerThreshold) return 'critical';
        if (percent >= warningThreshold) return 'warning';
        return 'safe';
    },

    // ==========================================
    // Library
    // ==========================================

    saveToLibrary: (threadId: string, note: string, tags: string[] = []) => {
        const thread = get().threads.find(t => t.id === threadId);
        if (!thread) return;

        const savedThread: SavedThread = {
            ...thread,
            userNote: note,
            tags,
            savedAt: Date.now(),
        };

        set(state => {
            const library = [...state.library, savedThread];
            saveLibraryToStorage(library);
            return { library };
        });
    },

    loadFromLibrary: (savedThreadId: string) => {
        const saved = get().library.find(t => t.id === savedThreadId);
        if (!saved) return;

        // Create a new thread based on the saved one
        const now = Date.now();
        const newThread: Thread = {
            ...saved,
            followUpQuestions: saved.followUpQuestions ?? [],
            id: `thread-${now}-${Math.random().toString(36).substr(2, 9)}`,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        };

        set(state => ({
            threads: [...state.threads, newThread],
            activeThreadId: newThread.id,
            totalTokens: state.totalTokens + newThread.tokenCount,
        }));
    },

    deleteFromLibrary: (savedThreadId: string) => {
        set(state => {
            const library = state.library.filter(t => t.id !== savedThreadId);
            saveLibraryToStorage(library);
            return { library };
        });
    },

    // ==========================================
    // Import/Export
    // ==========================================

    exportThreadsSnapshot: () => {
        const state = get();
        const snapshot: ThreadSnapshot = {
            version: THREAD_SNAPSHOT_VERSION,
            exportedAt: Date.now(),
            activeThreadId: state.activeThreadId,
            threads: state.threads,
            metadata: {
                totalTokens: state.totalTokens,
                maxTokens: state.maxTokens,
                warningThreshold: state.warningThreshold,
                dangerThreshold: state.dangerThreshold,
            },
        };
        return JSON.stringify(snapshot, null, 2);
    },

    restoreThreadsSnapshot: (json: string) => {
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return { ok: false, error: 'JSON inválido. Verifique o arquivo e tente novamente.' };
        }

        if (!isRecord(parsed)) {
            return { ok: false, error: 'Snapshot inválido. Estrutura inesperada.' };
        }

        const now = Date.now();
        const threadsRaw = Array.isArray(parsed.threads) ? parsed.threads : null;
        if (!threadsRaw) {
            return { ok: false, error: 'Snapshot inválido. Lista de threads ausente.' };
        }

        const threads = threadsRaw
            .map(thread => sanitizeThread(thread, now))
            .filter((thread): thread is Thread => thread !== null);

        if (threads.length === 0 && threadsRaw.length > 0) {
            return { ok: false, error: 'Snapshot inválido. Nenhuma thread válida encontrada.' };
        }

        const activeThreadId =
            typeof parsed.activeThreadId === 'string' &&
            threads.some(thread => thread.id === parsed.activeThreadId)
                ? parsed.activeThreadId
                : null;

        const metadata = isRecord(parsed.metadata) ? parsed.metadata : {};
        const maxTokens = asNumber(metadata.maxTokens, DEFAULT_MAX_TOKENS);
        const warningThreshold = asNumber(metadata.warningThreshold, DEFAULT_WARNING_THRESHOLD);
        const dangerThreshold = asNumber(metadata.dangerThreshold, DEFAULT_DANGER_THRESHOLD);
        const totalTokens = threads.reduce((sum, thread) => sum + thread.tokenCount, 0);

        set({
            threads,
            activeThreadId,
            totalTokens,
            maxTokens,
            warningThreshold,
            dangerThreshold,
        });

        return { ok: true, importedThreads: threads.length };
    },

    // ==========================================
    // Prompt Generation
    // ==========================================

    getThreadsForPrompt: () => {
        return get().threads.filter(t => t.status === 'active' || t.status === 'paused');
    },

    markThreadCompleted: (threadId: string) => {
        set(state => ({
            threads: state.threads.map(t =>
                t.id === threadId ? { ...t, status: 'completed', updatedAt: Date.now() } : t
            ),
        }));
    },

    // ==========================================
    // Reset
    // ==========================================

    clearBasket: () => {
        set({
            threads: [],
            activeThreadId: null,
            totalTokens: 0,
        });
    },
}));

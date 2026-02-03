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

const LIBRARY_STORAGE_KEY = 'codemind:thread-library';

function loadLibraryFromStorage(): SavedThread[] {
    try {
        const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
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
// Store Interface
// ============================================

interface BasketStore extends BasketState {
    // Thread management
    createThread: (node: FlatNode, mode: AIActionMode) => Thread;
    deleteThread: (threadId: string) => void;
    setActiveThread: (threadId: string | null) => void;
    getActiveThread: () => Thread | null;

    // Conversation
    addMessage: (threadId: string, role: 'user' | 'assistant', content: string) => void;
    switchMode: (threadId: string, newMode: AIActionMode) => void;

    // Suggestions
    addSuggestion: (threadId: string, suggestion: Omit<ThreadSuggestion, 'id' | 'included'>) => void;
    toggleSuggestionIncluded: (threadId: string, suggestionId: string) => void;
    setFollowUpQuestions: (threadId: string, questions: string[]) => void;

    // Token management
    recalculateTokens: () => void;
    getTokenUsagePercent: () => number;
    getTokenStatus: () => 'ok' | 'warning' | 'danger';

    // Library
    library: SavedThread[];
    saveToLibrary: (threadId: string, note: string, tags?: string[]) => void;
    loadFromLibrary: (savedThreadId: string) => void;
    deleteFromLibrary: (savedThreadId: string) => void;

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
const DEFAULT_WARNING_THRESHOLD = 0.6; // 60%
const DEFAULT_DANGER_THRESHOLD = 0.8; // 80%

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
        const message: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role,
            content,
            mode: get().threads.find(t => t.id === threadId)?.currentMode ?? 'ask',
            timestamp: Date.now(),
            tokenEstimate: estimateTokens(content),
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
        return state.maxTokens > 0 ? state.totalTokens / state.maxTokens : 0;
    },

    getTokenStatus: () => {
        const percent = get().getTokenUsagePercent();
        const { warningThreshold, dangerThreshold } = get();

        if (percent >= dangerThreshold) return 'danger';
        if (percent >= warningThreshold) return 'warning';
        return 'ok';
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

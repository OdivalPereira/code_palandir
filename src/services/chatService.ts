/**
 * Chat Service - Serviço para comunicação com API de IA.
 * 
 * Fornece interface para o chat contextual com 6 modos de IA:
 * explore, create, alter, fix, connect, ask
 */

import {
    AIActionMode,
    ChatMessage,
    ThreadBaseElement,
    ThreadSuggestion,
} from '../types';

// ============================================
// Types
// ============================================

export interface ChatContext {
    /** Modo atual da conversa */
    mode: AIActionMode;
    /** Elemento base sobre o qual a conversa se baseia */
    element: ThreadBaseElement | null;
    /** Histórico de mensagens anteriores */
    conversationHistory: ChatMessage[];
    /** Contexto opcional do projeto */
    projectContext?: string;
}

export interface ChatResponse {
    /** Resposta da IA */
    response: string;
    /** Sugestões geradas (arquivos, APIs, snippets) */
    suggestions: ThreadSuggestion[];
    /** Perguntas de follow-up sugeridas */
    followUpQuestions: string[];
    /** Informações de uso de tokens */
    usage?: {
        promptTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
    /** Latência da requisição em ms */
    latencyMs?: number;
}

export interface SendMessageOptions {
    /** Mensagem do usuário */
    userMessage: string;
    /** Contexto da conversa */
    context: ChatContext;
    /** Callback para progresso (streaming futuro) */
    onProgress?: (partial: string) => void;
}

// ============================================
// API Functions
// ============================================

const API_BASE = '/api';

/**
 * Envia uma mensagem para o chat contextual da IA.
 */
export async function sendChatMessage(options: SendMessageOptions): Promise<ChatResponse> {
    const { userMessage, context } = options;

    const payload = {
        mode: context.mode,
        element: context.element,
        userMessage,
        conversationHistory: context.conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
            mode: msg.mode,
        })),
        projectContext: context.projectContext,
    };

    const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Normalizar sugestões
    const suggestions: ThreadSuggestion[] = (data.suggestions || []).map((sug: any, index: number) => ({
        id: `sug-${Date.now()}-${index}`,
        type: sug.type || 'snippet',
        title: sug.title || 'Sugestão',
        description: sug.description || '',
        content: sug.content,
        path: sug.path,
        included: true,
    }));

    return {
        response: data.response || '',
        suggestions,
        followUpQuestions: data.followUpQuestions || [],
        usage: data.usage,
        latencyMs: data.latencyMs,
    };
}

/**
 * Cria uma mensagem de chat formatada.
 */
export function createChatMessage(
    role: 'user' | 'assistant',
    content: string,
    mode: AIActionMode
): ChatMessage {
    return {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role,
        content,
        mode,
        timestamp: Date.now(),
        tokenEstimate: Math.ceil(content.length / 4),
    };
}

/**
 * Obtém um system prompt resumido para exibição ao usuário.
 */
export function getModeDescription(mode: AIActionMode): string {
    const descriptions: Record<AIActionMode, string> = {
        explore: 'Explorar e entender o elemento',
        create: 'Criar algo novo relacionado',
        alter: 'Modificar o elemento existente',
        fix: 'Corrigir bugs ou problemas',
        connect: 'Conectar a outros elementos',
        ask: 'Fazer uma pergunta livre',
    };
    return descriptions[mode];
}

/**
 * Obtém um placeholder para o input baseado no modo.
 */
export function getInputPlaceholder(mode: AIActionMode): string {
    const placeholders: Record<AIActionMode, string> = {
        explore: 'Como esse elemento funciona?',
        create: 'O que você quer criar?',
        alter: 'Qual modificação deseja fazer?',
        fix: 'Descreva o problema a corrigir...',
        connect: 'Com o que deseja conectar?',
        ask: 'Qual sua pergunta?',
    };
    return placeholders[mode];
}

/**
 * Verifica se a API está disponível.
 */
export async function checkApiHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE}/ai/metrics`, {
            method: 'GET',
            credentials: 'include',
        });
        return response.ok;
    } catch {
        return false;
    }
}

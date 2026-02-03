# Code Palantir v4: Plano de Implementação Completo

> **Status:** ✅ CONCLUÍDO (v1.1)  
> **Data:** 2026-02-03  
> **Escopo:** Sistema de IA Contextual para Visualização de Código

---

## Visão Geral do Projeto

O Code Palantir é uma ferramenta de visualização de código que representa projetos como grafos interativos. Esta implementação adicionou um **Sistema de IA Contextual** completo, permitindo:

- Conversar com IA focada em elementos específicos do código
- Gerenciar múltiplas threads de conversa
- Monitorar consumo de tokens
- Exportar documentação
- Refinar prompts automaticamente

---

## Arquitetura Implementada

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ContextualChat│  │ThreadLibrary│  │    PromptBuilder        │  │
│  │  (Chat UI)  │  │ (Sidebar)   │  │  (Prompt Agent UI)      │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌───────────┴─────────────┐  │
│  │TokenMonitor │  │  AppTopBar  │  │    exportUtils.ts       │  │
│  │   (Badge)   │  │  (Buttons)  │  │   (Download MD)         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         └────────────────┼─────────────────────┘                │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  basketStore.ts (Zustand)                  │  │
│  │  threads[], activeThreadId, tokenCount, library actions    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │               chatService.ts / client.ts                   │  │
│  │         sendChatMessage(), generatePromptAgent()           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ HTTP/REST
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    server/index.js                         │  │
│  │  POST /api/ai/chat         → handleAiContextualChat()      │  │
│  │  POST /api/ai/generate-prompt → handleGeneratePrompt()     │  │
│  │  GET  /api/ai/metrics      → handleAiMetrics()             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │                  server/ai-client.js                       │  │
│  │  GoogleGenAI (Vertex AI) + Schema Validation               │  │
│  │  AI_REQUEST_SCHEMA: contextualChat, generatePrompt         │  │
│  │  MODE_SYSTEM_PROMPTS: explore, create, alter, fix, etc.    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fases de Implementação

### Fase 0: Validação do Estado Atual ✅

**Objetivo:** Garantir que o grafo funciona antes de adicionar novas features.

**Resultado:**
- Verificado que seleção de nós não funcionava como esperado
- Decisão: implementar novo design independente do sistema atual
- O balão de IA (`AIContextBalloon.tsx`) foi a base para a nova interação

**Arquivos analisados:**
- `src/components/CodeVisualizer.tsx` - Renderização D3
- `src/stores/graphStore.ts` - Estado do grafo

---

### Fase 1: Tipos de Dados (Foundation) ✅

**Objetivo:** Definir estruturas TypeScript para Thread, Basket, AI Actions.

**Arquivos modificados:**
- [src/types.ts](file:///home/odivalmp/code_palandir/src/types.ts) (+160 linhas)

**Tipos criados:**

| Tipo | Descrição |
|------|-----------|
| `AIActionMode` | Union type: `'explore' \| 'create' \| 'alter' \| 'fix' \| 'connect' \| 'ask'` |
| `AI_ACTION_LABELS` | Mapa de labels em português para cada modo |
| `ChatMessage` | Mensagem individual com role, content, mode, timestamp |
| `ThreadBaseElement` | Referência ao nó base (nodeId, name, path, type, codeSnippet) |
| `ThreadSuggestion` | Sugestões da IA (file, api, snippet, migration, table, service) |
| `Thread` | Estrutura completa de uma conversa |
| `SavedThread` | Thread salva na biblioteca com metadados extras |
| `BasketState` | Estado global do basket |
| `PromptAgentInput` | Input para o Prompt Agent |
| `GeneratedPrompt` | Resultado do Prompt Agent |

**Interface Thread (detalhada):**
```typescript
export interface Thread {
  id: string;
  title: string;
  baseElement: ThreadBaseElement;
  currentMode: AIActionMode;
  modesUsed: AIActionMode[];
  conversation: ChatMessage[];
  suggestions: ThreadSuggestion[];
  tokenCount: number;
  status: 'active' | 'paused' | 'completed';
  createdAt: number;
  updatedAt: number;
}
```

---

### Fase 2: Basket Store ✅

**Objetivo:** Store Zustand para gerenciar threads e tokens.

**Arquivos criados:**
- [src/stores/basketStore.ts](file:///home/odivalmp/code_palandir/src/stores/basketStore.ts) (~350 linhas)

**Actions implementadas:**

| Action | Descrição |
|--------|-----------|
| `createThread()` | Cria nova thread a partir de um nó selecionado |
| `addMessage()` | Adiciona mensagem à conversa ativa |
| `switchMode()` | Muda modo sem resetar conversa |
| `addSuggestion()` | Adiciona sugestão gerada pela IA |
| `deleteThread()` | Remove thread do basket |
| `getTokenUsagePercent()` | Retorna % de uso de tokens |
| `getTokenStatus()` | Retorna 'safe' \| 'warning' \| 'critical' |
| `saveToLibrary()` | Persiste thread no localStorage |
| `loadFromLibrary()` | Restaura thread da biblioteca |
| `exportThreadsSnapshot()` | Exporta para JSON |
| `restoreFromSnapshot()` | Importa de JSON |

**Configurações:**
- `TOKEN_LIMIT`: 128.000 tokens
- `TOKEN_WARNING_THRESHOLD`: 80%
- `TOKEN_CRITICAL_THRESHOLD`: 95%

**Persistência:** localStorage com chave `codemind-thread-library`

---

### Fase 3: Chat Service ✅

**Objetivo:** Serviço para comunicar com Vertex AI.

**Arquivos criados:**
- [src/services/chatService.ts](file:///home/odivalmp/code_palandir/src/services/chatService.ts) (~180 linhas)

**Funções exportadas:**

| Função | Descrição |
|--------|-----------|
| `sendChatMessage()` | Envia mensagem e retorna resposta estruturada |
| `createChatMessage()` | Factory para criar mensagem formatada |
| `getModeDescription()` | Retorna descrição do modo |
| `getInputPlaceholder()` | Retorna placeholder por modo |
| `checkApiHealth()` | Verifica se API está disponível |

**Backend (server/index.js):**

```javascript
// Endpoint: POST /api/ai/chat
const handleAiContextualChat = async (req, res, session) => {
  // Valida modo e mensagem
  // Chama generateJsonResponse com MODE_SYSTEM_PROMPTS
  // Retorna: { response, suggestions, followUpQuestions, usage }
};
```

**Sistema de Prompts por Modo (server/ai-client.js):**

| Modo | Objetivo do System Prompt |
|------|---------------------------|
| `explore` | Explicar código, dependências, padrões |
| `create` | Sugerir implementações, propor estrutura |
| `alter` | Entender mudança, identificar efeitos colaterais |
| `fix` | Identificar causa raiz, sugerir correção |
| `connect` | Entender integração, propor APIs |
| `ask` | Responder perguntas livres |

---

### Fase 4: Chat Panel UI ✅

**Objetivo:** Painel de chat contextual integrado ao grafo.

**Arquivos criados:**
- [src/components/ContextualChat.tsx](file:///home/odivalmp/code_palandir/src/components/ContextualChat.tsx)

**Componentes do Chat:**

| Elemento | Descrição |
|----------|-----------|
| Header | Info do nó, modo atual, TokenMonitor |
| Mode Selector | Badges para trocar de modo inline |
| Message List | Histórico com ícones por role |
| Input | Textarea com Enter para enviar |
| Add to Basket | Botão para incluir thread no basket |

**Props:**
```typescript
interface ContextualChatProps {
  node: FlatNode;
  initialMode: AIActionMode;
  onClose: () => void;
  onAddToBasket?: (thread: Thread) => void;
}
```

---

### Fase 5: Integrar Balloon + Chat ✅

**Objetivo:** Conectar balão de IA ao Chat Panel.

**Arquivos modificados:**
- [src/components/AIContextBalloon.tsx](file:///home/odivalmp/code_palandir/src/components/AIContextBalloon.tsx)
- [src/components/CodeVisualizer.tsx](file:///home/odivalmp/code_palandir/src/components/CodeVisualizer.tsx)

**Fluxo implementado:**
1. Usuário clica em nó do grafo
2. Balão aparece com 6 ações (Explore, Create, etc.)
3. Ao clicar numa ação, abre ContextualChat no modo selecionado
4. Chat gerencia conversa e exibe sugestões

---

### Fase 6: Token Monitor UI ✅

**Objetivo:** Indicador visual de uso de tokens.

**Arquivos criados:**
- [src/components/TokenMonitor.tsx](file:///home/odivalmp/code_palandir/src/components/TokenMonitor.tsx)

**Visualização:**

| Status | Cor | Threshold |
|--------|-----|-----------|
| safe | Verde | < 80% |
| warning | Amarelo | 80-95% |
| critical | Vermelho | > 95% |

**Features:**
- Barra de progresso animada
- Tooltip com detalhes (tokens usados/limite)
- Botão "Otimizar" quando crítico

---

### Fase 7: Thread Library ✅

**Objetivo:** Persistir e gerenciar threads salvos.

**Arquivos criados:**
- [src/components/ThreadLibrary.tsx](file:///home/odivalmp/code_palandir/src/components/ThreadLibrary.tsx)

**Arquivos modificados:**
- [src/stores/graphStore.ts](file:///home/odivalmp/code_palandir/src/stores/graphStore.ts) - Adicionado `'library'` ao `SidebarTab`
- [src/components/AppTopBar.tsx](file:///home/odivalmp/code_palandir/src/components/AppTopBar.tsx) - Botão para abrir biblioteca
- [src/components/PromptSidebarPanel.tsx](file:///home/odivalmp/code_palandir/src/components/PromptSidebarPanel.tsx) - Renderização condicional

**Features:**
- Lista de threads salvos com metadados
- Busca por título, tags, notas
- Carregar thread para continuar conversa
- Deletar threads antigos

---

### Fase 8: Export Markdown ✅

**Objetivo:** Exportar threads como documentação.

**Arquivos criados:**
- [src/utils/exportUtils.ts](file:///home/odivalmp/code_palandir/src/utils/exportUtils.ts)

**Arquivos modificados:**
- [src/components/AppTopBar.tsx](file:///home/odivalmp/code_palandir/src/components/AppTopBar.tsx) - Botão "Export MD"

**Funções:**

| Função | Descrição |
|--------|-----------|
| `generateMarkdownExport()` | Gera conteúdo MD das threads ativas |
| `downloadMarkdown()` | Trigger download via Blob |

**Template de Export:**
```markdown
# CodeMind AI Session Export
**Date:** [timestamp]
**Active Threads:** [count]

---

## 1. [Thread Title]
- **Element:** `path/to/file.ts` (type)
- **Mode:** explore
- **Tokens:** 1234
- **Created:** [date]

### Conversation
#### 👤 User
[message]

#### 🤖 CodeMind AI
[response]

### Suggestions Applied
- [file] **Title**: Description
```

---

### Fase 9: Prompt Agent (Vertex AI) ✅

**Objetivo:** Gerar prompts otimizados via IA.

**Arquivos modificados:**

**Backend:**
- [server/ai-client.js](file:///home/odivalmp/code_palandir/server/ai-client.js)
  - Schema `generatePrompt` adicionado ao `AI_REQUEST_SCHEMA`
  - Prompt Engineer system prompt em `buildPromptParts`
- [server/index.js](file:///home/odivalmp/code_palandir/server/index.js)
  - Handler `handleGeneratePrompt()`
  - Rota `POST /api/ai/generate-prompt`

**Frontend:**
- [src/types.ts](file:///home/odivalmp/code_palandir/src/types.ts)
  - Interface `PromptAgentInput`
- [src/api/client.ts](file:///home/odivalmp/code_palandir/src/api/client.ts)
  - Função `generatePromptAgent()`
- [src/components/PromptBuilder.tsx](file:///home/odivalmp/code_palandir/src/components/PromptBuilder.tsx)
  - Botão "✨ Refinar com IA (Agent)"
  - Handler `handleRefineWithAI()`

**System Prompt do Prompt Agent:**
```
Você é um Engenheiro de Prompt Sênior (Prompt Engineer).
Sua missão é refinar e estruturar solicitações de usuários sobre
tarefas de programação, transformando-as em prompts de ALTA QUALIDADE
para LLMs.

Gere um prompt otimizado seguindo as melhores práticas:
- Clear instructions
- Role prompting
- Chain of thought
- Few-shot prompting (se necessário)

Resposta JSON:
{
  "content": "prompt completo otimizado",
  "techniquesApplied": ["lista de técnicas usadas"],
  "sections": {
    "context": "...",
    "tasks": "...",
    "instructions": "...",
    "validation": "..."
  }
}
```

---

## Resumo de Arquivos

### Arquivos Criados

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `src/stores/basketStore.ts` | ~350 | Store Zustand para threads |
| `src/services/chatService.ts` | ~180 | Cliente para API de chat |
| `src/components/ContextualChat.tsx` | ~250 | UI do chat contextual |
| `src/components/TokenMonitor.tsx` | ~80 | Badge de tokens |
| `src/components/ThreadLibrary.tsx` | ~200 | UI da biblioteca |
| `src/utils/exportUtils.ts` | ~90 | Utilitários de export |

### Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/types.ts` | +160 linhas (novos tipos) |
| `src/api/client.ts` | +15 linhas (generatePromptAgent) |
| `src/stores/graphStore.ts` | SidebarTab com 'library' |
| `src/components/AppTopBar.tsx` | Botões Library e Export |
| `src/components/PromptSidebarPanel.tsx` | Renderização ThreadLibrary |
| `src/components/PromptBuilder.tsx` | Botão Refinar com IA |
| `server/index.js` | Handlers e rotas de IA |
| `server/ai-client.js` | Schemas e prompts |

---

## Decisões de Design

### 1. Arquitetura de Estado
**Decisão:** Usar Zustand separado (`basketStore`) em vez de estender `graphStore`.  
**Razão:** Separação de responsabilidades - grafo vs. conversas.

### 2. Modos Híbridos
**Decisão:** Permitir trocar de modo sem perder histórico.  
**Razão:** Conversas reais fluem entre explorar, criar e fixar.

### 3. Persistência Local
**Decisão:** localStorage para biblioteca de threads.  
**Razão:** Simplicidade, sem necessidade de backend para persistência.

### 4. Prompt por Modo
**Decisão:** System prompts específicos por `AIActionMode`.  
**Razão:** Respostas mais focadas e úteis.

### 5. Export Markdown
**Decisão:** Formato estruturado com emojis e seções claras.  
**Razão:** Legibilidade e compatibilidade com GitHub/PRs.

---

## Validação

### Build Status
```bash
npm run build
# ✅ Passed (Exit code: 0)
# dist/index-DMocVmIM.js: 343.90 kB (gzip: 105.30 kB)
```

### Critérios de Sucesso por Fase

| Fase | Critério | Status |
|------|----------|--------|
| 0 | Diagnóstico do estado atual | ✅ |
| 1 | Tipos compilam sem erro | ✅ |
| 2 | Store funciona, persistence OK | ✅ |
| 3 | API retorna resposta válida | ✅ |
| 4 | Chat renderiza mensagens | ✅ |
| 5 | Balão abre Chat no modo correto | ✅ |
| 6 | Monitor mostra % correto | ✅ |
| 7 | Thread persiste após reload | ✅ |
| 8 | Markdown exportado | ✅ |
| 9 | Prompt Agent funciona | ✅ |

---

## Próximos Passos (Opcional)

### Melhorias Sugeridas
1. **Streaming:** Implementar SSE para respostas em tempo real
2. **Sync Cloud:** Sincronizar biblioteca com backend
3. **Templates:** Prompt templates pré-definidos por tipo de tarefa
4. **Analytics:** Dashboard de uso de tokens por projeto
5. **Multi-file Context:** Incluir múltiplos arquivos no contexto

### Bugs Conhecidos
- Seleção de nós no grafo D3 pode não funcionar em todos os cenários (issue pré-existente)

---

## Referências

- [Manual de Uso](file:///home/odivalmp/.gemini/antigravity/brain/8252389a-2ab8-4ea4-8c4a-8514ce89497f/ai_features_manual.md)
- [Checklist de Tarefas](file:///home/odivalmp/.gemini/antigravity/brain/8252389a-2ab8-4ea4-8c4a-8514ce89497f/task.md)

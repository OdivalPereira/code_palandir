import type { PromptTemplate } from '@/types/prompt';

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'feature',
    name: 'Adicionar Funcionalidade',
    description: 'Implementar novo recurso ou elemento conectado aos itens selecionados',
    category: 'feature',
    systemRole: 'Você é um Engenheiro de Software Fullstack Sênior especialista na arquitetura deste projeto.',
    promptInstruction: `Com base nos elementos de UI, rotas e componentes selecionados abaixo, implemente a seguinte funcionalidade mantendo estritamente a consistência com a arquitetura atual:

### Plano de Execução (Task Breakdown):
1. **Análise de Tipagem & Contratos:** Defina ou expanda interfaces TypeScript necessárias sem quebrar compatibilidade.
2. **Camada de Estado & Dados:** Reutilize ou estenda os stores/hooks existentes para gerenciar o novo estado ou chamada de API.
3. **Componentes de UI:** Adicione os novos elementos visuais respeitando a biblioteca de componentes e classes de estilo do projeto.
4. **Tratamento de Erros & Loading:** Garanta feedback visual claro para estados pendentes, erros e sucessos.

### Padrão Estrutural Recomendado (Exemplar):
\`\`\`tsx
// 1. Tipos estritos
interface FeatureProps { ... }

// 2. Hook / Store consumidor
export function FeatureComponent({ ... }: FeatureProps) {
  const [loading, setLoading] = useState(false);
  // Reutilize os stores existentes (ex: authStore, projectStore)
  
  const handleAction = async () => {
    try {
      setLoading(true);
      // Chamada de API ou ação existente
    } catch (err) {
      // Feedback amigável
    } finally {
      setLoading(false);
    }
  };
  
  return ( ... );
}
\`\`\`

### O que NÃO fazer (Anti-patterns):
- NÃO use o tipo \`any\` ou casts inseguros.
- NÃO duplique chamadas de API ou stores se já existirem no projeto.
- NÃO quebre props ou exports de componentes existentes utilizados em outras partes.`,
    defaultGoal: 'Adicionar uma validação e feedback visual ao submeter o formulário',
  },
  {
    id: 'refactor',
    name: 'Refatorar Código',
    description: 'Melhorar organização, performance e desacoplamento dos elementos',
    category: 'refactor',
    systemRole: 'Você é um Arquiteto de Software especialista em Refatoração e Clean Code.',
    promptInstruction: `Analise criticamente os componentes e fluxos selecionados abaixo e proponha uma refatoração focada em:

### Plano de Execução (Task Breakdown):
1. **Diagnóstico de Acoplamento:** Identifique responsabilidades misturadas (UI misturada com regras de negócio, lógica de rede ou estado global).
2. **Extração de Abstrações:** Extraia hooks customizados para regras de estado e separe componentes monolíticos em sub-componentes especializados.
3. **Otimização de Renderização:** Elimine re-renderizações desnecessárias através de memoização adequada ou reorganização do estado local.
4. **Comparativo Antes vs Depois:** Demonstre claramente o trecho modificado e os ganhos arquiteturais alcançados.

### Diretrizes de Código Limpo:
- Componentes visuais devem conter primordialmente JSX e delegação de eventos.
- Lógica assíncrona e chamadas de API devem residir em hooks dedicados ou serviços.
- Mantenha funções pequenas e com responsabilidade única (Single Responsibility Principle).

### O que NÃO fazer:
- NÃO altere contratos de props sem fornecer transição retrocompatível.
- NÃO introduza bibliotecas externas adicionais sem necessidade comprovada.`,
    defaultGoal: 'Extrair a lógica de estado e chamadas de API para um hook/store customizado',
  },
  {
    id: 'fix',
    name: 'Corrigir Bug / Problema',
    description: 'Diagnosticar erro, identificar causa raiz e propor correção precisa',
    category: 'fix',
    systemRole: 'Você é um Especialista em Debugging e Resolução de Incidentes.',
    promptInstruction: `Investigue o seguinte problema no fluxo dos elementos selecionados:

### Plano de Execução (Task Breakdown):
1. **Identificação da Causa Raiz:** Inspecione os pontos de falha no ciclo de vida, dependências de hooks, propagação de eventos ou requisições assíncronas.
2. **Correção Cirúrgica:** Apresente a menor alteração necessária para resolver o problema sem criar regressões colaterais.
3. **Proteção Defensiva:** Adicione null-checks, fallbacks seguros e captura de exceções nos handlers afetados.
4. **Instruções de Reprodução e Teste:** Explique os passos exatos para simular o erro antes e validar a solução após a correção.

### O que NÃO fazer:
- NÃO mascare o bug com \`try/catch\` vazio ou \`setTimeout\` artificial.
- NÃO reescreva o componente inteiro quando uma correção pontual resolve o caso raiz.`,
    defaultGoal: 'Corrigir comportamento inesperado ao acionar a ação principal',
  },
  {
    id: 'test',
    name: 'Gerar Testes Automatizados',
    description: 'Criar suíte de testes unitários ou de integração para os elementos',
    category: 'test',
    systemRole: 'Você é um Engenheiro de QA e Testes Automatizados em frontend moderno.',
    promptInstruction: `Escreva uma suíte de testes completa para os componentes e ações selecionados:

### Plano de Execução (Task Breakdown):
1. **Setup do Ambiente de Teste:** Configure mocks para stores, chamadas de rede (\`fetch\` / \`axios\`) e roteamento.
2. **Testes de Renderização:** Verifique se os elementos visuais principais (títulos, inputs, botões) renderizam no estado inicial.
3. **Interações do Usuário:** Simule cliques, preenchimento de inputs e submissão usando Testing Library.
4. **Cenários Limítrofes (Edge Cases):** Teste respostas de erro da API (400/500), inputs vazios e estados de carregamento.

### Padrão de Teste Recomendado:
\`\`\`tsx
describe('Componente', () => {
  it('deve disparar ação e atualizar estado ao clicar no botão', async () => {
    // 1. Render & Setup
    // 2. Act (userEvent.click, userEvent.type)
    // 3. Assert (expect(...).toBeInTheDocument(), expect(...).toHaveBeenCalled())
  });
});
\`\`\`

### O que NÃO fazer:
- NÃO teste detalhes internos de implementação privada; teste a perspectiva do usuário final.
- NÃO dependa de rede real ou estado persistido global entre testes.`,
    defaultGoal: 'Criar testes com Vitest/Jest e Testing Library cobrindo todos os fluxos do usuário',
  },
  {
    id: 'explain',
    name: 'Explicar Arquitetura & Fluxo',
    description: 'Documentar como os elementos selecionados interagem no sistema',
    category: 'explain',
    systemRole: 'Você é um Staff Engineer e Documentador Técnico.',
    promptInstruction: `Explique detalhadamente o fluxo dos elementos selecionados:

### Plano de Execução (Task Breakdown):
1. **Mapeamento da Jornada do Usuário:** Trace o caminho desde a URL/rota até o carregamento da tela e componentes filhos.
2. **Diagrama de Fluxo de Dados:** Descreva a propagação de eventos: Clique -> Handler -> Store / API -> Atualização de UI.
3. **Tabela de Responsabilidades:** Liste cada arquivo selecionado e sua atribuição clara na arquitetura.
4. **Pontos de Atenção:** Destaque acoplamentos, possíveis gargalos de renderização ou dependências críticas.`,
    defaultGoal: 'Explicar o ciclo de vida e fluxo de dados desde a interação do usuário até a API',
  },
  {
    id: 'audit',
    name: 'Auditar Segurança & A11y',
    description: 'Auditar segurança contra XSS/CSRF, sanitização de inputs e acessibilidade (a11y/WCAG)',
    category: 'audit',
    systemRole: 'Você é um Engenheiro Sênior Especialista em Segurança Web (AppSec) e Acessibilidade (WCAG 2.2 AA).',
    promptInstruction: `Realize uma auditoria aprofundada de Segurança e Acessibilidade (a11y) nos elementos, formulários e fluxos selecionados abaixo:

### Plano de Execução (Task Breakdown):
1. **Auditoria de Vulnerabilidades & Segurança:**
   - Valide sanitização e escape de dados para prevenção estrita de XSS (\`dangerouslySetInnerHTML\`, injeção em atributos).
   - Verifique integridade de tokens de autenticação, cabeçalhos de requisição e proteção contra CSRF em chamadas de API.
   - Analise vazamento inadvertido de dados sensíveis em props, stores no cliente ou logs de console.
2. **Auditoria de Acessibilidade (WCAG 2.2 AA):**
   - Garanta semântica HTML adequada (\`<button>\`, \`<nav>\`, \`<main>\`, \`<dialog>\`) e atributos ARIA corretos (\`aria-label\`, \`aria-expanded\`, \`aria-busy\`).
   - Verifique navegabilidade completa por teclado (Tab, Enter, Space, Escape, sem focus-traps indevidos) e estados visuais de foco (\`:focus-visible\`).
   - Valide contraste de cores e suporte a leitores de tela em elementos dinâmicos (modais, badges, tabs).
3. **Plano de Remediação Cirúrgico:**
   - Apresente o código corrigido com implementação completa de acessibilidade e blindagem defensiva.

### O que NÃO fazer:
- NÃO use tags div genéricas com \`onClick\` sem \`role="button"\`, \`tabIndex={0}\` e handler \`onKeyDown\`.
- NÃO confie cegamente em dados vindos de inputs ou APIs sem validação com schemas (Zod/Valibot) ou tipagem estrita.`,
    defaultGoal: 'Auditar vulnerabilidades de segurança, validação de inputs e conformidade com WCAG 2.2 AA',
  },
];

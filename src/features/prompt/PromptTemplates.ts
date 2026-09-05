import type { PromptTemplate } from '@/types/prompt';

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'feature',
    name: 'Adicionar Funcionalidade',
    description: 'Implementar novo recurso ou elemento conectado aos itens selecionados',
    category: 'feature',
    systemRole: 'Você é um Engenheiro de Software Fullstack Sênior especialista na arquitetura deste projeto.',
    promptInstruction: `Com base nos elementos de UI, rotas e componentes selecionados abaixo, implemente a seguinte funcionalidade mantendo estritamente a consistência com a arquitetura atual:
- Reutilize os stores, hooks e componentes existentes quando apropriado
- Escreva código TypeScript limpo, tipado e completo sem abreviações
- Indique exatamente quais arquivos devem ser criados ou editados`,
    defaultGoal: 'Adicionar uma validação e feedback visual ao submeter o formulário',
  },
  {
    id: 'refactor',
    name: 'Refatorar Código',
    description: 'Melhorar organização, performance e desacoplamento dos elementos',
    category: 'refactor',
    systemRole: 'Você é um Arquiteto de Software especialista em Refatoração e Clean Code.',
    promptInstruction: `Analise criticamente os componentes e fluxos selecionados abaixo e proponha uma refatoração focada em:
- Redução de duplicidade e desacoplamento de responsabilidades
- Melhoria na legibilidade e performance de renderização
- Tipagem estrita com TypeScript
- Mostre o código antes e depois com explicação clara das melhorias`,
    defaultGoal: 'Extrair a lógica de estado e chamadas de API para um hook/store customizado',
  },
  {
    id: 'fix',
    name: 'Corrigir Bug / Problema',
    description: 'Diagnosticar erro, identificar causa raiz e propor correção precisa',
    category: 'fix',
    systemRole: 'Você é um Especialista em Debugging e Resolução de Incidentes.',
    promptInstruction: `Investigue o seguinte problema no fluxo dos elementos selecionados:
- Identifique a provável causa raiz nas interações entre componentes, estado ou chamadas de rede
- Apresente a correção cirúrgica sem efeitos colaterais
- Adicione validações defensivas e tratamento de erros adequado`,
    defaultGoal: 'Corrigir comportamento inesperado ao acionar a ação principal',
  },
  {
    id: 'test',
    name: 'Gerar Testes Automatizados',
    description: 'Criar suíte de testes unitários ou de integração para os elementos',
    category: 'test',
    systemRole: 'Você é um Engenheiro de QA e Testes Automatizados em frontend moderno.',
    promptInstruction: `Escreva uma suíte de testes completa para os componentes e ações selecionados:
- Testes de renderização e estado inicial
- Simulação de eventos do usuário (cliques, inputs, submits)
- Mock adequado de chamadas de API e stores
- Cobertura de cenários de sucesso e caminhos de erro`,
    defaultGoal: 'Criar testes com Vitest/Jest e Testing Library cobrindo todos os fluxos do usuário',
  },
  {
    id: 'explain',
    name: 'Explicar Arquitetura & Fluxo',
    description: 'Documentar como os elementos selecionados interagem no sistema',
    category: 'explain',
    systemRole: 'Você é um Staff Engineer e Documentador Técnico.',
    promptInstruction: `Explique detalhadamente o fluxo dos elementos selecionados:
- Como a rota se conecta com a página e seus componentes filhos
- Quais dados fluem entre ações, hooks, stores e APIs
- Diagrama mental ou em markdown resumindo a jornada do usuário`,
    defaultGoal: 'Explicar o ciclo de vida e fluxo de dados desde a interação do usuário até a API',
  },
];

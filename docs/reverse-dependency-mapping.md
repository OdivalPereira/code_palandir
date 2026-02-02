# Reverse Dependency Mapping - Guia de Uso

## Visão Geral

O "Arquiteto Reverso" é uma funcionalidade que permite analisar componentes React para inferir automaticamente a infraestrutura backend necessária.

## Workflows Disponíveis

### 1. Análise por Intenção (IntentPanel)

**Quando usar:** Você tem um componente TSX e quer saber qual backend precisa criar.

**Passos:**
1. Carregue seu projeto (Local Dir ou GitHub)
2. Clique em um arquivo `.tsx` ou `.jsx` no grafo
3. No painel "Arquiteto Reverso" (direita):
   - O arquivo selecionado aparece automaticamente
   - Digite sua intenção (ex: "Cadastrar usuário com email de confirmação")
   - Escolha o stack (Supabase ou Firebase)
4. Clique em "Analisar Intenção"
5. Aguarde a análise da IA (5-10 segundos)
6. Veja os resultados:
   - **Ghost nodes** no grafo (nós tracejados coloridos)
   - **Requisitos de Backend** detalhados
   - **Prompt Gerado** para Cursor/Windsurf

**Ações disponíveis após análise:**
- 📋 **Copiar Prompt**: Copia o prompt para a área de transferência
- 🗑️ **Limpar Análise**: Remove os ghost nodes e reinicia

---

### 2. Templates Prontos (TemplateSidebar)

**Quando usar:** Você quer adicionar um padrão comum de backend sem analisar código.

**Templates Disponíveis:**

| Categoria | Templates |
|-----------|-----------|
| 🔐 Autenticação | Auth Email/Senha, Auth Social (OAuth) |
| 💾 Dados | CRUD Básico, Upload de Arquivos |
| 🔌 Integrações | Email Service, Payment Gateway |
| ⚙️ Padrões | Jobs Agendados |

**Passos:**
1. Expanda uma categoria no sidebar esquerdo
2. Clique em um template para ver seus componentes
3. Clique em "Adicionar ao Projeto" ou arraste para o grafo
4. No wizard:
   - Selecione/desselecione componentes
   - Renomeie conforme necessário
   - Escolha o stack (Supabase/Firebase/Express)
5. Clique em "Aplicar Template"
6. Ghost nodes aparecem no grafo!

---

## Interpretando os Ghost Nodes

| Cor | Tipo | Significado |
|-----|------|-------------|
| 🔵 Azul tracejado | Tabela | Tabela de banco de dados necessária |
| 🟢 Verde tracejado | Endpoint | API endpoint a ser criado |
| 🟣 Roxo tracejado | Serviço | Serviço/integração necessária |

**Legenda dinâmica:** A legenda no grafo é atualizada automaticamente quando existem ghost nodes.

---

## Usando o Prompt Gerado

O prompt gerado é otimizado para assistentes de código como Cursor ou Windsurf.

**Estrutura do prompt:**
1. 📋 **Contexto** - Código do componente analisado
2. 🎯 **Intenção** - O que o usuário quer alcançar
3. 📊 **Análise** - Dependências faltantes identificadas
4. 📝 **Instruções** - Passos detalhados para criar a infraestrutura
5. 💡 **Stack-specific** - Código exemplo para o stack escolhido

**Como usar:**
1. Clique em "Copiar Prompt"
2. Abra o Cursor ou Windsurf
3. Cole o prompt no chat da IA
4. A IA criará os arquivos de backend para você!

---

## Stacks Suportados

### Supabase
- Migrations SQL para tabelas
- Edge Functions para endpoints
- Row Level Security configurado

### Firebase
- Firestore Rules
- Cloud Functions
- Authentication hooks

### Express + Prisma
- Schema Prisma
- Controllers/Routes
- Middleware patterns

---

## Dicas de Uso

1. **Seja específico na intenção**: Quanto mais detalhada a descrição, melhor a análise.
2. **Combine workflows**: Use análise por intenção + templates para cobertura completa.
3. **Revise antes de aplicar**: O prompt é uma sugestão, revise conforme seu contexto.
4. **Itere**: Execute análises múltiplas para refinar os requisitos.

---

## Exemplos de Intenções

| Componente | Intenção | Backend Inferido |
|------------|----------|------------------|
| LoginForm.tsx | "Autenticar usuário com email e senha" | users table, /auth/login, AuthService |
| ProductCard.tsx | "Adicionar produto ao carrinho" | products, carts, cart_items tables, /cart endpoints |
| ContactForm.tsx | "Enviar formulário e notificar por email" | contacts table, /contact endpoint, EmailService |
| CheckoutPage.tsx | "Processar pagamento com Stripe" | orders, payments tables, PaymentService |

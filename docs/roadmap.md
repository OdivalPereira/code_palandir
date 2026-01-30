# CodePalandir Roadmap (Plano Estratégico)

## Objetivo
Transformar o protótipo atual em uma plataforma robusta de exploração de bases de código com IA, mantendo a experiência fluida em repositórios grandes e adicionando recursos avançados de análise e colaboração.

---

## Fases do Roadmap

### Curto Prazo (0–3 meses) — Estabilidade, Performance e UX fluida

**Epic 1: Performance do Grafo e Escalabilidade**
- Level of Detail (LOD): exibir apenas diretórios em zoom out e revelar arquivos em zoom in.
- Clusterização por diretório/pacote para reduzir densidade visual.
- Simulação parcial e congelamento quando estável para evitar travamentos.
- Lazy expand de nós (gerar filhos apenas sob demanda).

**Sugestões técnicas**
- Mover o layout D3 para Web Worker (cálculo assíncrono).
- Canvas/WebGL para grafos grandes.
- Throttle de ticks (requestAnimationFrame) e cache de layout por hash.

**Epic 2: Estado Global e Arquitetura**
- Migrar estados locais para store global (Zustand/Jotai/Redux Toolkit).
- Normalizar entidades (nodesById, linksById) e usar selectors.

**Epic 3: Caching Inicial (Gemini + GitHub)**
- Cache local em IndexedDB para:
  - análise de arquivos (analyzeFileContent).
  - resultados de busca (findRelevantFiles).
  - conteúdo de arquivos por hash.
- Deduplicação por hash de conteúdo + query.
- ETag + If-None-Match para API do GitHub.

---

### Médio Prazo (3–9 meses) — Produção, Persistência e IA aplicada

**Epic 4: Backend e Segurança**
- Backend (Node/Firebase/Supabase) para:
  - OAuth GitHub.
  - Proxy e cache de requests.
  - proteção de chaves (Gemini/Vertex).
  - indexação assíncrona de repositórios.

**Epic 5: Persistência de Sessões**
- Salvar sessões (grafo, seleções, prompts e análises).
- Reabrir projetos com layout e contexto restaurados.

**Epic 6: IA Avançada**
- Agent de arquitetura (resumo + diagrama lógico).
- Agent de refatoração (sugestões por módulo).
- Integração com Vertex AI Prompt Agent.

---

### Longo Prazo (9–18 meses) — Diferenciação e Colaboração

**Epic 7: Grafos Semânticos**
- Exibir dependências reais (imports, chamadas, APIs).
- Navegação por fluxo (ex: “auth flow”).

**Epic 8: Evolução Colaborativa**
- Sessões em tempo real.
- Observabilidade de IA (custo, latência, taxa de cache hit).

---

## Lista Prioritizada de Epics/Features

1. Performance do grafo (LOD, clustering, Web Worker, Canvas/WebGL).
2. Estado global normalizado (store + selectors).
3. Caching de IA e GitHub (IndexedDB + ETag).
4. Backend com OAuth e indexação assíncrona.
5. Persistência de sessões.
6. IA avançada (agentes e prompt agent).
7. Grafos semânticos e navegação por fluxo.
8. Colaboração e observabilidade.

---

## Soluções Técnicas para Performance

| Problema | Solução |
| --- | --- |
| D3 trava com muitos nós | Canvas/WebGL + LOD + clustering |
| Layout pesado | Web Worker + cache de posições |
| Repetição de chamadas IA | Cache por hash + TTL |
| GitHub rate limit | Backend com OAuth + cache + ETag |
| Re-render excessivo | Store global normalizada + selectors |

---

## Killer Feature (Diferenciação)

**Impact Navigator + Prompt Autogenerativo**

Fluxo guiado onde o usuário define uma mudança (ex: “migrar auth para OAuth”), e o sistema:
1. Detecta módulos impactados usando dependências reais.
2. Gera automaticamente um prompt completo com contexto relevante.
3. Sugere plano de refatoração por etapas com riscos e checkpoints.

---

## Próximos Passos

- Definir stack de backend (Firebase/Supabase) e arquitetura alvo.
- Criar backlog de user stories com critérios de aceitação.
- Iniciar POC de LOD + Canvas/WebGL em um branch de performance.

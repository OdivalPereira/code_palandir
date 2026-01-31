# Opções: Firebase vs Supabase

## Objetivo
Comparar Firebase e Supabase para autenticação e backend, considerando requisitos de OAuth, proxy, cache e indexação, e definir uma recomendação inicial com trade-offs.

## Requisitos principais
- **OAuth**: suporte a provedores (Google, Apple, GitHub etc.), flows modernos (PKCE), e compatibilidade com login web e mobile.
- **Proxy**: possibilidade de colocar um proxy/edge entre cliente e backend para segurança, rate limiting e observabilidade.
- **Cache**: camada de cache para reduzir latência e custos (ex.: edge cache, Redis, CDN, cache de queries).
- **Indexação**: capacidade de indexar dados para busca (full-text) e relatórios analíticos, com custo controlado.

## Opção 1: Firebase
### Pontos fortes
- **Ecossistema integrado**: Auth, Firestore, Functions, Hosting e Analytics bem acoplados.
- **OAuth simplificado**: integração rápida com múltiplos provedores via Firebase Auth.
- **Escalabilidade**: Firestore é serverless e escala automaticamente.
- **SDKs maduros**: bom suporte para web/mobile.

### Considerações para requisitos
- **OAuth**: excelente suporte nativo, com UI pronta e boas práticas.
- **Proxy**: possível via Cloud Functions/Cloud Run + API Gateway, mas adiciona complexidade.
- **Cache**: cache no edge com Firebase Hosting + CDN; cache de leitura no cliente via SDK; cache customizado exige arquitetura adicional.
- **Indexação**: Firestore tem índices fortes para consultas estruturadas, mas **full-text search** costuma exigir integração externa (Algolia, Elasticsearch, Typesense).

### Trade-offs
- **Lock-in**: maior dependência do ecossistema Google.
- **Consultas**: limitações em queries complexas; modelagem pode ficar mais rígida.
- **Custo**: pode crescer rápido em cargas com muitas leituras/gravações.

## Opção 2: Supabase
### Pontos fortes
- **Baseado em Postgres**: SQL padrão, extensões e maturidade para relatórios.
- **Auth integrado**: bom suporte a OAuth e email/password.
- **Flexibilidade**: fácil de integrar com serviços externos (cache, search, proxies) via stack open-source.
- **Observabilidade**: pipeline mais tradicional para logs/metrics.

### Considerações para requisitos
- **OAuth**: bom suporte nativo; configuração é clara e extensível.
- **Proxy**: fácil colocar um API gateway/edge (Cloudflare, Fastly) ou backend próprio.
- **Cache**: integração natural com Redis/Upstash; possibilidade de cache de query no próprio app.
- **Indexação**: Postgres oferece índices avançados (GIN, full-text) e extensões para search; integrações com ferramentas especializadas são simples.

### Trade-offs
- **Operação**: pode exigir mais decisões de arquitetura e tuning em comparação ao Firebase.
- **Escalabilidade**: escala bem, mas exige mais planejamento (sharding/replicas) em cenários extremos.
- **SDKs**: boa cobertura, porém menos “plug-and-play” que Firebase.

## Recomendação inicial
**Recomendação: iniciar com Supabase** se o produto exigir **queries complexas, indexação avançada e flexibilidade de arquitetura** (proxy/cache customizados). A base em Postgres oferece controle e extensibilidade que tendem a reduzir retrabalho conforme o produto cresce.

**Quando escolher Firebase**: se a prioridade for **time-to-market** com o mínimo de operação e o uso principal for autenticação + dados simples em tempo real, Firebase entrega velocidade e integrações nativas muito sólidas.

## Resumo dos trade-offs
- **Velocidade de entrega**: Firebase > Supabase
- **Flexibilidade/controle**: Supabase > Firebase
- **Indexação e analytics**: Supabase > Firebase
- **Ecossistema gerenciado**: Firebase > Supabase
- **Lock-in**: Supabase tende a ser menor

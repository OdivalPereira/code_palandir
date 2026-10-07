import type {
  ProjectAnalysis,
  ComponentCouplingMetrics,
  ArchitecturalHealthReport,
} from '@/types/analysis';

/**
 * Motor de Cálculo de Métricas de Acoplamento Topológico e Saúde Arquitetural.
 * Desenvolvido no padrão Sociedade do Código para o Code Palandir.
 *
 * Implementa as formulações clássicas de Robert C. Martin (Clean Architecture):
 * - Acoplamento Aferente (Ca): Quantos módulos externos dependem deste módulo.
 * - Acoplamento Eferente (Ce): Quantos módulos externos este módulo consome.
 * - Instabilidade (I): I = Ce / (Ca + Ce), no intervalo [0, 1].
 *   - I = 0: Máxima estabilidade (módulo central, difícil de alterar sem impactar outros).
 *   - I = 1: Máxima instabilidade (módulo folha, fácil de alterar sem causar impacto reverso).
 *
 * Adicionalmente, detecta anomalias de design:
 * - God Components: componentes hipertrofiados com acoplamento e responsabilidades excessivas.
 * - Violações de Camada: componentes de UI efetuando requisições diretas de API.
 */

export function calculateArchitecturalMetrics(
  analysis: ProjectAnalysis
): ArchitecturalHealthReport {
  const allComponents = [...analysis.pages, ...analysis.components];

  if (allComponents.length === 0) {
    return {
      totalComponents: 0,
      averageInstability: 0,
      godComponentsCount: 0,
      layerViolationsCount: 0,
      overallHealthScore: 100,
      componentsMetrics: [],
      highestRiskComponents: [],
      summary: {
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
    };
  }

  // 1. Mapeamento de grafos de renderização para cálculo de Ca (In-degree)
  const afferentMap = new Map<string, Set<string>>();
  for (const comp of allComponents) {
    afferentMap.set(comp.name, new Set<string>());
  }

  for (const comp of allComponents) {
    for (const childName of comp.childrenNames) {
      if (afferentMap.has(childName)) {
        afferentMap.get(childName)!.add(comp.name);
      }
    }
  }

  // 2. Cálculo individual por componente
  const metricsList: ComponentCouplingMetrics[] = [];

  for (const comp of allComponents) {
    const callers = afferentMap.get(comp.name) || new Set();
    const afferentCoupling = callers.size;

    // Eferente: subcomponentes filhos + stores + apis + hooks customizados
    const distinctChildren = new Set(comp.childrenNames).size;
    const distinctStores = new Set(comp.stores.map((s) => s.storeName)).size;
    const distinctApis = new Set(comp.apiCalls.map((a) => `${a.method}:${a.endpoint}`)).size;
    const distinctCustomHooks = new Set(
      comp.hooks.filter((h) => h.isCustom).map((h) => h.name)
    ).size;

    const efferentCoupling =
      distinctChildren + distinctStores + distinctApis + distinctCustomHooks;

    // Instabilidade de Martin: I = Ce / (Ca + Ce)
    const totalCoupling = afferentCoupling + efferentCoupling;
    const instability =
      totalCoupling === 0
        ? 0
        : Math.round((efferentCoupling / totalCoupling) * 100) / 100;

    // Score de Complexidade Ponderado
    const complexityScore =
      distinctChildren * 2 +
      comp.actions.length * 1.5 +
      distinctStores * 3 +
      distinctApis * 2.5 +
      comp.hooks.length * 1;

    // Detecção de God Component
    const isGodComponent =
      complexityScore >= 16 ||
      distinctChildren > 8 ||
      comp.actions.length > 6 ||
      distinctStores > 3;

    // Detecção de Violação de Camada (Chamada direta de API dentro de UI)
    const hasLayerViolation = comp.apiCalls.length > 0;

    // Diagnósticos textuais estruturados
    const reasons: string[] = [];
    if (isGodComponent) {
      reasons.push(
        `God Component: complexidade elevada (${Math.round(complexityScore)} pts), com ${distinctChildren} filhos e ${comp.actions.length} ações.`
      );
    }
    if (hasLayerViolation) {
      reasons.push(
        `Violação de Camada: componente efetua ${comp.apiCalls.length} chamada(s) direta(s) de API sem abstração em store/serviço.`
      );
    }
    if (efferentCoupling >= 7) {
      reasons.push(
        `Alto Acoplamento Eferente (Ce = ${efferentCoupling}): componente depende de muitas entidades externas.`
      );
    }
    if (instability === 0 && afferentCoupling > 3) {
      reasons.push(
        `Componente Estável Central (Ca = ${afferentCoupling}): amplamente reutilizado no projeto.`
      );
    }

    // Classificação de Nível de Risco
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if ((isGodComponent && hasLayerViolation) || complexityScore >= 25) {
      riskLevel = 'critical';
    } else if (isGodComponent || complexityScore >= 16) {
      riskLevel = 'high';
    } else if (hasLayerViolation || complexityScore >= 8) {
      riskLevel = 'medium';
    }

    metricsList.push({
      componentName: comp.name,
      filePath: comp.filePath,
      isPage: comp.isPage,
      afferentCoupling,
      efferentCoupling,
      instability,
      isGodComponent,
      hasLayerViolation,
      complexityScore: Math.round(complexityScore * 10) / 10,
      riskLevel,
      reasons,
    });
  }

  // 3. Agregações Globais
  const totalInstability = metricsList.reduce((acc, m) => acc + m.instability, 0);
  const averageInstability =
    metricsList.length > 0
      ? Math.round((totalInstability / metricsList.length) * 100) / 100
      : 0;

  const godComponentsCount = metricsList.filter((m) => m.isGodComponent).length;
  const layerViolationsCount = metricsList.filter((m) => m.hasLayerViolation).length;

  const criticalCount = metricsList.filter((m) => m.riskLevel === 'critical').length;
  const highCount = metricsList.filter((m) => m.riskLevel === 'high').length;
  const mediumCount = metricsList.filter((m) => m.riskLevel === 'medium').length;
  const lowCount = metricsList.filter((m) => m.riskLevel === 'low').length;

  // Pontuação Global de Saúde (0 - 100)
  // Base 100 com penalidades balanceadas
  let deduction =
    criticalCount * 20 +
    highCount * 10 +
    mediumCount * 3 +
    layerViolationsCount * 2;
  const overallHealthScore = Math.max(0, Math.min(100, Math.round(100 - deduction)));

  // Componentes de maior risco ordenados por complexidade decrescente
  const highestRiskComponents = [...metricsList]
    .filter((m) => m.riskLevel !== 'low')
    .sort((a, b) => b.complexityScore - a.complexityScore);

  return {
    totalComponents: metricsList.length,
    averageInstability,
    godComponentsCount,
    layerViolationsCount,
    overallHealthScore,
    componentsMetrics: metricsList,
    highestRiskComponents,
    summary: {
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    },
  };
}

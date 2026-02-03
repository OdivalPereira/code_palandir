import {
  AiAuditEntry,
  AiMetricsResponse,
  AiMetricsSummary,
  AiUsageTokens,
  SessionPayload,
  ThreadSuggestion,
} from '../types';

type UnknownRecord = Record<string, unknown>;

type AiMetricsApiResponse = Omit<AiMetricsResponse, 'recent'> & {
  recent: Array<Omit<AiAuditEntry, 'timestamp'> & { timestamp: string | number }>;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const isAiUsageTokens = (value: unknown): value is AiUsageTokens => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.promptTokens === null || isNumber(value.promptTokens)) &&
    (value.outputTokens === null || isNumber(value.outputTokens)) &&
    (value.totalTokens === null || isNumber(value.totalTokens))
  );
};

const isAiMetricsSummary = (value: unknown): value is AiMetricsSummary => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNumber(value.totalRequests) &&
    isNumber(value.successCount) &&
    isNumber(value.errorCount) &&
    isNumber(value.hitRate) &&
    isNumber(value.averageLatencyMs) &&
    isNumber(value.totalCostUsd) &&
    isNumber(value.averageCostUsd) &&
    isString(value.lastUpdated)
  );
};

const isAiAuditEntry = (value: unknown): value is AiMetricsApiResponse['recent'][number] => {
  if (!isRecord(value)) {
    return false;
  }

  const timestamp = value.timestamp;
  const timestampValid = isNumber(timestamp) || isString(timestamp);

  return (
    isString(value.id) &&
    timestampValid &&
    isString(value.requestType) &&
    isString(value.model) &&
    isString(value.provider) &&
    isNumber(value.latencyMs) &&
    isBoolean(value.success) &&
    (value.error === undefined || value.error === null || isString(value.error)) &&
    (value.usage === undefined || value.usage === null || isAiUsageTokens(value.usage)) &&
    (value.costUsd === undefined || value.costUsd === null || isNumber(value.costUsd))
  );
};

export const isAiMetricsResponse = (value: unknown): value is AiMetricsApiResponse => {
  if (!isRecord(value)) {
    return false;
  }

  return isAiMetricsSummary(value.summary) && Array.isArray(value.recent) && value.recent.every(isAiAuditEntry);
};

export const isThreadSuggestion = (value: unknown): value is ThreadSuggestion => {
  if (!isRecord(value)) {
    return false;
  }

  const allowedTypes = new Set<ThreadSuggestion['type']>([
    'file',
    'api',
    'snippet',
    'migration',
    'table',
    'service',
  ]);

  return (
    isString(value.id) &&
    isString(value.title) &&
    isString(value.description) &&
    isBoolean(value.included) &&
    isString(value.type) &&
    allowedTypes.has(value.type as ThreadSuggestion['type']) &&
    (value.content === undefined || isString(value.content)) &&
    (value.path === undefined || isString(value.path)) &&
    (value.lines === undefined ||
      (Array.isArray(value.lines) &&
        value.lines.length === 2 &&
        isNumber(value.lines[0]) &&
        isNumber(value.lines[1])))
  );
};

export const isChatResponse = (
  value: unknown,
): value is {
  response: string;
  suggestions: ThreadSuggestion[];
  followUpQuestions: string[];
  usage?: AiUsageTokens;
  latencyMs?: number;
} => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.response) &&
    Array.isArray(value.suggestions) &&
    value.suggestions.every(isThreadSuggestion) &&
    isStringArray(value.followUpQuestions) &&
    (value.usage === undefined || isAiUsageTokens(value.usage) || value.usage === null) &&
    (value.latencyMs === undefined || isNumber(value.latencyMs))
  );
};

export const isSessionPayload = (value: unknown): value is SessionPayload => {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNumber(value.schemaVersion)) {
    return false;
  }

  if (!isRecord(value.graph) || !isRecord(value.selection) || !Array.isArray(value.prompts)) {
    return false;
  }

  const graph = value.graph as UnknownRecord;
  const selection = value.selection as UnknownRecord;

  if (
    !Array.isArray(graph.highlightedPaths) ||
    !graph.highlightedPaths.every(isString) ||
    !Array.isArray(graph.expandedDirectories) ||
    !graph.expandedDirectories.every(isString)
  ) {
    return false;
  }

  const rootNodeValid = graph.rootNode === null || isRecord(graph.rootNode);
  if (!rootNodeValid) {
    return false;
  }

  const selectedNodeId = selection.selectedNodeId;
  if (!(selectedNodeId === null || isString(selectedNodeId))) {
    return false;
  }

  if (value.layout !== undefined && value.layout !== null) {
    if (!isRecord(value.layout)) {
      return false;
    }
    if (!isString(value.layout.graphHash)) {
      return false;
    }
    if (!isRecord(value.layout.positions)) {
      return false;
    }

    const positions = value.layout.positions as Record<string, unknown>;
    const positionsValid = Object.values(positions).every((pos) => {
      if (!isRecord(pos)) {
        return false;
      }
      return isNumber(pos.x) && isNumber(pos.y);
    });

    if (!positionsValid) {
      return false;
    }
  }

  return true;
};

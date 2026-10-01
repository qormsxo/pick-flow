export interface SemanticPayload {
  answer: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  groundedProductIds: string[];
}

export type SemanticMatch = 'exact' | 'semantic' | 'coalesced' | 'generated';

export interface SemanticResolution extends SemanticPayload {
  cacheHit: boolean;
  match: SemanticMatch;
  similarity: number;
  nearestSimilarity: number | null;
}

export interface SemanticCacheOptions {
  indexName: string;
  keyPrefix: string;
  exactPrefix: string;
  threshold: number;
  coalesceThreshold: number;
  ttlSec: number;
  topK: number;
  dimension: number;
  lockTtlMs: number;
  waitAttempts: number;
  waitIntervalMs: number;
}

export const SEMANTIC_CACHE_OPTIONS = Symbol('SEMANTIC_CACHE_OPTIONS');

export const SEMANTIC_METRICS = {
  exact: 'metrics:semantic:exact',
  semantic: 'metrics:semantic:semantic',
  coalesced: 'metrics:semantic:coalesced',
  miss: 'metrics:semantic:miss',
  tokensSaved: 'metrics:semantic:tokens_saved',
} as const;

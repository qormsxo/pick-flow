import { addScaled, l2Normalize } from '../common/utils/vector.util';

/** 14일마다 신호 무게가 절반이 된다. */
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

export interface ProfileSignal {
  embedding: number[];
  weight: number;
  ageMs: number;
  category: string;
}

export interface BuiltProfile {
  interestVector: number[];
  categoryWeights: Record<string, number>;
}

/** 행동 무게와 시간 감소를 곱해 상품 좌표를 취향 좌표 하나로 합친다. */
export function buildProfile(signals: ProfileSignal[], dimension: number): BuiltProfile | null {
  if (signals.length === 0) return null;

  const accumulator = Array.from({ length: dimension }, () => 0);
  const categories: Record<string, number> = {};

  for (const signal of signals) {
    const decay = Math.pow(0.5, Math.max(0, signal.ageMs) / HALF_LIFE_MS);
    const weighted = signal.weight * decay;
    addScaled(accumulator, signal.embedding, weighted);
    categories[signal.category] = (categories[signal.category] ?? 0) + weighted;
  }

  const total = Object.values(categories).reduce((sum, value) => sum + value, 0);
  const categoryWeights: Record<string, number> = {};

  if (total > 0) {
    for (const [category, value] of Object.entries(categories)) {
      categoryWeights[category] = Number((value / total).toFixed(4));
    }
  }

  return {
    interestVector: l2Normalize(accumulator),
    categoryWeights,
  };
}

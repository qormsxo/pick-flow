import { isJsonNumber, isJsonObject, isJsonString, JsonValue, readJson } from '../common/utils/json-value';

export interface RerankPick {
  productId: string;
  rank: number;
  reason: string;
}

const RERANK_SYSTEM_LINES = [
  '너는 전달된 후보 상품만 다시 순위를 매긴다.',
  '후보에 없는 product_id 는 만들지 않는다.',
  'JSON 배열만 반환한다.',
  '각 원소는 product_id, rank, reason 이다.',
  'reason 은 사용자 행동과 태그를 근거로 한 문장이다.',
];

export const RERANK_SYSTEM = RERANK_SYSTEM_LINES.join(' ');

/** 후보 밖 id 와 중복을 버리고, rank 순으로 최대 limit 개만 남긴다. */
export function parseRerank(text: string, allowed: ReadonlySet<string>, limit: number): RerankPick[] {
  const picks: RerankPick[] = [];
  const seen = new Set<string>();

  for (const item of readRerankList(stripFence(text))) {
    const pick = readPick(item);

    if (!pick || !allowed.has(pick.productId) || seen.has(pick.productId)) continue;
    seen.add(pick.productId);
    picks.push(pick);
  }

  picks.sort((left, right) => left.rank - right.rank);
  const limited: RerankPick[] = [];

  for (const pick of picks) {
    if (limited.length >= limit) break;
    limited.push({ productId: pick.productId, rank: limited.length + 1, reason: pick.reason });
  }

  return limited;
}

/** 프로필과 후보만 넣는다. 전체 상품 테이블은 넘기지 않는다. */
export function buildRerankPrompt(profileText: string, candidateText: string, limit: number): string {
  return [
    '아래 후보 안에서만 이 사용자에게 맞는 순서를 정해라.',
    `최대 ${limit}개다.`,
    profileText,
    '[candidates]',
    candidateText,
  ].join('\n');
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);

  return fenced?.[1] ?? trimmed;
}

function readRerankList(text: string): JsonValue[] {
  const parsed = readJson(text);

  if (Array.isArray(parsed)) return parsed;
  if (!isJsonObject(parsed) || !Array.isArray(parsed.items)) return [];

  return parsed.items;
}

function readPick(value: JsonValue): RerankPick | null {
  if (!isJsonObject(value)) return null;

  const productId = isJsonString(value.product_id) ? value.product_id : null;
  const reason = isJsonString(value.reason) ? value.reason.trim() : '';
  const rank = isJsonNumber(value.rank) ? value.rank : Number.MAX_SAFE_INTEGER;

  if (!productId || !reason) return null;

  return { productId, rank, reason };
}

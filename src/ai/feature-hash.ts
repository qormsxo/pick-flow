import { l2Normalize } from '../common/utils/vector.util';

/**
 * 비용 0원 모드의 임베딩.
 * 조사와 군더더기를 걷어낸 뒤 남은 내용어를 고정 차원에 해시한다.
 * 같은 의도의 문장은 같은 내용어 집합이 되어 코사인 유사도가 올라간다.
 * 운영에서 이 함수의 자리만 임베딩 API 로 바뀌고, 인덱스 계약(차원, 코사인)은 그대로다.
 */
const TOKEN_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['추천해주세요', ''],
  ['추천해줘', ''],
  ['추천해', ''],
  ['비오는날', '비'],
  ['비오는', '비'],
  ['우천', '비'],
  ['raincoat', '자켓'],
  ['jacket', '자켓'],
  ['재킷', '자켓'],
  ['쟈켓', '자켓'],
  ['라이트', '가벼운'],
  ['레인', '비'],
  ['laptop', '노트북'],
  ['keyboard', '키보드'],
];

const STOPWORDS = new Set([
  '오는',
  '날',
  '입을',
  '입어',
  '입기',
  '좋은',
  '좋다',
  '추천',
  '좀',
  '하는',
  '하고',
  '위한',
  '있는',
  '입니다',
  '그리고',
  '에서',
  '으로',
  '에게',
]);

export function featureHashEmbedding(text: string, dimension: number): number[] {
  const vector = Array.from({ length: dimension }, () => 0);
  const tokens = contentTokens(text);

  if (tokens.length === 0) {
    accumulate(vector, text.toLowerCase(), 1);
  } else {
    for (const token of tokens) {
      accumulate(vector, token, 1);
      accumulate(vector, `${token}#2`, 0.35);
    }
  }

  return l2Normalize(vector);
}

function contentTokens(text: string): string[] {
  const aliased = applyAliases(text.toLowerCase());
  const tokens = aliased.split(/[^\p{L}\p{N}]+/u);
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (token.length === 0 || STOPWORDS.has(token)) continue;

    if (token.length < 2 && token !== '비') continue;

    if (seen.has(token)) continue;
    seen.add(token);
    unique.push(token);
  }

  return unique;
}

function applyAliases(text: string): string {
  let value = text;

  for (const [from, to] of TOKEN_ALIASES) {
    value = value.replaceAll(from, to);
  }

  return value;
}

function accumulate(vector: number[], token: string, weight: number): void {
  const hash = fnv1a(token);
  const index = hash % vector.length;
  const sign = (hash & 1) === 0 ? 1 : -1;
  vector[index] = (vector[index] ?? 0) + sign * weight;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

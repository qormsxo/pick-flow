export interface AiEmbedding {
  vector: number[];
  model: string;
  usageTokens: number;
}

export interface AiCompletion {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** 목록가 기준 추정치. fake provider 는 항상 0. */
  estimatedCostUsd: number;
}

/**
 * 추천 인덱스와 시맨틱 캐시가 같은 벡터 공간을 쓰려면
 * embed() 를 구현하는 쪽이 하나여야 한다. 호출부는 구현을 모른다.
 */
export interface AiProvider {
  readonly name: string;
  embed(text: string): Promise<AiEmbedding>;
  complete(prompt: string): Promise<AiCompletion>;
}

import { Inject, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { sha256 } from '../common/utils/hash.util';
import { sleep } from '../common/utils/sleep.util';
import { normalizeQuestion } from '../common/utils/text.util';
import { isJsonObject, isJsonNumber, isJsonString, isNumberList, isStringList, JsonObject, JsonValue, readJson } from '../common/utils/json-value';
import { VECTOR_STORE, VectorIndexSpec, VectorStore } from '../redis/vector-store.interface';
import { JsonStore, RedisService } from '../redis/redis.service';
import {
  SEMANTIC_CACHE_OPTIONS,
  SEMANTIC_METRICS,
  SemanticCacheOptions,
  SemanticMatch,
  SemanticPayload,
  SemanticResolution,
} from './semantic-cache.types';

interface ResolveInput {
  text: string;
  embed: () => Promise<number[]>;
  compute: (embedding: number[]) => Promise<SemanticPayload>;
  /** 비슷해도 상품 목록이 다르면 그 답은 재사용하지 않는다. */
  accept?: (payload: SemanticPayload) => boolean;
}

/**
 * 행동 해석 캐시의 두 단계.
 * 1) 정규화 문자열이 같으면 임베딩 없이 exact hit.
 * 2) 아니면 벡터 KNN. threshold 이상이면 생성 호출을 건너뛴다.
 *
 * 벡터 조회가 실패하면 LLM 으로 폴백하지 않는다.
 * 캐시 장애가 곧 비용 폭증이 되기 때문이다.
 */
@Injectable()
export class SemanticCacheService implements OnModuleInit {
  private readonly logger = new Logger(SemanticCacheService.name);
  private readonly spec: VectorIndexSpec;

  constructor(
    @Inject(VECTOR_STORE) private readonly vectors: VectorStore,
    @Inject(RedisService) private readonly redis: JsonStore,
    @Inject(SEMANTIC_CACHE_OPTIONS) private readonly options: SemanticCacheOptions,
  ) {
    this.spec = {
      name: options.indexName,
      prefix: options.keyPrefix,
      dimension: options.dimension,
      storedTextFields: ['payload', 'question'],
      tagFields: [],
      numericFields: ['createdAt'],
    };
  }

  async onModuleInit(): Promise<void> {
    await this.vectors.ensureIndex(this.spec);
  }

  /** 글자가 같으면 바로 재사용하고, 아니면 좌표 유사도가 기준 이상일 때만 재사용한다. 검색이 죽으면 생성하지 않는다. */
  async resolve(input: ResolveInput): Promise<SemanticResolution> {
    const normalized = normalizeQuestion(input.text);
    const exact = await this.readExact(normalized);

    if (exact) {
      await this.rememberHit(SEMANTIC_METRICS.exact, exact.payload);

      return this.toResolution(exact.payload, 'exact', 1, 1);
    }

    let embedding: number[];

    try {
      embedding = await input.embed();
    } catch (error) {
      this.logger.error(`Embedding failed: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException('Embedding provider unavailable');
    }

    const nearest = await this.searchOrFail(embedding);
    const reusable = this.accepted(nearest, input.accept);

    if (reusable?.payload) {
      await this.writeExact(normalized, reusable.payload);
      await this.rememberHit(SEMANTIC_METRICS.semantic, reusable.payload);

      return this.toResolution(reusable.payload, 'semantic', reusable.similarity, nearest?.similarity ?? reusable.similarity);
    }

    const lockKey = this.lockKey(embedding, nearest);

    return this.redis.withLock(
      lockKey,
      this.options.lockTtlMs,
      async () => {
        const again = await this.searchOrFail(embedding);
        const againHit = this.accepted(again, input.accept);

        if (againHit?.payload) {
          await this.writeExact(normalized, againHit.payload);
          await this.rememberHit(SEMANTIC_METRICS.coalesced, againHit.payload);

          return this.toResolution(againHit.payload, 'coalesced', againHit.similarity, again?.similarity ?? againHit.similarity);
        }

        return this.generate(normalized, embedding, input.compute, again?.similarity ?? nearest?.similarity ?? null);
      },
      async () => {
        const waited = await this.waitForHit(embedding, input.accept);

        if (waited?.payload) {
          await this.writeExact(normalized, waited.payload);
          await this.rememberHit(SEMANTIC_METRICS.coalesced, waited.payload);

          return this.toResolution(waited.payload, 'coalesced', waited.similarity, waited.similarity);
        }

        return this.generate(normalized, embedding, input.compute, nearest?.similarity ?? null);
      },
    );
  }

  async stats(): Promise<{
    exactHits: number;
    semanticHits: number;
    coalesced: number;
    misses: number;
    tokensSaved: number;
  }> {
    const values = await this.redis.mget([
      SEMANTIC_METRICS.exact,
      SEMANTIC_METRICS.semantic,
      SEMANTIC_METRICS.coalesced,
      SEMANTIC_METRICS.miss,
      SEMANTIC_METRICS.tokensSaved,
    ]);

    const num = (index: number) => Number(values[index] ?? 0);

    return {
      exactHits: num(0),
      semanticHits: num(1),
      coalesced: num(2),
      misses: num(3),
      tokensSaved: num(4),
    };
  }

  async clear(): Promise<void> {
    await this.vectors.dropIndex(this.spec);
    await this.vectors.ensureIndex(this.spec);
    await this.redis.deleteByPattern(`${this.options.exactPrefix}*`);
  }

  /** 새 답을 만들고 좌표 인덱스와 글자 키 양쪽에 저장한다. */
  private async generate(
    normalized: string,
    embedding: number[],
    compute: (embedding: number[]) => Promise<SemanticPayload>,
    nearestSimilarity: number | null,
  ): Promise<SemanticResolution> {
    const payload = await compute(embedding);
    await this.storeVector(normalized, embedding, payload);
    await this.writeExact(normalized, payload);
    await this.redis.incr(SEMANTIC_METRICS.miss);

    return this.toResolution(payload, 'generated', 0, nearestSimilarity);
  }

  private async storeVector(question: string, embedding: number[], payload: SemanticPayload): Promise<void> {
    const id = sha256(normalizeQuestion(question)).slice(0, 32);
    await this.vectors.upsert(
      this.spec,
      {
        id,
        embedding,
        fields: {
          payload: JSON.stringify(payload),
          question: question.slice(0, 500),
          createdAt: String(Date.now()),
        },
      },
      this.options.ttlSec,
    );
  }

  private async searchOrFail(
    embedding: number[],
  ): Promise<{ id: string; similarity: number; payload: SemanticPayload | null } | null> {
    let hits;

    try {
      hits = await this.vectors.search(this.spec, embedding, this.options.topK);
    } catch (error) {
      this.logger.error(`Vector search failed: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException('Semantic cache unavailable');
    }

    const top = hits[0];

    if (!top) return null;

    return { id: top.id, similarity: top.similarity, payload: parsePayload(top.fields.payload) };
  }

  /** 유사도가 기준 이상이고, 태그 조건이 있으면 그것도 맞을 때만 재사용한다. */
  private accepted(
    hit: { id: string; similarity: number; payload: SemanticPayload | null } | null,
    accept?: (payload: SemanticPayload) => boolean,
  ): { id: string; similarity: number; payload: SemanticPayload } | null {
    if (!hit?.payload || hit.similarity < this.options.threshold) return null;

    if (accept && !accept(hit.payload)) return null;

    return { id: hit.id, similarity: hit.similarity, payload: hit.payload };
  }

  private async waitForHit(
    embedding: number[],
    accept?: (payload: SemanticPayload) => boolean,
  ): Promise<{ id: string; similarity: number; payload: SemanticPayload | null } | null> {
    for (let attempt = 0; attempt < this.options.waitAttempts; attempt += 1) {
      await sleep(this.options.waitIntervalMs);
      const hit = this.accepted(await this.searchOrFail(embedding), accept);

      if (hit) return hit;
    }

    return null;
  }

  /**
   * 이미 가까운 캐시 문서가 있으면 그 문서 락을 잡아 패러프레이즈가 한 생성으로 모인다.
   * 인덱스가 비어 있으면 임베딩의 상위 차원 부호를 락 키로 쓴다.
   * feature hashing 에서 비슷한 문장은 같은 차원에 에너지를 모으므로 서명이 겹친다.
   */
  private lockKey(
    embedding: number[],
    nearest: { id: string; similarity: number } | null,
  ): string {
    if (nearest && nearest.similarity >= this.options.coalesceThreshold) {
      return `lock:sc:doc:${nearest.id}`;
    }

    const signature = embedding
      .map((value, index) => ({ index, magnitude: Math.abs(value) }))
      .sort((left, right) => right.magnitude - left.magnitude)
      .slice(0, 8)
      .map((item) => `${item.index}:${Math.sign(embedding[item.index] ?? 0)}`)
      .sort()
      .join('|');

    return `lock:sc:sig:${sha256(signature).slice(0, 24)}`;
  }

  private exactKey(normalized: string): string {
    return `${this.options.exactPrefix}${sha256(normalized)}`;
  }

  private async readExact(normalized: string): Promise<{ payload: SemanticPayload } | null> {
    try {
      const stored = await this.redis.getJson(this.exactKey(normalized));

      const exact = readExactCache(stored);

      if (!exact) return null;

      return exact;
    } catch (error) {
      this.logger.error(`Exact cache read failed: ${error instanceof Error ? error.message : error}`);
      throw new ServiceUnavailableException('Semantic cache unavailable');
    }
  }

  private async writeExact(normalized: string, payload: SemanticPayload): Promise<void> {
    await this.redis.setJson(this.exactKey(normalized), { payload: payloadJson(payload) }, this.options.ttlSec);
  }

  private async rememberHit(metric: string, payload: SemanticPayload): Promise<void> {
    await this.redis.incr(metric);
    const tokens = payload.promptTokens + payload.completionTokens;

    if (tokens > 0) await this.redis.incrBy(SEMANTIC_METRICS.tokensSaved, tokens);
  }


  private toResolution(
    payload: SemanticPayload,
    match: SemanticMatch,
    similarity: number,
    nearestSimilarity: number | null,
  ): SemanticResolution {
    return {
      ...payload,
      cacheHit: match !== 'generated',
      match,
      similarity,
      nearestSimilarity,
      estimatedCostUsd: match === 'generated' ? payload.estimatedCostUsd : 0,
    };
  }
}

interface ExactCache {
  payload: SemanticPayload;
}

function parsePayload(raw: string | undefined): SemanticPayload | null {
  if (!raw) return null;

  const parsed = readJson(raw);

  return readSemanticPayload(parsed);
}

function readExactCache(value: JsonValue | null): ExactCache | null {
  if (!isJsonObject(value)) return null;

  const payload = readSemanticPayload(value.payload);

  if (!payload) return null;

  return { payload };
}

function readSemanticPayload(value: JsonValue | undefined): SemanticPayload | null {
  if (!isJsonObject(value)) return null;

  const answer = value.answer;
  const model = value.model;
  const promptTokens = value.promptTokens;
  const completionTokens = value.completionTokens;
  const estimatedCostUsd = value.estimatedCostUsd;
  const groundedProductIds = value.groundedProductIds;

  if (!isJsonString(answer) || !isJsonString(model)) return null;

  if (!isJsonNumber(promptTokens) || !isJsonNumber(completionTokens) || !isJsonNumber(estimatedCostUsd)) return null;

  if (!isStringList(groundedProductIds)) return null;

  const payload: SemanticPayload = {
    answer,
    model,
    promptTokens,
    completionTokens,
    estimatedCostUsd,
    groundedProductIds,
  };

  if (value.searchVector === undefined) return payload;

  if (!isNumberList(value.searchVector)) return null;
  payload.searchVector = value.searchVector;

  return payload;
}

function payloadJson(payload: SemanticPayload): JsonObject {
  const body: JsonObject = {
    answer: payload.answer,
    model: payload.model,
    promptTokens: payload.promptTokens,
    completionTokens: payload.completionTokens,
    estimatedCostUsd: payload.estimatedCostUsd,
    groundedProductIds: payload.groundedProductIds,
  };

  if (payload.searchVector) body.searchVector = payload.searchVector;

  return body;
}

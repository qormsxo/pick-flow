import { featureHashEmbedding } from '../src/ai/feature-hash';
import { sleep } from '../src/common/utils/sleep.util';
import { RedisService } from '../src/redis/redis.service';
import { SemanticCacheService } from '../src/semantic-cache/semantic-cache.service';
import { SemanticCacheOptions, SemanticPayload } from '../src/semantic-cache/semantic-cache.types';
import { InMemoryVectorStore } from './support/in-memory-vector.store';
import { MemoryRedis } from './support/memory-redis';

const DIM = 384;

function payload(answer: string): SemanticPayload {
  return {
    answer,
    model: 'fake-chat-v1',
    promptTokens: 20,
    completionTokens: 10,
    estimatedCostUsd: 0,
    groundedProductIds: ['p1'],
  };
}

describe('SemanticCacheService', () => {
  const options: SemanticCacheOptions = {
    indexName: 'idx:semantic_cache',
    keyPrefix: 'sc:',
    exactPrefix: 'sc:exact:',
    threshold: 0.86,
    coalesceThreshold: 0.78,
    ttlSec: 60,
    topK: 1,
    dimension: DIM,
    lockTtlMs: 2_000,
    waitAttempts: 8,
    waitIntervalMs: 15,
  };

  function createService() {
    const vectors = new InMemoryVectorStore();
    const redis = new MemoryRedis();
    const service = new SemanticCacheService(
      vectors,
      redis as unknown as RedisService,
      options,
    );
    return { service, redis };
  }

  it('serves an identical question from the exact cache without embedding again', async () => {
    const { service } = createService();
    let embeddings = 0;
    const question = '비 오는 날 입을 가벼운 자켓 추천해줘';
    const run = () =>
      service.resolve({
        text: question,
        embed: async () => {
          embeddings += 1;
          return featureHashEmbedding(question, DIM);
        },
        compute: async () => payload('라이트 레인 자켓'),
      });

    const first = await run();
    const second = await run();

    expect(first.match).toBe('generated');
    expect(second.match).toBe('exact');
    expect(second.estimatedCostUsd).toBe(0);
    expect(embeddings).toBe(1);
  });

  it('reuses a paraphrase through vector similarity and skips generation', async () => {
    const { service } = createService();
    let generations = 0;
    const resolve = (text: string) =>
      service.resolve({
        text,
        embed: async () => featureHashEmbedding(text, DIM),
        compute: async () => {
          generations += 1;
          return payload('라이트 레인 자켓');
        },
      });

    const first = await resolve('비 오는 날 입을 가벼운 자켓 추천해줘');
    const second = await resolve('비오는 날 가벼운 재킷 추천');

    expect(first.match).toBe('generated');
    expect(second.match).toBe('semantic');
    expect(second.cacheHit).toBe(true);
    expect(generations).toBe(1);
  });

  it('does not reuse an unrelated question', async () => {
    const { service } = createService();
    const resolve = (text: string) =>
      service.resolve({
        text,
        embed: async () => featureHashEmbedding(text, DIM),
        compute: async () => payload(text),
      });

    await resolve('비 오는 날 입을 가벼운 자켓 추천해줘');
    const other = await resolve('기계식 키보드 스위치 추천');
    expect(other.match).toBe('generated');
  });

  it('coalesces concurrent identical misses into one generation', async () => {
    const { service } = createService();
    let generations = 0;
    const text = '비 오는 날 입을 가벼운 자켓 추천해줘';
    const run = () =>
      service.resolve({
        text,
        embed: async () => featureHashEmbedding(text, DIM),
        compute: async () => {
          generations += 1;
          await sleep(40);
          return payload('라이트 레인 자켓');
        },
      });

    const [left, right] = await Promise.all([run(), run()]);
    expect(generations).toBe(1);
    expect([left.match, right.match].sort()).toEqual(['coalesced', 'generated']);
  });
});

import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { AiProvider } from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai.constants';
import { ProductsRepository } from '../catalog/products.repository';
import { UserEventsRepository } from '../events/user-events.repository';
import { SemanticCacheService } from '../semantic-cache/semantic-cache.service';
import { SemanticMatch } from '../semantic-cache/semantic-cache.types';
import { buildActionBrief } from './action-brief';

const RECENT_EVENT_LIMIT = 30;

export interface TasteInsight {
  summary: string | null;
  match: SemanticMatch | 'skipped';
  cacheHit: boolean;
  similarity: number;
  nearestSimilarity: number | null;
  eventCount: number;
  model: string | null;
}

@Injectable()
export class TasteInsightService {
  constructor(
    private readonly events: UserEventsRepository,
    private readonly products: ProductsRepository,
    private readonly cache: SemanticCacheService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  /**
   * 추천 목록은 좌표 비교로 이미 고른다.
   * 여기서는 최근 행동이 어떤 쇼핑인지 두 문장으로만 만든다.
   * 비슷한 행동 문장은 시맨틱 캐시가 생성 API를 건너뛴다.
   */
  async describe(userId: string): Promise<TasteInsight> {
    const events = await this.events.findRecentByUser(userId, RECENT_EVENT_LIMIT);
    const products = await this.products.findByIds([...new Set(events.map((event) => event.productId))]);
    const brief = buildActionBrief(
      events.map((event) => ({ productId: event.productId, type: event.type })),
      new Map(products.map((product) => [product.id, product])),
    );

    if (!brief.text) {
      return {
        summary: null,
        match: 'skipped',
        cacheHit: false,
        similarity: 0,
        nearestSimilarity: null,
        eventCount: 0,
        model: null,
      };
    }

    const prompt = [
      '아래는 한 사용자의 최근 행동이다.',
      '상품 이름을 다시 나열하지 말고, 이 조합이 어떤 쇼핑인지 두 문장으로 말해라.',
      '행동에 없는 상품 이름은 만들지 마라.',
      '[actions]',
      brief.text,
    ].join('\n');

    const resolved = await this.cache.resolve({
      text: brief.text,
      embed: async () => (await this.ai.embed(brief.text)).vector,
      compute: async () => {
        try {
          const completion = await this.ai.complete(prompt);
          return {
            answer: completion.text,
            model: completion.model,
            promptTokens: completion.promptTokens,
            completionTokens: completion.completionTokens,
            estimatedCostUsd: completion.estimatedCostUsd,
            groundedProductIds: brief.productIds,
          };
        } catch (error) {
          throw new BadGatewayException(error instanceof Error ? error.message : 'AI provider failed');
        }
      },
    });

    return {
      summary: resolved.answer,
      match: resolved.match,
      cacheHit: resolved.cacheHit,
      similarity: resolved.similarity,
      nearestSimilarity: resolved.nearestSimilarity,
      eventCount: brief.productIds.length,
      model: resolved.model,
    };
  }

  stats() {
    return this.cache.stats();
  }

  clearCache() {
    return this.cache.clear();
  }
}

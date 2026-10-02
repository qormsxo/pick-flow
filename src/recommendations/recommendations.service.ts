import { Injectable } from '@nestjs/common';
import { ProductIndexService } from '../catalog/product-index.service';
import { ProductsRepository } from '../catalog/products.repository';
import { sleep } from '../common/utils/sleep.util';
import { PopularityService } from '../events/popularity.service';
import { HOT_WINDOW_SEC, USER_VECTOR_KEY } from '../queue/queue.constants';
import { RedisService } from '../redis/redis.service';
import { PreferencesRepository } from './preferences.repository';
import { TasteInsightService } from './taste-insight.service';

export interface RecommendationItem {
  productId: string;
  name: string;
  category: string;
  price: number;
  score: number;
  reason: 'personalized' | 'popular';
}

interface CachedRecommendations {
  source: 'personalized' | 'popular';
  items: RecommendationItem[];
  summary: string | null;
  summaryMatch: string | null;
}

export interface RecommendationResult extends CachedRecommendations {
  cacheHit: boolean;
  tookMs: number;
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly redis: RedisService,
    private readonly preferences: PreferencesRepository,
    private readonly products: ProductsRepository,
    private readonly index: ProductIndexService,
    private readonly popularity: PopularityService,
    private readonly insight: TasteInsightService,
  ) {}

  async recommend(userId: string, limit: number): Promise<RecommendationResult> {
    const started = Date.now();
    const cacheKey = `rec:${userId}:${limit}`;
    const cached = await this.redis.getJson<CachedRecommendations>(cacheKey);
    if (cached?.items && cached.summaryMatch !== undefined) {
      return { ...cached, cacheHit: true, tookMs: Date.now() - started };
    }

    let cacheHit = false;
    const built = await this.redis.withLock(
      `lock:rec:${userId}`,
      3_000,
      async () => {
        const again = await this.redis.getJson<CachedRecommendations>(cacheKey);
        if (again) {
          cacheHit = true;
          return again;
        }
        const fresh = await this.withScene(userId, await this.build(userId, limit));
        await this.redis.setJson(cacheKey, fresh, 60);
        return fresh;
      },
      async () => {
        await sleep(40);
        const waited = await this.redis.getJson<CachedRecommendations>(cacheKey);
        if (waited) {
          cacheHit = true;
          return waited;
        }
        return this.withScene(userId, await this.build(userId, limit));
      },
    );

    return { ...built, cacheHit, tookMs: Date.now() - started };
  }

  private async build(userId: string, limit: number): Promise<CachedRecommendations> {
    const vector = await this.loadVector(userId);
    if (vector) {
      try {
        const hits = await this.index.search(vector, limit);
        if (hits.length > 0) {
          return {
            source: 'personalized' as const,
            summary: null,
            summaryMatch: null,
            items: hits.map((hit) => ({
              productId: hit.id,
              name: hit.name,
              category: hit.category,
              price: hit.price,
              score: Number(hit.similarity.toFixed(4)),
              reason: 'personalized' as const,
            })),
          };
        }
      } catch {
        // 개인화 인덱스가 죽어도 홈 추천은 인기 상품으로 남긴다.
        return this.popular(limit);
      }
    }
    return this.popular(limit);
  }

  private async loadVector(userId: string): Promise<number[] | null> {
    const cached = await this.redis.getJson<number[]>(USER_VECTOR_KEY(userId));
    if (cached && cached.length > 0) return cached;

    const preference = await this.preferences.findByUserId(userId);
    if (!preference?.interestVector?.length) return null;
    await this.redis.setJson(USER_VECTOR_KEY(userId), preference.interestVector, HOT_WINDOW_SEC);
    return preference.interestVector;
  }

  private async withScene(userId: string, built: CachedRecommendations): Promise<CachedRecommendations> {
    try {
      const scene = await this.insight.describe(userId);
      return { ...built, summary: scene.summary, summaryMatch: scene.match };
    } catch {
      return built;
    }
  }

  private async popular(limit: number): Promise<CachedRecommendations> {
    const ids = await this.popularity.top(limit);
    const products = await this.products.findByIds(ids);
    const byId = new Map(products.map((product) => [product.id, product]));
    const items = ids.flatMap((id, index) => {
      const product = byId.get(id);
      if (!product) return [];
      return [
        {
          productId: product.id,
          name: product.name,
          category: product.category,
          price: Number(product.price),
          score: Number((1 - index / Math.max(ids.length, 1)).toFixed(4)),
          reason: 'popular' as const,
        },
      ];
    });
    return { source: 'popular', summary: null, summaryMatch: null, items };
  }
}

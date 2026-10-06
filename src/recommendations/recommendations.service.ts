import { Inject, Injectable } from '@nestjs/common';
import { AiProvider } from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai.constants';
import { IndexedProduct, ProductIndexService } from '../catalog/product-index.service';
import { ProductEntity } from '../catalog/product.entity';
import { ProductsRepository } from '../catalog/products.repository';
import { isJsonNumber, isJsonObject, isJsonString, isNumberList, JsonObject, JsonValue } from '../common/utils/json-value';
import { sleep } from '../common/utils/sleep.util';
import { EVENT_WEIGHT, EventType } from '../events/event-type.enum';
import { PopularityService } from '../events/popularity.service';
import { UserEventsRepository } from '../events/user-events.repository';
import { HOT_WINDOW_SEC, USER_VECTOR_KEY } from '../queue/queue.constants';
import { RedisService } from '../redis/redis.service';
import { buildActionBrief } from './action-brief';
import { PreferencesRepository } from './preferences.repository';
import { buildRerankPrompt, parseRerank, RERANK_SYSTEM, RerankPick } from './rerank';
import { TasteInsight, TasteInsightService } from './taste-insight.service';

const CANDIDATE_LIMIT = 40;
const FINAL_LIMIT = 10;
const PROFILE_EVENT_LIMIT = 30;

export interface RecommendationItem {
  productId: string;
  name: string;
  category: string;
  price: number;
  score: number;
  rank: number;
  reason: string;
}

interface RankedCandidate {
  hit: IndexedProduct;
  product: ProductEntity;
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
    private readonly events: UserEventsRepository,
    private readonly insight: TasteInsightService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  async recommend(userId: string, limit: number): Promise<RecommendationResult> {
    const started = Date.now();
    const cacheKey = `rec:${userId}:${limit}`;
    const cached = readCached(await this.redis.getJson(cacheKey));

    if (cached) {
      return { ...cached, cacheHit: true, tookMs: Date.now() - started };
    }

    let cacheHit = false;

    const built = await this.redis.withLock(
      `lock:rec:${userId}`,
      20_000,
      async () => {
        const again = readCached(await this.redis.getJson(cacheKey));

        if (again) {
          cacheHit = true;

          return again;
        }

        const fresh = await this.build(userId, limit);
        await this.redis.setJson(cacheKey, cachedJson(fresh), 60);

        return fresh;
      },
      async () => {
        await sleep(40);
        const waited = readCached(await this.redis.getJson(cacheKey));

        if (waited) {
          cacheHit = true;

          return waited;
        }

        return this.build(userId, limit);
      },
    );

    return { ...built, cacheHit, tookMs: Date.now() - started };
  }

  private async build(userId: string, limit: number): Promise<CachedRecommendations> {
    const finalLimit = Math.min(limit, FINAL_LIMIT);
    const taste = await this.tasteHits(userId, CANDIDATE_LIMIT);

    if (taste.length === 0) return this.popular(finalLimit);

    const candidates = await this.filterCandidates(userId, taste);

    if (candidates.length === 0) return this.popular(finalLimit);

    try {
      const completion = await this.ai.completeJson(
        RERANK_SYSTEM,
        buildRerankPrompt(await this.profileText(userId), candidateText(candidates), finalLimit),
      );
      const allowed = new Set(candidates.map((candidate) => candidate.product.id));
      const picks = parseRerank(completion.text, allowed, finalLimit);
      const items = await this.itemsFromPicks(candidates, picks.length > 0 ? picks : vectorPicks(candidates, finalLimit));

      return { source: 'personalized', summary: null, summaryMatch: null, items };
    } catch {
      return {
        source: 'personalized',
        summary: null,
        summaryMatch: null,
        items: await this.itemsFromPicks(candidates, vectorPicks(candidates, finalLimit)),
      };
    }
  }

  private async loadVector(userId: string): Promise<number[] | null> {
    const cached = await this.redis.getJson(USER_VECTOR_KEY(userId));

    if (isNumberList(cached) && cached.length > 0) return cached;

    const preference = await this.preferences.findByUserId(userId);

    if (!preference?.interestVector?.length) return null;
    await this.redis.setJson(USER_VECTOR_KEY(userId), preference.interestVector, HOT_WINDOW_SEC);

    return preference.interestVector;
  }

  async explain(userId: string): Promise<TasteInsight> {
    const taste = await this.tasteHits(userId, 5);

    return this.insight.describe(
      userId,
      taste.map((hit) => ({
        productId: hit.id,
        name: hit.name,
        category: hit.category,
      })),
    );
  }

  /** 재고 컬럼과 제외 카테고리 설정은 없다. 구매한 상품과 좌표가 없는 상품만 뺀다. */
  private async filterCandidates(userId: string, hits: IndexedProduct[]): Promise<RankedCandidate[]> {
    const purchased = new Set(await this.events.findProductIds(userId, EventType.PURCHASE));
    const rows = await this.products.findByIds(hits.map((hit) => hit.id));
    const byId = new Map(rows.map((product) => [product.id, product]));
    const candidates: RankedCandidate[] = [];

    for (const hit of hits) {
      const product = byId.get(hit.id);

      if (!product || !product.embeddingReady || purchased.has(product.id)) continue;
      candidates.push({ hit, product });
    }

    return candidates;
  }

  private async profileText(userId: string): Promise<string> {
    const preference = await this.preferences.findByUserId(userId);
    const events = await this.events.findRecentByUser(userId, PROFILE_EVENT_LIMIT);
    const rows = await this.products.findByIds([...new Set(events.map((event) => event.productId))]);
    const brief = buildActionBrief(
      events.map((event) => ({ productId: event.productId, type: event.type })),
      new Map(rows.map((product) => [product.id, product])),
    );
    const weights: string[] = [];

    if (preference) {
      for (const [category, weight] of Object.entries(preference.categoryWeights)) {
        weights.push(`${category} ${weight}`);
      }
    }

    const legend = Object.values(EventType).map((type) => `${type} ${EVENT_WEIGHT[type]}`);

    return ['가중치: ' + legend.join(', '), '[profile]', weights.join(', ') || '(none)', '[actions]', brief.text || '(none)'].join('\n');
  }

  private async itemsFromPicks(candidates: RankedCandidate[], picks: RerankPick[]): Promise<RecommendationItem[]> {
    const rows = await this.products.findByIds(picks.map((pick) => pick.productId));
    const byId = new Map(rows.map((product) => [product.id, product]));
    const scoreOf = new Map(candidates.map((candidate) => [candidate.product.id, candidate.hit.similarity]));
    const items: RecommendationItem[] = [];

    for (const pick of picks) {
      const product = byId.get(pick.productId);

      if (!product) continue;
      items.push({
        productId: product.id,
        name: product.name,
        category: product.category,
        price: Number(product.price),
        score: Number((scoreOf.get(product.id) ?? 0).toFixed(4)),
        rank: items.length + 1,
        reason: pick.reason,
      });
    }

    return items;
  }

  /** 취향 좌표로 가까운 상품을 찾는다. 최종 순위는 후보를 LLM 이 다시 매긴다. */
  private async tasteHits(userId: string, limit: number): Promise<IndexedProduct[]> {
    const vector = await this.loadVector(userId);

    if (!vector) return [];

    try {
      return await this.index.search(vector, limit);
    } catch {
      return [];
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
          rank: index + 1,
          reason: '최근 많이 선택된 상품입니다.',
        },
      ];
    });

    return { source: 'popular', summary: null, summaryMatch: null, items };
  }
}

function vectorPicks(candidates: RankedCandidate[], limit: number): RerankPick[] {
  const picks: RerankPick[] = [];

  for (const candidate of candidates) {
    if (picks.length >= limit) break;
    picks.push({
      productId: candidate.product.id,
      rank: picks.length + 1,
      reason: '취향 좌표와 가까운 상품입니다.',
    });
  }

  return picks;
}

function candidateText(candidates: RankedCandidate[]): string {
  const lines: string[] = [];

  for (const candidate of candidates) {
    const description = candidate.product.description.replace(/\s+/g, ' ').trim().slice(0, 120);
    const tags = candidate.product.tags.join(', ');

    lines.push(
      `- ${candidate.product.id} | ${candidate.product.name} | ${candidate.product.category} | ${candidate.hit.similarity.toFixed(4)} | ${tags} | ${description}`,
    );
  }

  return lines.join('\n');
}

function readCached(value: JsonValue | null): CachedRecommendations | null {
  if (!isJsonObject(value)) return null;

  const source = value.source === 'personalized' || value.source === 'popular' ? value.source : null;
  const summary = isJsonString(value.summary) || value.summary === null ? value.summary : undefined;
  const summaryMatch = isJsonString(value.summaryMatch) || value.summaryMatch === null ? value.summaryMatch : undefined;

  if (!source || summary === undefined || summaryMatch === undefined || !Array.isArray(value.items)) return null;

  const items: RecommendationItem[] = [];

  for (const item of value.items) {
    const parsed = readItem(item);

    if (!parsed) return null;
    items.push(parsed);
  }

  return { source, summary, summaryMatch, items };
}

function readItem(value: JsonValue): RecommendationItem | null {
  if (!isJsonObject(value)) return null;

  const productId = value.productId;
  const name = value.name;
  const category = value.category;
  const price = value.price;
  const score = value.score;
  const rank = value.rank;
  const reason = value.reason;

  if (!isJsonString(productId) || !isJsonString(name) || !isJsonString(category) || !isJsonString(reason)) return null;

  if (!isJsonNumber(price) || !isJsonNumber(score) || !isJsonNumber(rank)) return null;

  return { productId, name, category, price, score, rank, reason };
}

function cachedJson(value: CachedRecommendations): JsonObject {
  return {
    source: value.source,
    summary: value.summary,
    summaryMatch: value.summaryMatch,
    items: value.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      category: item.category,
      price: item.price,
      score: item.score,
      rank: item.rank,
      reason: item.reason,
    })),
  };
}

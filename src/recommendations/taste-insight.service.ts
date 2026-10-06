import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { AiProvider } from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai.constants';
import { ProductsRepository } from '../catalog/products.repository';
import { UserEventsRepository } from '../events/user-events.repository';
import { SemanticCacheService } from '../semantic-cache/semantic-cache.service';
import { SemanticMatch } from '../semantic-cache/semantic-cache.types';
import { buildActionBrief } from './action-brief';

const RECENT_EVENT_LIMIT = 30;

function kindKey(tags: string[]): string {
  return [...new Set(tags.filter(Boolean))].sort().join(',');
}

/** 등록 순서는 종류를 앞에 둔다. 가벼운, 비 같은 속성은 문장에 넣지 않는다. */
function primaryTag(tags: string[] | undefined): string {
  return tags?.map((tag) => tag.trim()).find(Boolean) ?? '';
}

export interface RetrievedProduct {
  productId: string;
  name: string;
  category: string;
}

export interface TasteInsight {
  summary: string | null;
  match: SemanticMatch | 'skipped';
  cacheHit: boolean;
  similarity: number;
  nearestSimilarity: number | null;
  eventCount: number;
  model: string | null;
  searchVector: number[] | null;
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
   * 취향 검색으로 고른 태그를 AI에게 보내 검색용 문장을 받는다.
   * 상품 목록은 만들지 않는다. 문장을 좌표로 바꾼 searchVector 로 다시 검색한다.
   * 캐시 키는 태그다. 이름이 달라도 태그가 같으면 그 문장과 좌표를 재사용한다.
   */
  async describe(userId: string, retrieved: RetrievedProduct[]): Promise<TasteInsight> {
    const events = await this.events.findRecentByUser(userId, RECENT_EVENT_LIMIT);

    const behaviorProducts = await this.products.findByIds([
      ...new Set(events.map((event) => event.productId)),
    ]);

    const brief = buildActionBrief(
      events.map((event) => ({ productId: event.productId, type: event.type })),
      new Map(behaviorProducts.map((product) => [product.id, product])),
    );

    if (retrieved.length === 0) {
      return {
        summary: null,
        match: 'skipped',
        cacheHit: false,
        similarity: 0,
        nearestSimilarity: null,
        eventCount: brief.productIds.length,
        model: null,
        searchVector: null,
      };
    }

    const catalog = await this.products.findByIds([
      ...new Set([...retrieved.map((item) => item.productId), ...behaviorProducts.map((product) => product.id)]),
    ]);

    const byId = new Map(catalog.map((product) => [product.id, product]));
    const byName = new Map(catalog.map((product) => [product.name, product]));
    const retrievedTags = retrieved.map((item) => primaryTag(byId.get(item.productId)?.tags));
    const seenTags = new Set<string>();

    const uniqueTags: string[] = [];

    for (const tag of retrievedTags) {
      if (!tag || seenTags.has(tag)) continue;
      seenTags.add(tag);
      uniqueTags.push(tag);
    }

    const retrievedText = uniqueTags.map((tag) => `- ${tag}`).join('\n');

    if (!retrievedText) {
      return {
        summary: null,
        match: 'skipped',
        cacheHit: false,
        similarity: 0,
        nearestSimilarity: null,
        eventCount: brief.productIds.length,
        model: null,
        searchVector: null,
      };
    }

    const actionTags = brief.text
      ? brief.text.split('\n').flatMap((line) => {
          const match = line.match(/^- (\S+) \| (.+?) \|/);

          if (!match) return [];
          const tag = primaryTag(byName.get(match[2].trim())?.tags);

          return tag ? [`${match[1]}|${tag}`] : [];
        })
      : [];

    const actionText = actionTags.length > 0 ? actionTags.map((line) => `- ${line.replace('|', ' | ')}`).join('\n') : '(none)';
    const kinds = kindKey(retrievedTags);
    const actionKinds = [...actionTags].sort().join(',');
    const cacheText = `${actionKinds}\n${kinds}`;

    const prompt = [
      '아래는 한 사용자의 최근 행동과, 취향 좌표로 찾은 상품 태그다.',
      '상품 이름과 상품 목록은 만들지 마라.',
      '태그 단어를 그대로 써서 어떤 쇼핑인지 두 문장만 말해라. 이 문장으로 상품을 검색한다.',
      '자켓을 아우터처럼 다른 말로 바꾸지 마라.',
      '목록에 없는 태그는 만들지 마라.',
      '[actions]',
      actionText,
      '[retrieved]',
      retrievedText,
    ].join('\n');

    const resolved = await this.cache.resolve({
      text: cacheText,
      accept: (payload) => kindKey(payload.groundedProductIds ?? []) === kinds,
      embed: async () => (await this.ai.embed(cacheText)).vector,
      compute: async () => {
        try {
          const completion = await this.ai.complete(prompt);
          const embedded = await this.ai.embed(completion.text);

          return {
            answer: completion.text,
            model: completion.model,
            promptTokens: completion.promptTokens,
            completionTokens: completion.completionTokens,
            estimatedCostUsd: completion.estimatedCostUsd,
            groundedProductIds: kinds ? kinds.split(',') : [],
            searchVector: embedded.vector,
          };
        } catch (error) {
          throw new BadGatewayException(error instanceof Error ? error.message : 'AI provider failed');
        }
      },
    });

    const searchVector = resolved.searchVector?.length
      ? resolved.searchVector
      : (await this.ai.embed(resolved.answer)).vector;

    return {
      summary: resolved.answer,
      match: resolved.match,
      cacheHit: resolved.cacheHit,
      similarity: resolved.similarity,
      nearestSimilarity: resolved.nearestSimilarity,
      eventCount: brief.productIds.length,
      model: resolved.model,
      searchVector,
    };
  }

  stats() {
    return this.cache.stats();
  }

  clearCache() {
    return this.cache.clear();
  }
}

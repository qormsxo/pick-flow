import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { AiProvider } from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai.constants';
import { IndexedProduct, ProductIndexService } from '../catalog/product-index.service';
import { SemanticCacheService } from '../semantic-cache/semantic-cache.service';
import { SemanticResolution } from '../semantic-cache/semantic-cache.types';

@Injectable()
export class AssistantService {
  constructor(
    private readonly cache: SemanticCacheService,
    private readonly products: ProductIndexService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  /**
   * 개인화 추천과 일부러 분리했다.
   * 여기 캐시는 질문 의미가 같으면 유저와 무관하게 재사용한다.
   * 유저별 답변을 넣으면 히트율이 무너지고 다른 사람 취향이 섞인다.
   */
  ask(question: string): Promise<SemanticResolution> {
    return this.cache.resolve({
      text: question,
      embed: async () => (await this.ai.embed(question)).vector,
      compute: async (embedding) => {
        const grounded = await this.products.search(embedding, 3);
        const prompt = this.prompt(question, grounded);
        try {
          const completion = await this.ai.complete(prompt);
          return {
            answer: completion.text,
            model: completion.model,
            promptTokens: completion.promptTokens,
            completionTokens: completion.completionTokens,
            estimatedCostUsd: completion.estimatedCostUsd,
            groundedProductIds: grounded.map((product) => product.id),
          };
        } catch (error) {
          throw new BadGatewayException(
            error instanceof Error ? error.message : 'AI provider failed',
          );
        }
      },
    });
  }

  stats() {
    return this.cache.stats();
  }

  clearCache() {
    return this.cache.clear();
  }

  private prompt(question: string, products: IndexedProduct[]): string {
    const catalog =
      products.length === 0
        ? '(none)'
        : products
            .map((product) => `- ${product.name} | ${product.category} | ${product.price}`)
            .join('\n');
    return `[question]\n${question.trim()}\n[catalog]\n${catalog}\n`;
  }
}

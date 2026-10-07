import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sleep } from '../common/utils/sleep.util';
import { AiCompletion, AiEmbedding, AiProvider } from './ai-provider.interface';
import { featureHashEmbedding } from './feature-hash';

const EMBEDDING_MODEL = 'fake-hash-v1';

const CHAT_MODEL = 'fake-chat-v1';

@Injectable()
export class FakeAiProvider implements AiProvider {
  readonly name = 'fake';
  private readonly dimension: number;
  private readonly embedLatencyMs: number;
  private readonly chatLatencyMs: number;

  constructor(config: ConfigService) {
    this.dimension = config.getOrThrow<number>('ai.embeddingDim');
    this.embedLatencyMs = config.getOrThrow<number>('ai.fakeLatencyMs');
    this.chatLatencyMs = config.getOrThrow<number>('ai.fakeChatLatencyMs');
  }

  /** 글을 해시해 384칸 좌표로 만든다. API 비용은 0이다. */
  async embed(text: string): Promise<AiEmbedding> {
    await this.pause(this.embedLatencyMs);

    return {
      vector: featureHashEmbedding(text, this.dimension),
      model: EMBEDDING_MODEL,
      usageTokens: estimateTokens(text),
    };
  }

  /** 프롬프트의 첫 태그로 어떤 쇼핑인지 한 문장을 만든다. */
  async complete(prompt: string): Promise<AiCompletion> {
    await this.pause(this.chatLatencyMs);
    const retrieved = prompt.split('[retrieved]')[1] ?? '';
    const kind = retrieved.match(/^- ([^|\n]+)/m)?.[1]?.trim();

    const text = kind
      ? `${kind} 종류를 고르는 쇼핑입니다. 같은 쓰임새를 이어서 보면 됩니다.`
      : '검색된 상품이 없어 어떤 쇼핑인지 말하지 못했습니다.';

    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(text);

    return {
      text,
      model: CHAT_MODEL,
      promptTokens,
      completionTokens,
      estimatedCostUsd: 0,
    };
  }

  /** 후보 id를 위에서부터 최대 10개 JSON으로 돌려준다. */
  async completeJson(_systemPrompt: string, prompt: string): Promise<AiCompletion> {
    await this.pause(this.chatLatencyMs);
    const block = prompt.split('[candidates]')[1] ?? '';
    const picks: { product_id: string; rank: number; reason: string }[] = [];

    for (const match of block.matchAll(/^- ([^|\n]+) \|/gm)) {
      const productId = match[1]?.trim();

      if (!productId) continue;
      if (picks.length === 10) break;
      picks.push({
        product_id: productId,
        rank: picks.length + 1,
        reason: '취향 좌표와 가까운 후보입니다.',
      });
    }

    const text = JSON.stringify(picks);
    const promptTokens = estimateTokens(prompt);
    const completionTokens = estimateTokens(text);

    return {
      text,
      model: CHAT_MODEL,
      promptTokens,
      completionTokens,
      estimatedCostUsd: 0,
    };
  }

  private async pause(latencyMs: number): Promise<void> {
    if (latencyMs > 0) await sleep(latencyMs);
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2));
}

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

  async embed(text: string): Promise<AiEmbedding> {
    await this.pause(this.embedLatencyMs);
    return {
      vector: featureHashEmbedding(text, this.dimension),
      model: EMBEDDING_MODEL,
      usageTokens: estimateTokens(text),
    };
  }

  async complete(prompt: string): Promise<AiCompletion> {
    await this.pause(this.chatLatencyMs);
    const actions = [
      ...prompt.matchAll(/^- (?:VIEW|CLICK|LIKE|CART|PURCHASE) \| (.+?) \| ([^|]+) \| (.+)$/gm),
    ];
    const lead = actions[0];
    const name = lead?.[1]?.trim();
    const text = name
      ? `지금은 ${name}처럼 고르는 쇼핑입니다. 같은 쓰임새를 이어서 보면 됩니다.`
      : '최근 행동이 없어 어떤 쇼핑인지 말하지 못했습니다.';
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

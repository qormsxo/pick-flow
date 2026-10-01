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
    const names = [...prompt.matchAll(/^- (.+?) \|/gm)].map((match) => match[1]?.trim()).filter(Boolean);
    const question = prompt.match(/\[question\]\s*([\s\S]*?)\n\[catalog\]/)?.[1]?.trim() ?? '';
    const text =
      names.length > 0
        ? `${question} 기준으로 가까운 상품은 ${names.join(', ')}입니다. 먼저 ${names[0]}을 보세요.`
        : `${question}에 가까운 상품이 아직 인덱스에 없습니다. 상품 임베딩이 끝난 뒤 다시 물어보세요.`;
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

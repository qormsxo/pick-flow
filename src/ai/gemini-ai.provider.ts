import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { l2Normalize } from '../common/utils/vector.util';
import { AiCompletion, AiEmbedding, AiProvider } from './ai-provider.interface';

/** Gemini 2.5 Flash 텍스트 목록가 추정치. 청구서 대체가 아니라 캐시 절감액을 보여 주기 위한 값이다. */
const CHAT_INPUT_USD_PER_TOKEN = 0.3 / 1_000_000;
const CHAT_OUTPUT_USD_PER_TOKEN = 2.5 / 1_000_000;

const SYSTEM_PROMPT = [
  '너는 쇼핑몰 사용자의 최근 행동을 보고 어떤 쇼핑인지 말한다.',
  '상품 이름을 다시 나열하지 않는다.',
  '행동에 없는 상품 이름은 만들지 않는다.',
  '두 문장으로 답한다.',
].join(' ');

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly chatModel: string;
  private readonly embeddingModel: string;
  private readonly dimension: number;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('ai.geminiApiKey');
    this.chatModel = config.getOrThrow<string>('ai.chatModel');
    this.embeddingModel = config.getOrThrow<string>('ai.embeddingModel');
    this.dimension = config.getOrThrow<number>('ai.embeddingDim');
  }

  async embed(text: string): Promise<AiEmbedding> {
    const body = await this.post<{
      embedding?: { values?: number[] };
    }>(`${this.embeddingModel}:embedContent`, {
      content: { parts: [{ text }] },
      embedContentConfig: { outputDimensionality: this.dimension },
    });
    const values = body.embedding?.values;
    if (!values || values.length < this.dimension) {
      throw new Error(
        `Gemini embedding dim mismatch: expected at least ${this.dimension}, got ${values?.length ?? 0}`,
      );
    }
    // 3072보다 짧게 자르면 gemini-embedding-001 은 직접 정규화해야 코사인 비교가 맞다.
    const vector = l2Normalize(values.slice(0, this.dimension));
    return {
      vector,
      model: this.embeddingModel,
      usageTokens: estimateTokens(text),
    };
  }

  async complete(prompt: string): Promise<AiCompletion> {
    const body = await this.post<{
      modelVersion?: string;
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    }>(`${this.chatModel}:generateContent`, {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('Gemini chat response was empty');
    const promptTokens = body.usageMetadata?.promptTokenCount ?? estimateTokens(prompt);
    const completionTokens = body.usageMetadata?.candidatesTokenCount ?? estimateTokens(text);
    return {
      text,
      model: body.modelVersion ?? this.chatModel,
      promptTokens,
      completionTokens,
      estimatedCostUsd: Number(
        (promptTokens * CHAT_INPUT_USD_PER_TOKEN + completionTokens * CHAT_OUTPUT_USD_PER_TOKEN).toFixed(8),
      ),
    };
  }

  private async post<T>(action: string, payload: unknown): Promise<T> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${action}`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Gemini ${action} failed: ${response.status} ${detail}`);
      throw new Error(`Gemini ${action} failed with ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2));
}

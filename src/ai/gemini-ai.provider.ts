import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isJsonNumber,
  isJsonObject,
  isJsonString,
  isNumberList,
  JsonObject,
  JsonValue,
  readJson,
} from '../common/utils/json-value';
import { l2Normalize } from '../common/utils/vector.util';
import { AiCompletion, AiEmbedding, AiProvider } from './ai-provider.interface';

/** Gemini 2.5 Flash 텍스트 목록가 추정치. 청구서 대체가 아니라 캐시 절감액을 보여 주기 위한 값이다. */
const CHAT_INPUT_USD_PER_TOKEN = 0.3 / 1_000_000;

const CHAT_OUTPUT_USD_PER_TOKEN = 2.5 / 1_000_000;

const SYSTEM_PROMPT = [
  '너는 취향 태그만 보고 어떤 쇼핑인지 말한다.',
  '상품 목록은 만들지 않는다.',
  '태그 단어를 그대로 쓴다.',
  '자켓을 아우터처럼 다른 말로 바꾸지 않는다.',
  '상품 이름은 말하지 않는다.',
  '목록에 없는 태그는 말하지 않는다.',
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

  /** 글을 384개 좌표로 받고 길이를 맞춘 뒤 단위 벡터로 만든다. */
  async embed(text: string): Promise<AiEmbedding> {
    const body = await this.post(`${this.embeddingModel}:embedContent`, {
      content: { parts: [{ text }] },
      embedContentConfig: { outputDimensionality: this.dimension },
    });

    const values = readEmbeddingValues(body);

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
    return this.generate(SYSTEM_PROMPT, prompt, false);
  }

  async completeJson(systemPrompt: string, prompt: string): Promise<AiCompletion> {
    return this.generate(systemPrompt, prompt, true);
  }

  /** 시스템 지시와 프롬프트를 보낸다. JSON 모드면 배열만 받는다. */
  private async generate(systemPrompt: string, prompt: string, json: boolean): Promise<AiCompletion> {
    const generationConfig: JsonObject = json
      ? { temperature: 0.2, responseMimeType: 'application/json' }
      : { temperature: 0.2 };

    const body = await this.post(`${this.chatModel}:generateContent`, {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const chat = readChat(body);
    const text = chat.text.trim();

    if (!text) throw new Error('Gemini chat response was empty');
    const promptTokens = chat.promptTokens ?? estimateTokens(prompt);
    const completionTokens = chat.completionTokens ?? estimateTokens(text);

    return {
      text,
      model: chat.model ?? this.chatModel,
      promptTokens,
      completionTokens,
      estimatedCostUsd: Number(
        (promptTokens * CHAT_INPUT_USD_PER_TOKEN + completionTokens * CHAT_OUTPUT_USD_PER_TOKEN).toFixed(8),
      ),
    };
  }

  private async post(action: string, payload: JsonObject): Promise<JsonValue> {
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

    const body = readJson(await response.text());

    if (body === undefined) throw new Error(`Gemini ${action} returned invalid JSON`);

    return body;
  }
}

function readEmbeddingValues(body: JsonValue): number[] | null {
  if (!isJsonObject(body)) return null;

  const embedding = body.embedding;

  if (!isJsonObject(embedding)) return null;

  return isNumberList(embedding.values) ? embedding.values : null;
}

interface GeminiChat {
  text: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}

function readChat(body: JsonValue): GeminiChat {
  if (!isJsonObject(body)) return { text: '' };

  const model = isJsonString(body.modelVersion) ? body.modelVersion : undefined;
  const usage = isJsonObject(body.usageMetadata) ? body.usageMetadata : undefined;

  return {
    text: readCandidateText(body.candidates),
    model,
    promptTokens: usage && isJsonNumber(usage.promptTokenCount) ? usage.promptTokenCount : undefined,
    completionTokens: usage && isJsonNumber(usage.candidatesTokenCount) ? usage.candidatesTokenCount : undefined,
  };
}

function readCandidateText(value: JsonValue | undefined): string {
  if (!Array.isArray(value)) return '';

  const first = value[0];

  if (!isJsonObject(first)) return '';

  const content = first.content;

  if (!isJsonObject(content) || !Array.isArray(content.parts)) return '';

  const texts: string[] = [];

  for (const part of content.parts) {
    if (!isJsonObject(part) || !isJsonString(part.text)) continue;
    texts.push(part.text);
  }

  return texts.join('');
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2));
}

function int(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function flag(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/**
 * process.env 는 항상 문자열이다.
 * Joi 가 형식만 검사하고, 여기서 애플리케이션이 쓰는 숫자/중첩 객체로 바꾼다.
 */
export const configuration = () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: int(process.env.PORT, 3000),
    requestTimeoutMs: int(process.env.REQUEST_TIMEOUT_MS, 10_000),
    loadTest: flag(process.env.LOAD_TEST),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  redis: {
    url: process.env.REDIS_URL ?? '',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresInSec: int(process.env.JWT_EXPIRES_SEC, 86_400),
  },
  ai: {
    // 부하 테스트 프로세스는 Gemini로 빠져나가지 않는다.
    provider: flag(process.env.LOAD_TEST) ? 'fake' : (process.env.AI_PROVIDER ?? 'fake'),
    fakeLatencyMs: int(process.env.AI_FAKE_LATENCY_MS, 20),
    fakeChatLatencyMs: int(process.env.AI_FAKE_CHAT_LATENCY_MS, 1_200),
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    chatModel: process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
    embeddingDim: int(process.env.EMBEDDING_DIM, 384),
  },
  semanticCache: {
    threshold: Number(process.env.SEMANTIC_CACHE_THRESHOLD ?? 0.86),
    coalesceThreshold: Number(process.env.SEMANTIC_CACHE_COALESCE_THRESHOLD ?? 0.78),
    ttlSec: int(process.env.SEMANTIC_CACHE_TTL_SEC, 86_400),
    topK: int(process.env.SEMANTIC_CACHE_TOP_K, 1),
  },
});

export type AppConfig = ReturnType<typeof configuration>;

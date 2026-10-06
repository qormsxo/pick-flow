import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_SEC: Joi.number().integer().min(60).default(86_400),
  AI_PROVIDER: Joi.string().valid('fake', 'gemini').default('fake'),
  AI_FAKE_LATENCY_MS: Joi.number().integer().min(0).max(5_000).default(20),
  AI_FAKE_CHAT_LATENCY_MS: Joi.number().integer().min(0).max(15_000).default(1_200),
  GEMINI_API_KEY: Joi.string().allow(''),
  GEMINI_CHAT_MODEL: Joi.string().default('gemini-2.5-flash'),
  GEMINI_EMBEDDING_MODEL: Joi.string().default('gemini-embedding-001'),
  EMBEDDING_DIM: Joi.number().integer().min(32).max(3072).default(384),
  SEMANTIC_CACHE_THRESHOLD: Joi.number().min(0).max(1).default(0.86),
  SEMANTIC_CACHE_COALESCE_THRESHOLD: Joi.number().min(0).max(1).default(0.78),
  SEMANTIC_CACHE_TTL_SEC: Joi.number().integer().min(30).default(86_400),
  SEMANTIC_CACHE_TOP_K: Joi.number().integer().min(1).max(10).default(1),
  REQUEST_TIMEOUT_MS: Joi.number().integer().min(100).default(10_000),
  LOAD_TEST: Joi.boolean().truthy('true', '1').falsy('false', '0', '').default(false),
}).custom((value, helpers) => {
  if (!isEnvRecord(value)) return value;

  if (value.AI_PROVIDER === 'gemini' && value.GEMINI_API_KEY === undefined) {
    return helpers.error('any.required');
  }

  if (value.NODE_ENV === 'production' && value.LOAD_TEST !== false) {
    return helpers.error('any.only');
  }

  return value;
});

interface EnvRecord {
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  NODE_ENV?: string;
  LOAD_TEST?: boolean;
}

function isEnvRecord(value: unknown): value is EnvRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

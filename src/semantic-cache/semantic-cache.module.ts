import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SemanticCacheService } from './semantic-cache.service';
import { SEMANTIC_CACHE_OPTIONS, SemanticCacheOptions } from './semantic-cache.types';

@Module({})
export class SemanticCacheModule {
  /** 임계값/TTL/차원은 환경 설정에서 읽고, 테스트는 options 를 직접 넘긴다. */
  static register(overrides?: Partial<SemanticCacheOptions>): DynamicModule {
    return {
      module: SemanticCacheModule,
      global: true,
      providers: [
        {
          provide: SEMANTIC_CACHE_OPTIONS,
          inject: [ConfigService],
          useFactory: (config: ConfigService): SemanticCacheOptions => ({
            indexName: 'idx:semantic_cache',
            keyPrefix: 'sc:',
            exactPrefix: 'sc:exact:',
            threshold: config.getOrThrow<number>('semanticCache.threshold'),
            coalesceThreshold: config.getOrThrow<number>('semanticCache.coalesceThreshold'),
            ttlSec: config.getOrThrow<number>('semanticCache.ttlSec'),
            topK: config.getOrThrow<number>('semanticCache.topK'),
            dimension: config.getOrThrow<number>('ai.embeddingDim'),
            lockTtlMs: 5_000,
            waitAttempts: 8,
            waitIntervalMs: 40,
            ...overrides,
          }),
        },
        SemanticCacheService,
      ],
      exports: [SemanticCacheService],
    };
  }
}

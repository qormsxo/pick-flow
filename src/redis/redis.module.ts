import { Global, Module } from '@nestjs/common';
import { RedisVectorStore } from './redis-vector.store';
import { RedisService } from './redis.service';
import { VECTOR_STORE } from './vector-store.interface';

@Global()
@Module({
  providers: [
    RedisService,
    RedisVectorStore,
    { provide: VECTOR_STORE, useExisting: RedisVectorStore },
  ],
  exports: [RedisService, RedisVectorStore, VECTOR_STORE],
})
export class RedisInfraModule {}

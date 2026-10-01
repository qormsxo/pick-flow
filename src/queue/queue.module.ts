import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * BullMQ 커넥션은 캐시용 ioredis 와 분리한다.
 * 워커는 BRPOP 같은 blocking 명령을 쓰므로 한 커넥션을 공유하면 캐시 명령이 밀린다.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('redis.url'),
          maxRetriesPerRequest: null,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueRootModule {}

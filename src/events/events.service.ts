import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EVENT_DEDUPE_KEY, EVENT_DEDUPE_TTL_SEC } from '../queue/queue.constants';
import { DedupeStore, RedisService } from '../redis/redis.service';
import { TrackEventDto } from './dto/track-event.dto';
import { EventProducer, EventSink } from './event.producer';

export interface TrackResult {
  accepted: true;
  duplicate: boolean;
  clientEventId: string;
}

@Injectable()
export class EventsService {
  constructor(
    @Inject(RedisService) private readonly redis: DedupeStore,
    @Inject(EventProducer) private readonly producer: EventSink,
  ) {}

  /**
   * 핫패스는 Postgres 를 보지 않는다.
   * Redis 멱등 키를 잡고 큐에 넣은 뒤 202 를 반환한다.
   * 큐 적재가 실패하면 멱등 키를 지워 클라이언트 재시도가 가능하다.
   */
  async track(userId: string, dto: TrackEventDto, idempotencyKey?: string): Promise<TrackResult> {
    const headerId =
      idempotencyKey && /^[A-Za-z0-9_:-]{8,64}$/.test(idempotencyKey) ? idempotencyKey : undefined;

    const clientEventId = dto.clientEventId ?? headerId ?? randomUUID();

    if (dto.metadata && JSON.stringify(dto.metadata).length > 2_000) {
      throw new BadRequestException('metadata is too large');
    }

    const dedupeKey = EVENT_DEDUPE_KEY(clientEventId);
    let fresh = false;

    try {
      fresh = await this.redis.setNx(dedupeKey, userId, EVENT_DEDUPE_TTL_SEC);
    } catch {
      throw new ServiceUnavailableException('Event intake unavailable');
    }

    if (!fresh) return { accepted: true, duplicate: true, clientEventId };

    try {
      await this.producer.enqueue({
        clientEventId,
        userId,
        productId: dto.productId,
        type: dto.type,
        metadata: dto.metadata ?? {},
        occurredAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.redis.del(dedupeKey).catch(() => undefined);
      throw error;
    }

    return { accepted: true, duplicate: false, clientEventId };
  }
}

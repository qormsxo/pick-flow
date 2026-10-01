import { EventType } from '../src/events/event-type.enum';
import { EventProducer } from '../src/events/event.producer';
import { EventsService } from '../src/events/events.service';
import { RedisService } from '../src/redis/redis.service';
import { MemoryRedis } from './support/memory-redis';

describe('EventsService', () => {
  const dto = {
    productId: '11111111-1111-4111-8111-111111111111',
    type: EventType.CLICK,
    clientEventId: 'click-event-01',
  };

  it('drops the dedupe key when enqueue fails so the client can retry', async () => {
    const redis = new MemoryRedis();
    const producer = {
      enqueue: jest.fn().mockRejectedValueOnce(new Error('queue down')).mockResolvedValueOnce(undefined),
    };
    const service = new EventsService(redis as unknown as RedisService, producer as unknown as EventProducer);

    await expect(service.track('user-1', dto)).rejects.toThrow('queue down');
    const retried = await service.track('user-1', dto);

    expect(retried).toEqual({ accepted: true, duplicate: false, clientEventId: dto.clientEventId });
    expect(producer.enqueue).toHaveBeenCalledTimes(2);
  });

  it('acks a duplicate without enqueueing again', async () => {
    const redis = new MemoryRedis();
    const producer = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new EventsService(redis as unknown as RedisService, producer as unknown as EventProducer);

    await service.track('user-1', dto);
    const duplicate = await service.track('user-1', dto);

    expect(duplicate.duplicate).toBe(true);
    expect(producer.enqueue).toHaveBeenCalledTimes(1);
  });
});

import { EventType } from '../src/events/event-type.enum';
import { EventSink } from '../src/events/event.producer';
import { UserEventJob } from '../src/events/event-jobs';
import { EventsService } from '../src/events/events.service';
import { MemoryRedis } from './support/memory-redis';

describe('EventsService', () => {
  const dto = {
    productId: '11111111-1111-4111-8111-111111111111',
    type: EventType.CLICK,
    clientEventId: 'click-event-01',
  };

  it('drops the dedupe key when enqueue fails so the client can retry', async () => {
    const redis = new MemoryRedis();

    const enqueue = jest.fn<Promise<void>, [UserEventJob]>();
    enqueue.mockRejectedValueOnce(new Error('queue down'));
    enqueue.mockResolvedValueOnce(undefined);
    const producer: EventSink = { enqueue };

    const service = new EventsService(redis, producer);

    await expect(service.track('user-1', dto)).rejects.toThrow('queue down');
    const retried = await service.track('user-1', dto);

    expect(retried).toEqual({ accepted: true, duplicate: false, clientEventId: dto.clientEventId });
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('acks a duplicate without enqueueing again', async () => {
    const redis = new MemoryRedis();
    const enqueue = jest.fn<Promise<void>, [UserEventJob]>().mockResolvedValue(undefined);
    const producer: EventSink = { enqueue };
    const service = new EventsService(redis, producer);

    await service.track('user-1', dto);
    const duplicate = await service.track('user-1', dto);

    expect(duplicate.duplicate).toBe(true);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});

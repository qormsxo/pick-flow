import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { ProductIndexService } from '../catalog/product-index.service';
import { ProductsRepository } from '../catalog/products.repository';
import { EVENT_WEIGHT } from './event-type.enum';
import { QUEUE_USER_EVENTS } from '../queue/queue.constants';
import { UserEventJob } from './event-jobs';
import { EventProducer } from './event.producer';
import { PopularityService } from './popularity.service';
import { UserEventsRepository } from './user-events.repository';

@Processor(QUEUE_USER_EVENTS, { concurrency: 8 })
export class UserEventProcessor extends WorkerHost {
  private readonly logger = new Logger(UserEventProcessor.name);

  constructor(
    private readonly events: UserEventsRepository,
    private readonly products: ProductsRepository,
    private readonly producer: EventProducer,
    private readonly popularity: PopularityService,
    private readonly index: ProductIndexService,
  ) {
    super();
  }

  async process(job: Job<UserEventJob>): Promise<void> {
    const existing = await this.events.findByClientEventId(job.data.clientEventId);
    if (existing) return;

    const product = await this.products.findById(job.data.productId);
    if (!product) {
      throw new UnrecoverableError(`Unknown product ${job.data.productId}`);
    }

    await this.events.save({
      userId: job.data.userId,
      productId: job.data.productId,
      type: job.data.type,
      metadata: job.data.metadata,
      clientEventId: job.data.clientEventId,
      createdAt: new Date(job.data.occurredAt),
    });

    await this.popularity.add(product.id, EVENT_WEIGHT[job.data.type], new Date(job.data.occurredAt));
    if (product.embedding?.length) {
      await this.index.upsert({
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        sku: product.sku,
        price: product.price,
        embedding: product.embedding,
      });
    }
    await this.producer.enqueueProfileRefresh(job.data.userId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<UserEventJob> | undefined, error: Error): void {
    this.logger.error(`user-event job ${job?.id ?? '-'} failed: ${error.message}`);
  }
}

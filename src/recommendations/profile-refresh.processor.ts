import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProductsRepository } from '../catalog/products.repository';
import { EVENT_WEIGHT } from '../events/event-type.enum';
import { UserEventsRepository } from '../events/user-events.repository';
import { ProfileRefreshJob } from '../events/event-jobs';
import { HOT_WINDOW_SEC, QUEUE_PROFILE_REFRESH, RECOMMENDATION_KEY_PATTERN, USER_VECTOR_KEY } from '../queue/queue.constants';
import { RedisService } from '../redis/redis.service';
import { PreferencesRepository } from './preferences.repository';
import { buildProfile } from './profile.builder';

const RECENT_EVENT_LIMIT = 50;

@Processor(QUEUE_PROFILE_REFRESH, { concurrency: 4 })
export class ProfileRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(ProfileRefreshProcessor.name);

  constructor(
    private readonly events: UserEventsRepository,
    private readonly products: ProductsRepository,
    private readonly preferences: PreferencesRepository,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<ProfileRefreshJob>): Promise<void> {
    const events = await this.events.findRecentByUser(job.data.userId, RECENT_EVENT_LIMIT);

    if (events.length === 0) return;

    const products = await this.products.findByIds([...new Set(events.map((event) => event.productId))]);
    const byId = new Map(products.map((product) => [product.id, product]));
    const now = Date.now();
    let missingEmbeddings = 0;

    const signals = events.flatMap((event) => {
      const product = byId.get(event.productId);

      if (!product?.embedding?.length) {
        missingEmbeddings += 1;

        return [];
      }

      return [
        {
          embedding: product.embedding,
          weight: EVENT_WEIGHT[event.type],
          ageMs: now - event.createdAt.getTime(),
          category: product.category,
        },
      ];
    });

    if (signals.length === 0) {
      if (missingEmbeddings > 0) {
        throw new Error(`Embeddings not ready for user ${job.data.userId}`);
      }

      return;
    }

    const profile = buildProfile(signals, signals[0].embedding.length);

    if (!profile) return;

    await this.preferences.upsert({
      userId: job.data.userId,
      interestVector: profile.interestVector,
      categoryWeights: profile.categoryWeights,
      eventCount: events.length,
    });
    await this.redis.setJson(USER_VECTOR_KEY(job.data.userId), profile.interestVector, HOT_WINDOW_SEC);
    await this.redis.deleteByPattern(RECOMMENDATION_KEY_PATTERN(job.data.userId));
    this.logger.log(`Refreshed profile user=${job.data.userId} events=${events.length}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ProfileRefreshJob> | undefined, error: Error): void {
    this.logger.error(`profile job ${job?.id ?? '-'} failed: ${error.message}`);
  }
}

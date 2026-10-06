import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { HOT_WINDOW_SEC, POPULARITY_DAY_CAP } from '../queue/queue.constants';
import { popularityDayKey, popularityWindow, rankPopularity } from './popularity';

@Injectable()
export class PopularityService {
  constructor(private readonly redis: RedisService) {}

  async add(productId: string, weight: number, at: Date): Promise<void> {
    const key = popularityDayKey(at);
    await this.redis.zincrby(key, weight, productId);
    await this.redis.expire(key, HOT_WINDOW_SEC);
    const size = await this.redis.zcard(key);

    if (size > POPULARITY_DAY_CAP) {
      await this.redis.zremrangebyrank(key, 0, size - POPULARITY_DAY_CAP - 1);
    }
  }

  async top(limit: number, now = new Date()): Promise<string[]> {
    const days = await Promise.all(
      popularityWindow(now).map(async ({ key, ageDays }) => ({
        ageDays,
        rows: await this.redis.zrangeWithScores(key, 0, -1),
      })),
    );

    return rankPopularity(days, limit);
  }
}

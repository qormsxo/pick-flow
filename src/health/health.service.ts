import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  postgres: boolean;
  redis: boolean;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthReport> {
    const [postgres, redis] = await Promise.all([this.pingPostgres(), this.redis.ping().catch(() => false)]);
    return {
      status: postgres && redis ? 'ok' : 'degraded',
      postgres,
      redis,
    };
  }

  private async pingPostgres(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

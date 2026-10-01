import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  postgres: boolean;
  redis: boolean;
  aiProvider: string;
  loadTest: boolean;
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<HealthReport> {
    const [postgres, redis] = await Promise.all([this.pingPostgres(), this.redis.ping().catch(() => false)]);
    return {
      status: postgres && redis ? 'ok' : 'degraded',
      postgres,
      redis,
      aiProvider: this.config.get<string>('ai.provider') ?? 'fake',
      loadTest: this.config.get<boolean>('app.loadTest') === true,
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

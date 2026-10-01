import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Postgres / Redis 연결 상태. 하나라도 실패하면 503' })
  async check() {
    const report = await this.health.check();
    if (report.status !== 'ok') {
      throw new ServiceUnavailableException({
        message: 'Dependency unavailable',
        postgres: report.postgres,
        redis: report.redis,
      });
    }
    return report;
  }
}

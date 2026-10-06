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
  @ApiOperation({ summary: '데이터베이스와 Redis가 연결되어 있는지. 하나라도 실패하면 오류' })
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

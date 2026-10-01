import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { TrackEventDto } from './dto/track-event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '클릭/좋아요 등 행동 이벤트를 큐에 넣고 즉시 202 를 반환한다' })
  track(
    @CurrentUser() user: AuthUser,
    @Body() dto: TrackEventDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.events.track(user.userId, dto, idempotencyKey);
  }
}

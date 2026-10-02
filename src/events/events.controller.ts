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
  @ApiOperation({ summary: '조회, 클릭, 좋아요, 장바구니, 구매를 받고 바로 응답한다' })
  track(
    @CurrentUser() user: AuthUser,
    @Body() dto: TrackEventDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.events.track(user.userId, dto, idempotencyKey);
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { AssistantService } from './assistant.service';
import { AskDto } from './dto/ask.dto';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @RateLimit(30, 60)
  @HttpCode(HttpStatus.OK)
  @Post('ask')
  @ApiOperation({ summary: '시맨틱 캐시를 거친 상품 질문. 히트 시 생성 비용은 0' })
  ask(@Body() dto: AskDto) {
    return this.assistant.ask(dto.question);
  }

  @Get('stats')
  @ApiOperation({ summary: '시맨틱 캐시 히트/미스와 절약 토큰' })
  stats() {
    return this.assistant.stats();
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('cache/clear')
  @ApiOperation({ summary: '시맨틱 캐시 인덱스와 exact 키를 비운다' })
  clear() {
    return this.assistant.clearCache().then(() => ({ cleared: true }));
  }
}

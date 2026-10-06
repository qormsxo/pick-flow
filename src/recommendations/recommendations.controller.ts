import { Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { UserRole } from '../users/user-role.enum';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { RecommendationsService } from './recommendations.service';
import { TasteInsightService } from './taste-insight.service';

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendations: RecommendationsService,
    private readonly insight: TasteInsightService,
  ) {}

  @Get()
  @ApiOperation({ summary: '취향 좌표로 후보를 고른 뒤 AI가 순서를 다시 매긴다. 취향이 없으면 인기 상품' })
  list(@CurrentUser() user: AuthUser, @Query() query: RecommendationQueryDto) {
    return this.recommendations.recommend(user.userId, query.limit ?? 10);
  }

  @RateLimit(30, 60)
  @Get('insight')
  @ApiOperation({ summary: '검색된 상품 태그로 어떤 쇼핑인지 알려 준다. 같은 태그면 저장된 답을 쓴다' })
  insightForUser(@CurrentUser() user: AuthUser) {
    return this.recommendations.explain(user.userId);
  }

  @Get('cache/stats')
  @ApiOperation({ summary: '저장된 답을 재사용한 횟수와 아낀 토큰' })
  stats() {
    return this.insight.stats();
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('cache/clear')
  @ApiOperation({ summary: '저장된 쇼핑 해석을 비운다' })
  clear() {
    return this.insight.clearCache().then(() => ({ cleared: true }));
  }
}

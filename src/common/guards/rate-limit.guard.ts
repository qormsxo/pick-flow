import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { RATE_LIMIT_KEY } from '../constants';
import { RateLimitRule } from '../decorators/rate-limit.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get<boolean>('app.loadTest')) return true;

    const rule = this.reflector.get<RateLimitRule | undefined>(RATE_LIMIT_KEY, context.getHandler());
    if (!rule) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const identity = request.user?.userId ?? request.ip ?? 'anonymous';
    const key = `rl:${context.getClass().name}:${context.getHandler().name}:${identity}`;

    try {
      const result = await this.redis.hitRateLimit(key, rule.limit, rule.windowSec);
      if (!result.allowed) {
        throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // 로그인 폭주/LLM 비용 보호는 Redis 장애 시 열어 두지 않는다.
      throw new ServiceUnavailableException('Rate limiter unavailable');
    }
  }
}

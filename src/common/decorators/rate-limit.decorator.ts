import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY } from '../constants';

export interface RateLimitRule {
  limit: number;
  windowSec: number;
}

/** windowSec 동안 limit 회. 인증된 사용자는 userId, 아니면 IP 기준. */
export const RateLimit = (limit: number, windowSec: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSec } satisfies RateLimitRule);

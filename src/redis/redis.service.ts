import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis, { Command } from 'ioredis';
import { JsonValue, readJson } from '../common/utils/json-value';
import { RATE_LIMIT_LUA, UNLOCK_LUA } from './lua';
import { isRedisReply, RedisReply } from './search-reply';

export interface DedupeStore {
  setNx(key: string, value: string, ttlSec: number): Promise<boolean>;
  del(key: string): Promise<void>;
}

export interface JsonStore {
  getJson(key: string): Promise<JsonValue | null>;
  setJson(key: string, value: JsonValue, ttlSec?: number): Promise<void>;
  incr(key: string): Promise<number>;
  incrBy(key: string, amount: number): Promise<number>;
  mget(keys: string[]): Promise<Array<string | null>>;
  deleteByPattern(pattern: string): Promise<number>;
  withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>, onBusy: () => Promise<T>): Promise<T>;
}

@Injectable()
export class RedisService implements OnModuleDestroy, DedupeStore, JsonStore {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('redis.url'), {
      maxRetriesPerRequest: 2,
      connectTimeout: 10_000,
      retryStrategy: (times: number) => (times > 20 ? null : Math.min(times * 200, 2_000)),
    });
    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }

  /**
   * Buffer 인자는 bulk string 으로 그대로 나간다.
   * replyEncoding 은 응답 바이트만 문자열로 바꾼다.
   * ioredis 5 타입은 sendCommand 를 unknown 으로 두지만, 런타임은 Promise 다.
   */
  async command(name: string, args: Array<string | number | Buffer> = []): Promise<RedisReply> {
    const reply = await Promise.resolve(this.client.sendCommand(new Command(name, args, { replyEncoding: 'utf8' })));

    if (!isRedisReply(reply)) {
      throw new Error(`Unexpected Redis reply for ${name}`);
    }

    return reply;
  }

  async getJson(key: string): Promise<JsonValue | null> {
    const raw = await this.client.get(key);

    if (!raw) return null;

    const parsed = readJson(raw);

    if (parsed === undefined) {
      this.logger.warn(`Discarding corrupt cache key ${key}`);

      return null;
    }

    return parsed;
  }

  async setJson(key: string, value: JsonValue, ttlSec?: number): Promise<void> {
    const payload = JSON.stringify(value);

    if (ttlSec && ttlSec > 0) {
      await this.client.set(key, payload, 'EX', ttlSec);

      return;
    }

    await this.client.set(key, payload);
  }

  async setNx(key: string, value: string, ttlSec: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSec, 'NX');

    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  async mget(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];

    return this.client.mget(...keys);
  }

  async zincrby(key: string, increment: number, member: string): Promise<void> {
    await this.client.zincrby(key, increment, member);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrevrange(key, start, stop);
  }

  async zrangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<Array<{ member: string; score: number }>> {
    const raw = await this.client.zrange(key, start, stop, 'WITHSCORES');
    const rows: Array<{ member: string; score: number }> = [];

    for (let index = 0; index < raw.length; index += 2) {
      rows.push({ member: raw[index] ?? '', score: Number(raw[index + 1] ?? 0) });
    }

    return rows;
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<void> {
    await this.client.zremrangebyrank(key, start, stop);
  }

  async expire(key: string, ttlSec: number): Promise<void> {
    await this.client.expire(key, ttlSec);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let removed = 0;

    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;

      if (keys.length > 0) removed += await this.client.del(...keys);
    } while (cursor !== '0');

    return removed;
  }

  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>, onBusy: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const acquired = await this.client.set(key, token, 'PX', ttlMs, 'NX');

    if (acquired !== 'OK') return onBusy();

    try {
      return await fn();
    } finally {
      await this.client.eval(UNLOCK_LUA, 1, key, token);
    }
  }

  async hitRateLimit(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<{ allowed: boolean; count: number }> {
    const now = Date.now();

    const reply = await this.client.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      String(now),
      String(windowSec * 1000),
      String(limit),
      `${now}:${randomUUID()}`,
      String(windowSec),
    );

    if (!isRedisReply(reply) || !Array.isArray(reply)) {
      return { allowed: false, count: 0 };
    }

    const allowed = Number(reply[0] ?? 0) === 1;
    const count = Number(reply[1] ?? 0);

    return { allowed, count };
  }
}

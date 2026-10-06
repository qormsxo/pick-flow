import { JsonValue, readJson } from '../../src/common/utils/json-value';
import { DedupeStore, JsonStore } from '../../src/redis/redis.service';

export class MemoryRedis implements DedupeStore, JsonStore {
  private readonly values = new Map<string, string>();
  private readonly locks = new Set<string>();
  readonly counters = new Map<string, number>();

  async getJson(key: string): Promise<JsonValue | null> {
    const raw = this.values.get(key);

    if (!raw) return null;

    const parsed = readJson(raw);

    return parsed === undefined ? null : parsed;
  }

  async setJson(key: string, value: JsonValue): Promise<void> {
    this.values.set(key, JSON.stringify(value));
  }

  async setNx(key: string, value: string, _ttlSec?: number): Promise<boolean> {
    if (this.values.has(key)) return false;
    this.values.set(key, value);

    return true;
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
  }

  async incr(key: string): Promise<number> {
    return this.incrBy(key, 1);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + amount;
    this.counters.set(key, next);

    return next;
  }

  async mget(keys: string[]): Promise<Array<string | null>> {
    return keys.map((key) => {
      const counter = this.counters.get(key);

      if (counter !== undefined) return String(counter);

      return this.values.get(key) ?? null;
    });
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    const keys = Array.from(this.values.keys());
    let removed = 0;

    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      this.values.delete(key);
      removed += 1;
    }

    return removed;
  }

  async withLock<T>(key: string, _ttlMs: number, fn: () => Promise<T>, onBusy: () => Promise<T>): Promise<T> {
    if (this.locks.has(key)) return onBusy();
    this.locks.add(key);

    try {
      return await fn();
    } finally {
      this.locks.delete(key);
    }
  }
}

export class MemoryRedis {
  private readonly values = new Map<string, string>();
  private readonly locks = new Set<string>();
  readonly counters = new Map<string, number>();

  async getJson<T>(key: string): Promise<T | null> {
    const raw = this.values.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setJson(key: string, value: unknown): Promise<void> {
    this.values.set(key, JSON.stringify(value));
  }

  async setNx(key: string, value: string): Promise<boolean> {
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

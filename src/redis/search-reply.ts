import { VectorHit } from './vector-store.interface';

export type RedisReply = string | number | null | RedisReply[];

export function isRedisReply(value: unknown): value is RedisReply {
  if (value === null || typeof value === 'string' || typeof value === 'number') return true;

  if (!Array.isArray(value)) return false;

  return value.every(isRedisReply);
}

/**
 * FT.SEARCH (DIALECT 2, RESP2) 응답:
 * [total, key, [field, value, ...], key, [field, value, ...], ...]
 */
export function parseSearchReply(reply: RedisReply, prefix: string): VectorHit[] {
  if (!Array.isArray(reply) || reply.length <= 1) return [];

  const hits: VectorHit[] = [];

  for (let index = 1; index < reply.length; index += 2) {
    const redisKey = String(reply[index]);
    const fieldReply = reply[index + 1];
    const rawFields = Array.isArray(fieldReply) ? fieldReply : [];
    const fields: Record<string, string> = {};

    for (let fieldIndex = 0; fieldIndex < rawFields.length; fieldIndex += 2) {
      const name = String(rawFields[fieldIndex]);
      const value = rawFields[fieldIndex + 1];
      fields[name] = value == null ? '' : String(value);
    }

    const distance = Number(fields.dist ?? '1');
    const similarity = clamp(1 - distance, -1, 1);
    hits.push({
      id: redisKey.startsWith(prefix) ? redisKey.slice(prefix.length) : redisKey,
      similarity,
      distance,
      fields,
    });
  }

  return hits;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;

  return Math.min(max, Math.max(min, value));
}

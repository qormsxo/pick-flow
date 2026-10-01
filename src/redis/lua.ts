/** 락 토큰이 일치할 때만 삭제한다. 만료 후 다른 요청이 딴 락을 지우지 않게 한다. */
export const UNLOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

/**
 * 슬라이딩 윈도우 로그.
 * 윈도우 밖 점수를 지운 뒤, 한도에 도달했으면 추가하지 않는다.
 * 반환: { allowed(0|1), count }
 */
export const RATE_LIMIT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local ttlSec = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = redis.call('ZCARD', key)
if count >= limit then
  return {0, count}
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttlSec)
return {1, count + 1}
`;

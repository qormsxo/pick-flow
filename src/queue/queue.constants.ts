export const QUEUE_USER_EVENTS = 'user-events';
export const QUEUE_PROFILE_REFRESH = 'profile-refresh';
export const QUEUE_PRODUCT_EMBEDDING = 'product-embedding';

/** 같은 유저의 이벤트를 이 윈도우 안에서 프로필 갱신 1회로 모은다. */
export const PROFILE_WINDOW_MS = 5_000;

export const POPULARITY_KEY = 'pop:products';
export const USER_VECTOR_KEY = (userId: string) => `user:vec:${userId}`;
export const RECOMMENDATION_KEY_PATTERN = (userId: string) => `rec:${userId}:*`;
export const EVENT_DEDUPE_KEY = (clientEventId: string) => `evt:${clientEventId}`;
export const EVENT_DEDUPE_TTL_SEC = 60 * 60 * 24;

export const QUEUE_USER_EVENTS = 'user-events';
export const QUEUE_PROFILE_REFRESH = 'profile-refresh';
export const QUEUE_PRODUCT_EMBEDDING = 'product-embedding';

/** 같은 유저의 이벤트를 이 윈도우 안에서 프로필 갱신 1회로 모은다. */
export const PROFILE_WINDOW_MS = 5_000;

/** 취향 감쇠와 같이 14일이다. 이 창 밖의 인기와 상품 좌표는 Redis에서 빠진다. */
export const HOT_WINDOW_DAYS = 14;
export const HOT_WINDOW_SEC = HOT_WINDOW_DAYS * 24 * 60 * 60;

/** 하루 인기 목록에 남기는 상품 수. 점수가 낮은 상품부터 잘린다. */
export const POPULARITY_DAY_CAP = 10_000;
export const USER_VECTOR_KEY = (userId: string) => `user:vec:${userId}`;
export const RECOMMENDATION_KEY_PATTERN = (userId: string) => `rec:${userId}:*`;
export const EVENT_DEDUPE_KEY = (clientEventId: string) => `evt:${clientEventId}`;
export const EVENT_DEDUPE_TTL_SEC = 60 * 60 * 24;

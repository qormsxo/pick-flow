export enum EventType {
  VIEW = 'VIEW',
  CLICK = 'CLICK',
  LIKE = 'LIKE',
  CART = 'CART',
  PURCHASE = 'PURCHASE',
}

/** 프로필 벡터에 곱하는 행동 강도. 구매가 조회보다 훨씬 크게 반영된다. */
export const EVENT_WEIGHT: Record<EventType, number> = {
  [EventType.VIEW]: 0.2,
  [EventType.CLICK]: 0.6,
  [EventType.LIKE]: 1,
  [EventType.CART]: 1.3,
  [EventType.PURCHASE]: 1.8,
};

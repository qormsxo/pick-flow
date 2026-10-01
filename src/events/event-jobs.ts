import { EventType } from './event-type.enum';

export interface UserEventJob {
  clientEventId: string;
  userId: string;
  productId: string;
  type: EventType;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface ProfileRefreshJob {
  userId: string;
}

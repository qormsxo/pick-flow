export interface ApiEnvelope<T> {
  success: true;
  data: T;
  requestId: string;
  timestamp: string;
}

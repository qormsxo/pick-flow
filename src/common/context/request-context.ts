import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  requestId: string;
  startedAt: number;
}

/**
 * 요청 스코프 값을 파라미터로 넘기지 않고 로그/응답 봉투에서 읽기 위한 저장소.
 * Node 가 async 경계를 넘어 store 를 유지한다.
 */
export class RequestContext {
  private static readonly storage = new AsyncLocalStorage<RequestStore>();

  static run<T>(store: RequestStore, fn: () => T): T {
    return this.storage.run(store, fn);
  }

  static current(): RequestStore | undefined {
    return this.storage.getStore();
  }
}

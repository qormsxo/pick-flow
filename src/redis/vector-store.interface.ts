export interface VectorIndexSpec {
  name: string;
  prefix: string;
  dimension: number;
  /** 검색 대상은 아니고 조회 시 같이 돌려받을 필드. RediSearch TEXT NOINDEX. */
  storedTextFields: string[];
  tagFields: string[];
  numericFields: string[];
}

export interface VectorDocument {
  id: string;
  embedding: number[];
  fields: Record<string, string>;
}

export interface VectorHit {
  id: string;
  /** 코사인 유사도. Redis COSINE distance 를 1 - distance 로 바꾼 값. */
  similarity: number;
  distance: number;
  fields: Record<string, string>;
}

export interface VectorStore {
  ensureIndex(spec: VectorIndexSpec): Promise<void>;
  upsert(spec: VectorIndexSpec, doc: VectorDocument, ttlSec?: number): Promise<void>;
  search(spec: VectorIndexSpec, embedding: number[], k: number): Promise<VectorHit[]>;
  dropIndex(spec: VectorIndexSpec): Promise<void>;
}

export const VECTOR_STORE = Symbol('VECTOR_STORE');

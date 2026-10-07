import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HOT_WINDOW_SEC } from '../queue/queue.constants';
import { RedisVectorStore } from '../redis/redis-vector.store';
import { VectorIndexSpec } from '../redis/vector-store.interface';

export interface IndexedProduct {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  description: string;
  similarity: number;
}

export interface IndexableProduct {
  id: string;
  name: string;
  category: string;
  sku: string;
  price: string;
  description: string;
  embedding: number[];
}

@Injectable()
export class ProductIndexService implements OnModuleInit {
  private readonly spec: VectorIndexSpec;

  constructor(
    config: ConfigService,
    private readonly vectors: RedisVectorStore,
  ) {
    this.spec = {
      name: 'idx:products',
      prefix: 'prod:',
      dimension: config.getOrThrow<number>('ai.embeddingDim'),
      storedTextFields: ['name', 'description'],
      tagFields: ['category', 'sku'],
      numericFields: ['price'],
    };
  }

  async onModuleInit(): Promise<void> {
    await this.vectors.ensureIndex(this.spec);
  }

  /** 상품 좌표를 14일 TTL로 Redis 검색 인덱스에 넣는다. 다시 넣으면 기간이 연장된다. */
  async upsert(product: IndexableProduct): Promise<void> {
    await this.vectors.upsert(this.spec, {
      id: product.id,
      embedding: product.embedding,
      fields: {
        name: product.name,
        description: product.description.slice(0, 500),
        category: sanitizeTag(product.category),
        sku: sanitizeTag(product.sku),
        price: String(Number(product.price)),
      },
    }, HOT_WINDOW_SEC);
  }

  /** 좌표와 코사인이 가까운 상품 k개를 가져온다. */
  async search(embedding: number[], k: number): Promise<IndexedProduct[]> {
    const hits = await this.vectors.search(this.spec, embedding, k);

    return hits.map((hit) => ({
      id: hit.id,
      name: hit.fields.name ?? '',
      category: hit.fields.category ?? '',
      sku: hit.fields.sku ?? '',
      price: Number(hit.fields.price ?? 0),
      description: hit.fields.description ?? '',
      similarity: hit.similarity,
    }));
  }
}

/** TAG 필드는 쉼표와 공백이 구분자라 제거한다. */
function sanitizeTag(value: string): string {
  return value.replace(/[, ]+/g, '-').slice(0, 64);
}

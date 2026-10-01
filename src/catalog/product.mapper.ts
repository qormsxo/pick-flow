import { ProductEntity } from './product.entity';

export interface ProductView {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  tags: string[];
  embeddingReady: boolean;
  createdAt: string;
}

/** 임베딩 원본은 응답에 넣지 않는다. 벡터는 서빙 인덱스에만 둔다. */
export function toProductView(entity: ProductEntity): ProductView {
  return {
    id: entity.id,
    sku: entity.sku,
    name: entity.name,
    description: entity.description,
    category: entity.category,
    price: Number(entity.price),
    tags: entity.tags ?? [],
    embeddingReady: entity.embeddingReady,
    createdAt: entity.createdAt.toISOString(),
  };
}

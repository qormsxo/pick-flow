import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PageResult } from '../common/interfaces/page';
import { isDuplicateJobError } from '../common/utils/duplicate-job';
import { isUniqueViolation } from '../database/is-unique-violation';
import { QUEUE_PRODUCT_EMBEDDING } from '../queue/queue.constants';
import { ProductEmbeddingJob } from './product-embedding.job';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductView, toProductView } from './product.mapper';
import { ProductsRepository } from './products.repository';

@Injectable()
export class CatalogService {
  constructor(
    private readonly products: ProductsRepository,
    @InjectQueue(QUEUE_PRODUCT_EMBEDDING) private readonly embeddings: Queue<ProductEmbeddingJob>,
  ) {}

  /** 상품 글은 바로 저장하고 좌표는 큐에 맡긴다. */
  async create(dto: CreateProductDto): Promise<ProductView> {
    try {
      const saved = await this.products.save({
        sku: dto.sku.trim(),
        name: dto.name.trim(),
        description: dto.description.trim(),
        category: dto.category.trim(),
        price: dto.price.toFixed(2),
        tags: dto.tags.map((tag) => tag.trim()).filter(Boolean),
        embedding: null,
        embeddingReady: false,
      });

      await this.enqueueEmbedding(saved.id);

      return toProductView(saved);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('SKU already exists');
      throw error;
    }
  }

  async list(page = 1, limit = 20, category?: string): Promise<PageResult<ProductView>> {
    const result = await this.products.paginate(page, limit, category);

    return {
      items: result.items.map(toProductView),
      page,
      limit,
      total: result.total,
    };
  }

  async getById(id: string): Promise<ProductView> {
    const product = await this.products.findById(id);

    if (!product) throw new NotFoundException('Product not found');

    return toProductView(product);
  }

  /** 공급자나 차원을 바꾼 뒤 서빙 인덱스를 다시 채울 때 쓴다. */
  async reindexAll(): Promise<number> {
    const products = await this.products.findAll();

    for (const product of products) {
      await this.enqueueEmbedding(product.id, true);
    }

    return products.length;
  }

  /** 같은 상품의 좌표 작업은 jobId 가 같아 한 번만 돈다. force 면 기존 작업을 지우고 다시 넣는다. */
  private async enqueueEmbedding(productId: string, force = false): Promise<void> {
    const jobId = `embed-${productId}`;

    if (force) {
      const existing = await this.embeddings.getJob(jobId);

      if (existing) {
        try {
          await existing.remove();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (/locked/i.test(message)) return;
          throw error;
        }
      }
    }

    try {
      await this.embeddings.add(
        'embed',
        { productId },
        {
          jobId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      if (error instanceof Error && isDuplicateJobError(error)) return;
      throw error;
    }
  }
}

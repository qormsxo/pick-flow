import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiProvider } from '../ai/ai-provider.interface';
import { AI_PROVIDER } from '../ai/ai.constants';
import { QUEUE_PRODUCT_EMBEDDING } from '../queue/queue.constants';
import { ProductEmbeddingJob } from './product-embedding.job';
import { ProductIndexService } from './product-index.service';
import { ProductsRepository } from './products.repository';

@Processor(QUEUE_PRODUCT_EMBEDDING, { concurrency: 4 })
export class ProductEmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProductEmbeddingProcessor.name);

  constructor(
    private readonly products: ProductsRepository,
    private readonly index: ProductIndexService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {
    super();
  }

  /** 이름 설명 카테고리 태그를 한 줄로 붙여 좌표를 만들고 Postgres와 Redis에 넣는다. */
  async process(job: Job<ProductEmbeddingJob>): Promise<void> {
    const product = await this.products.findById(job.data.productId);

    if (!product) {
      this.logger.warn(`Skip embedding, product missing: ${job.data.productId}`);

      return;
    }

    const text = [product.name, product.description, product.category, ...(product.tags ?? [])].join('. ');
    const embedded = await this.ai.embed(text);
    await this.products.updateEmbedding(product.id, embedded.vector);
    await this.index.upsert({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      sku: product.sku,
      price: product.price,
      embedding: embedded.vector,
    });
    this.logger.log(`Indexed product ${product.sku} with ${embedded.model}`);
  }
}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_PRODUCT_EMBEDDING } from '../queue/queue.constants';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductEmbeddingProcessor } from './product-embedding.processor';
import { ProductIndexService } from './product-index.service';
import { ProductEntity } from './product.entity';
import { ProductsRepository } from './products.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity]),
    BullModule.registerQueue({ name: QUEUE_PRODUCT_EMBEDDING }),
  ],
  controllers: [CatalogController],
  providers: [ProductsRepository, ProductIndexService, CatalogService, ProductEmbeddingProcessor],
  exports: [ProductsRepository, ProductIndexService, CatalogService],
})
export class CatalogModule {}

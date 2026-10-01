import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../database/base.repository';
import { ProductEntity } from './product.entity';

@Injectable()
export class ProductsRepository extends BaseRepository<ProductEntity> {
  constructor(@InjectRepository(ProductEntity) repository: Repository<ProductEntity>) {
    super(repository);
  }

  findBySku(sku: string): Promise<ProductEntity | null> {
    return this.repository.findOne({ where: { sku } });
  }

  findByIds(ids: string[]): Promise<ProductEntity[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repository.find({ where: { id: In(ids) } });
  }

  findAll(): Promise<ProductEntity[]> {
    return this.repository.find({ order: { createdAt: 'ASC' } });
  }

  async paginate(
    page: number,
    limit: number,
    category?: string,
  ): Promise<{ items: ProductEntity[]; total: number }> {
    const [items, total] = await this.repository.findAndCount({
      where: category ? { category } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    await this.repository.update(id, { embedding, embeddingReady: true });
  }
}

import { DeepPartial, FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';

export abstract class BaseRepository<T extends ObjectLiteral & { id: string }> {
  protected constructor(protected readonly repository: Repository<T>) {}

  findById(id: string): Promise<T | null> {
    // SAFETY: T extends { id: string }, and this helper only filters on that primary key.
    return this.repository.findOne({ where: { id } as FindOptionsWhere<T> });
  }

  async save(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);

    return this.repository.save(entity);
  }
}

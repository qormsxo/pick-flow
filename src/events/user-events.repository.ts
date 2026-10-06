import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../database/base.repository';
import { EventType } from './event-type.enum';
import { UserEventEntity } from './user-event.entity';

@Injectable()
export class UserEventsRepository extends BaseRepository<UserEventEntity> {
  constructor(@InjectRepository(UserEventEntity) repository: Repository<UserEventEntity>) {
    super(repository);
  }

  findByClientEventId(clientEventId: string): Promise<UserEventEntity | null> {
    return this.repository.findOne({ where: { clientEventId } });
  }

  async findProductIds(userId: string, type: EventType): Promise<string[]> {
    const rows = await this.repository.find({
      select: { productId: true },
      where: { userId, type },
    });
    const ids: string[] = [];

    for (const row of rows) {
      if (!ids.includes(row.productId)) ids.push(row.productId);
    }

    return ids;
  }

  findRecentByUser(userId: string, limit: number): Promise<UserEventEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

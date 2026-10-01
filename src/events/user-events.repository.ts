import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../database/base.repository';
import { UserEventEntity } from './user-event.entity';

@Injectable()
export class UserEventsRepository extends BaseRepository<UserEventEntity> {
  constructor(@InjectRepository(UserEventEntity) repository: Repository<UserEventEntity>) {
    super(repository);
  }

  findByClientEventId(clientEventId: string): Promise<UserEventEntity | null> {
    return this.repository.findOne({ where: { clientEventId } });
  }

  findRecentByUser(userId: string, limit: number): Promise<UserEventEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

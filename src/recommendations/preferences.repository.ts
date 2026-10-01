import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreferenceEntity } from './preference.entity';

@Injectable()
export class PreferencesRepository {
  constructor(@InjectRepository(PreferenceEntity) private readonly repository: Repository<PreferenceEntity>) {}

  findByUserId(userId: string): Promise<PreferenceEntity | null> {
    return this.repository.findOne({ where: { userId } });
  }

  async upsert(input: {
    userId: string;
    interestVector: number[];
    categoryWeights: Record<string, number>;
    eventCount: number;
  }): Promise<void> {
    await this.repository.save(this.repository.create(input));
  }
}

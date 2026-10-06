import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { JsonObject } from '../common/utils/json-value';
import { EventType } from './event-type.enum';

@Entity('user_events')
@Index('idx_user_events_user_created', ['userId', 'createdAt'])
export class UserEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  productId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: EventType;

  @Column({ type: 'jsonb', default: {} })
  metadata!: JsonObject;

  @Column({ type: 'varchar', length: 64, unique: true })
  clientEventId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('user_preferences')
export class PreferenceEntity {
  @PrimaryColumn('uuid')
  userId!: string;

  @Column({ type: 'double precision', array: true })
  interestVector!: number[];

  @Column({ type: 'jsonb', default: {} })
  categoryWeights!: Record<string, number>;

  @Column({ type: 'int', default: 0 })
  eventCount!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

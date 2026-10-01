import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  category!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  tags!: string[];

  @Column({ type: 'double precision', array: true, nullable: true })
  embedding!: number[] | null;

  @Column({ type: 'boolean', default: false })
  embeddingReady!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

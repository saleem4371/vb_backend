import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('category')
export class Category {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  video?: string;

  // JSON field
  @Column({ type: 'json', nullable: true })
  stat?: {
    entity?: string;
    views?: number;
    bookings?: number;
    rating?: number;
    [key: string]: any;
  };

  @Column({ type: 'tinyint', default: 1 })
  status?: number;

  @CreateDateColumn({
    type: 'timestamp',
    name: 'created_at',
  })
  created_at?: Date;
}
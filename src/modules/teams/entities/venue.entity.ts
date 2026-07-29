import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('venue_child')
export class Venue {
  @PrimaryColumn({ name: 'child_venue_id' })
  id?: number;

  @Column({ name: 'child_venue_name', type: 'text', nullable: true })
  name?: string | null;
}
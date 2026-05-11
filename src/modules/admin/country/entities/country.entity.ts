import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("countries")
export class Country {

  @PrimaryGeneratedColumn()
  id?: string;

  @Column()
  name?: string;

  @Column({ unique: true })
  iso_code?: string;

  @Column()
  phone_code?: string;

  @Column()
  currency_code?: string;

  @Column({ default: true })
  status?: boolean;

  

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}
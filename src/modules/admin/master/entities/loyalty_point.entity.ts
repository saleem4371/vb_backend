import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("loyalty_point")
export class LoyaltyPoint {

  @PrimaryGeneratedColumn()
  id?: number;

  /*
  |--------------------------------------------------------------------------
  | COUNTRY
  |--------------------------------------------------------------------------
  */

  @Column({
    type: "int",
  })
  country_id?: number;

  /*
  |--------------------------------------------------------------------------
  | CATEGORY
  |--------------------------------------------------------------------------
  */

  @Column({
    type: "int",
  })
  category_id?: number;

  /*
  |--------------------------------------------------------------------------
  | ₹1 = ? POINTS
  |--------------------------------------------------------------------------
  */

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 1,
  })
  point_value?: number;

  /*
  |--------------------------------------------------------------------------
  | MAX WALLET POINTS
  |--------------------------------------------------------------------------
  */

  @Column({
    type: "int",
    default: 10000,
  })
  max_point?: number;

  /*
  |--------------------------------------------------------------------------
  | TIMESTAMPS
  |--------------------------------------------------------------------------
  */

  @CreateDateColumn()
  created_at?: Date;

  @UpdateDateColumn()
  updated_at?: Date;
}
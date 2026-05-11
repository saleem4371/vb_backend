import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from "typeorm";

import { VenueSubCategory } from "./venue-sub-category.entity";

@Entity("category")
export class VenueMainCategory {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: "varchar", length: 255 })
  name?: string;

  // One Main Category → Many Sub Categories
  @OneToMany(
    () => VenueSubCategory,
    (subCategory) => subCategory.mainCategory
  )
  subCategories?: VenueSubCategory[];

  @CreateDateColumn()
  created_at?: Date;
}
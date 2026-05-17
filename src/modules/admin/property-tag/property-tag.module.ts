import { Module } from '@nestjs/common';
import { PropertyTagController } from './property-tag.controller';
import { PropertyTagService } from './property-tag.service';
import { Category } from "./entities/property-tag.entity";

import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  controllers: [PropertyTagController],
  providers: [PropertyTagService],
  imports: [
      TypeOrmModule.forFeature([
        Category,
      ]),
    ],
})
export class PropertyTagModule {}

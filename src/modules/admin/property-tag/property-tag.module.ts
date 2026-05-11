import { Module } from '@nestjs/common';
import { PropertyTagController } from './property-tag.controller';
import { PropertyTagService } from './property-tag.service';

@Module({
  controllers: [PropertyTagController],
  providers: [PropertyTagService]
})
export class PropertyTagModule {}

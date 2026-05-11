import { Module } from '@nestjs/common';
import { GlobalController } from './global.controller';
import { GlobalService } from './global.service';

import { TypeOrmModule } from '@nestjs/typeorm';

import { BookingEventType } from './entities/venue-booking-types.entity';
import { VenueSubCategory } from './entities/venue-sub-category.entity';
import { VenueMainCategory } from './entities/venue-main-category.entity';

@Module({
  controllers: [GlobalController],
  providers: [GlobalService],
  imports: [TypeOrmModule.forFeature([BookingEventType,VenueSubCategory,VenueMainCategory])],
})
export class GlobalModule {}

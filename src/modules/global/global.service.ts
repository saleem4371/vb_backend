import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { BookingEventType } from './entities/venue-booking-types.entity';
import { VenueSubCategory } from './entities/venue-sub-category.entity';
import { VenueMainCategory } from './entities/venue-main-category.entity';

@Injectable()
export class GlobalService {
  constructor(
    @InjectRepository(BookingEventType)
    private readonly eventRepo: Repository<BookingEventType>,

    @InjectRepository(VenueSubCategory)
    private readonly propRepo: Repository<VenueSubCategory>,
    
    @InjectRepository(VenueMainCategory)
    private readonly mainRepo: Repository<VenueMainCategory>,
  ) {}

  async findEvent() {
    const events = await this.eventRepo.find({
      where: {
        status: 0,
      },
      order: {
        id: 'DESC',
      },
    });

    return events;
  }

  async findProperty(query: any) {
    const { category = '' } = query;

    const whereCondition: any = {
      cat_status: 0,
    };

    if (category) {
      whereCondition.category_id = Number(category);
    }

    const events = await this.propRepo.find({
      where: whereCondition,

      relations: ['mainCategory'],

      order: {
        id: 'DESC',
      },
    });

    return {
      success: true,
      data: events,
    };
  }
}

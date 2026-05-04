import { Injectable } from '@nestjs/common';
import { CategoryService } from '../category/category.service';
import { VenueService } from '../venue/venue.service';

@Injectable()
export class HomeService {
  constructor(
    private categoryService: CategoryService,
    private venueService: VenueService,
  ) {}

  async getHomePageData() {
    const [categories, venues] = await Promise.all([
      this.categoryService.getCategories(),
      this.venueService.getPopularVenues(),
    ]);
    return { categories, venues };
  }
}
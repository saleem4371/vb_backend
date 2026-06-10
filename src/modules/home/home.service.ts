import { Injectable } from '@nestjs/common';
import { CategoryService } from '../category/category.service';
import { VenueService } from '../venue/venue.service';
import { DataSource, Repository, Not, IsNull } from 'typeorm';

@Injectable()
export class HomeService {
  constructor(
    private dataSource: DataSource,
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

  async getUserRecentViews(userId: any) {
    const result = await this.dataSource.query(
      `
    SELECT 
        urv.id,
        urv.user_id,
        urv.venue_id,
        urv.viewed_at,

        cv.child_venue_id,
        cv.child_venue_name as name,
        pv.venue_city as location,
        pv.rating as rating,
        pv.reviews as reviews,
        vg.attachment AS image

    FROM user_recent_views urv

    LEFT JOIN venue_child cv
        ON cv.child_venue_id = urv.venue_id

    LEFT JOIN venue_parent pv
        ON pv.parent_venue_id = cv.parent_venue_id

    LEFT JOIN venue_gallery vg
        ON vg.child_venue_id = urv.venue_id
        AND vg.image_type = 1

    WHERE urv.user_id = ?

    ORDER BY urv.viewed_at DESC
    LIMIT 20
    `,
      [userId],
    );

    return result;
  }
async vendor_category(userId: any) {
  const categories = await this.dataSource.query(
    `SELECT propety_category
     FROM venue_parent
     WHERE created_by = ?
       AND propety_category IS NOT NULL
       AND propety_category != ''`,
    [userId]
  );

  return categories.map(item => `${item.propety_category}s`);
}
  
}

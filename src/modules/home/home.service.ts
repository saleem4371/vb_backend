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
// async vendor_category(userId: any , country :any) {
//   const categories = await this.dataSource.query(
//     `SELECT propety_category
//      FROM venue_parent
//      WHERE created_by = ?
//        AND propety_category IS NOT NULL
//        AND propety_category != '' AND venue_country = ? GROUP BY propety_category`,
//     [userId,country]
//   );

//   return categories.map(item => `${item.propety_category}s`);
// }
async vendor_category(userId: number, country: string) {
  const categories = await this.dataSource.query(
    `
    SELECT DISTINCT propety_category
    FROM venue_parent
    WHERE created_by = ?
      AND venue_country = ?
      AND propety_category IS NOT NULL
      AND TRIM(propety_category) <> ''
    `,
    [userId, country],
  );

  return categories.map(({ propety_category }) => {
    return propety_category.endsWith('s')
      ? propety_category
      : `${propety_category}s`;
  });
}

async recommeded_property()
{
   const recommeded  = this.dataSource.query(`SELECT
    cv.child_venue_id,
    cv.child_venue_name as name,
    vp.venue_city as location,
    vp.rating as rating,
    vp.user_ratings_total as reviews,

    COUNT(DISTINCT b.id) AS total_bookings,

    COALESCE(SUM(b.total_amount), 0) AS revenue,

    ROUND(AVG(COALESCE(vp.rating, 5)), 1) AS rating,

    MAX(b.created_at) AS last_booking,

    /* Single cover image */
    (
        SELECT vg.attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = cv.child_venue_id
        ORDER BY vg.id
        LIMIT 1
    ) AS image,

    /* All gallery images */
    (
        SELECT JSON_ARRAYAGG(vg.attachment)
        FROM venue_gallery vg
        WHERE vg.child_venue_id = cv.child_venue_id
    ) AS gallery,

    (
        COUNT(DISTINCT b.id) * 5 +
        (COALESCE(SUM(b.total_amount),0) / 10000) +
        (AVG(COALESCE(vp.rating,5)) * 20) +
        CASE
            WHEN MAX(b.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 20
            WHEN MAX(b.created_at) >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN 10
            ELSE 0
        END
    ) AS recommendation_score

FROM venue_child cv

LEFT JOIN booking_venues bv
       ON bv.child_venue_id = cv.child_venue_id

LEFT JOIN bookings b
       ON b.id = bv.booking_id
      AND b.status IN (0,1)

LEFT JOIN venue_parent vp
       ON vp.parent_venue_id = cv.parent_venue_id

WHERE cv.publish_status = 1

GROUP BY
    cv.child_venue_id,
    cv.child_venue_name

ORDER BY recommendation_score DESC

LIMIT 10`);

return recommeded;
}
  
}

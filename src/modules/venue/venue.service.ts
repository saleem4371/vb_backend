import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';

import { VenueChild } from '../../modules/listing/entities/venue-child.entity';

@Injectable()
export class VenueService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(VenueChild)
    private readonly childRepo: Repository<VenueChild>,
  ) {}

  async getPopularVenues() {
    return this.dataSource.query(`
      SELECT child_venue_name, child_venue_id
      FROM venue_child
      WHERE publish_status = 1
      LIMIT 10
    `);
  }
  //   async getVenuesPageData(query: any, country: any) {
  //     const page = Number(query.page || 1);
  //     const limit = Number(query.limit || 10);
  //     const offset = (page - 1) * limit;

  //     const { shift, category_cards, budget, booking } = query.filters;

  //     const mapBounds = query.mapBounds || {};

  // const {
  //   north = null,
  //   south = null,
  //   east = null,
  //   west = null,
  // } = mapBounds;

  //     /* ======================
  //      FILTERS
  //   ====================== */
  //     const where: string[] = [];
  //     const params: any[] = [];

  //     // SEARCH
  //     if (query.search) {
  //       where.push(`
  //       (
  //         cv.child_venue_name LIKE ?
  //         OR pv.venue_name LIKE ?
  //         OR pv.venue_city LIKE ?
  //       )
  //     `);

  //       const search = `%${query.search}%`;

  //       params.push(search, search, search);
  //     }

  //     // CATEGORY
  //     if (query.type) {
  //       const keyword = query.type?.trim().replace(/s$/, '');
  //       where.push(`pv.propety_category = ?`);
  //       params.push(keyword);
  //     }

  //     // CATEGORY
  //     if (query.category) {
  //       where.push(`cv.venue_category_id = ?`);
  //       params.push(query.category);
  //     }

  //     // SUBCATEGORY
  //     if (query.subcategory) {
  //       where.push(`cv.venue_category_id = ?`);
  //       params.push(query.subcategory);
  //     }

  //     // COUNTRY
  //     if (country) {
  //       where.push(`pv.venue_country = ?`);
  //       params.push(country);
  //     }

  //     // STATE
  //     if (query.state) {
  //       where.push(`pv.venue_state = ?`);
  //       params.push(query.state);
  //     }

  //     // CITY
  //     if (query.city) {
  //       where.push(`pv.venue_city = ?`);
  //       params.push(query.city);
  //     }

  //     // AMENITIES
  //     if (category_cards?.length) {
  //       const amenities = Array.isArray(category_cards)
  //         ? category_cards
  //         : category_cards.split(',');

  //       where.push(`
  //       EXISTS (
  //         SELECT 1
  //         FROM venue_child_amenities vca
  //         WHERE vca.child_venue_id = cv.child_venue_id
  //         AND vca.amenities_id IN (${amenities.map(() => '?').join(',')})
  //       )
  //     `);

  //       params.push(...amenities);
  //     }

  //     // PRICE FILTER
  //     if (budget.min) {
  //       where.push(`
  //       EXISTS (
  //         SELECT 1
  //         FROM venue_shift_timing vst
  //         WHERE vst.child_venue_id = cv.child_venue_id
  //         AND vst.price >= ?
  //       )
  //     `);

  //       params.push(Number(budget.min));
  //     }

  //     if (budget.max) {
  //       where.push(`
  //       EXISTS (
  //         SELECT 1
  //         FROM venue_shift_timing vst
  //         WHERE vst.child_venue_id = cv.child_venue_id
  //         AND vst.price <= ?
  //       )
  //     `);

  //       params.push(Number(budget.max));
  //     }

  //     if (query.mapBounds) {
  //       where.push(`
  //     pv.lat BETWEEN ? AND ?
  //     AND pv.lng BETWEEN ? AND ?
  //   `);

  //       params.push(south, north, west, east);
  //     }

  //     // SHIFT FILTER
  //     if (shift?.length) {
  //       const shiftValues = Array.isArray(shift) ? shift : shift.split(',');

  //       where.push(`
  //     EXISTS (
  //       SELECT 1
  //       FROM venue_shift_timing vst
  //       WHERE vst.child_venue_id = cv.child_venue_id
  //       AND vst.shift_type IN (${shiftValues.map(() => '?').join(',')})
  //     )
  //   `);

  //       params.push(...shiftValues);
  //     }

  //     const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  //     /* ======================
  //      MAIN RAW QUERY
  //   ====================== */

  //     const sql = `
  //     SELECT
  //       cv.child_venue_id AS childVenueId,
  //       cv.child_venue_name AS venueName,
  //       cv.venue_category_id AS subcategory,
  //       cv.min_guest,
  //       cv.guest_rooms AS maxGuest,
  //       cv.venue_mode,

  //       pv.parent_venue_id AS parentVenueId,
  //       pv.venue_name AS parentVenueName,
  //       pv.venue_city AS city,
  //       pv.venue_state AS state,
  //       pv.venue_country AS country,
  //       pv.venue_address AS address,
  //       pv.lat,
  //       pv.lng,
  //       pv.rating,
  //       pv.reviews,
  //       pv.propety_category AS category,

  //       /* COVER IMAGE */
  //       (
  //         SELECT vg.attachment
  //         FROM venue_gallery vg
  //         WHERE vg.child_venue_id = cv.child_venue_id
  //         AND vg.image_type = 1
  //         LIMIT 1
  //       ) AS coverImage,

  //       /* BANNER IMAGE */
  //       (
  //         SELECT vg.attachment
  //         FROM venue_gallery vg
  //         WHERE vg.child_venue_id = cv.child_venue_id
  //         AND vg.image_type = 2
  //         LIMIT 1
  //       ) AS bannerImage,

  //       /* GALLERY */
  //       (
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'id', vg.id,
  //             'image', vg.attachment
  //           )
  //         )
  //         FROM venue_gallery vg
  //         WHERE vg.child_venue_id = cv.child_venue_id
  //         AND vg.image_type = 3
  //       ) AS galleryImages,

  //       /* AMENITIES */
  //       (
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'id', vca.id,
  //             'amenityId', vca.amenities_id
  //           )
  //         )
  //         FROM venue_child_amenities vca
  //         WHERE vca.child_venue_id = cv.child_venue_id
  //       ) AS amenities,

  //       /* SHIFT TIMINGS */
  //       (
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'id', vst.id,
  //             'price', vst.price,
  //             'shiftType', vst.shift_type,
  //             'fromTime', vst.from_time,
  //             'toTime', vst.to_time
  //           )
  //         )
  //         FROM venue_shift_timing vst
  //         WHERE vst.child_venue_id = cv.child_venue_id
  //       ) AS shiftTimings,

  //       /* PRICING */
  //       (
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'id', vp.id,
  //             'childVenueId', vp.child_venue_id,
  //             'name', vp.name,
  //             'pricingKey', vp.pricing_key,
  //             'amount', vp.amount,
  //             'enabled', vp.enabled,
  //             'category', vp.category
  //           )
  //         )
  //         FROM property_pricing vp
  //         WHERE vp.child_venue_id = cv.child_venue_id
  //       ) AS pricing,

  //       /* MIN PRICE FOR SORTING */
  //       (
  //         SELECT MIN(vst.price)
  //         FROM venue_shift_timing vst
  //         WHERE vst.child_venue_id = cv.child_venue_id
  //       ) AS minPrice

  //     FROM venue_child cv

  //     INNER JOIN venue_parent pv
  //       ON pv.parent_venue_id = cv.parent_venue_id

  //     ${whereClause}

  //     ORDER BY minPrice ASC

  //     LIMIT ?
  //     OFFSET ?
  //   `;

  //     const rows = await this.dataSource.query(sql, [...params, limit, offset]);

  //     /* ======================
  //      TOTAL COUNT QUERY
  //   ====================== */

  //     const countSql = `
  //     SELECT COUNT(DISTINCT cv.child_venue_id) AS total

  //     FROM venue_child cv

  //     INNER JOIN venue_parent pv
  //       ON pv.parent_venue_id = cv.parent_venue_id

  //     ${whereClause}
  //   `;

  //     const totalResult = await this.dataSource.query(countSql, params);

  //     const total = Number(totalResult[0]?.total || 0);

  //     /* ======================
  //      FINAL RESPONSE
  //   ====================== */

  //     const data = rows.map((item: any) => ({
  //       ...item,

  //       galleryImages:
  //         typeof item.galleryImages === 'string'
  //           ? JSON.parse(item.galleryImages)
  //           : item.galleryImages || [],

  //       amenities:
  //         typeof item.amenities === 'string'
  //           ? JSON.parse(item.amenities)
  //           : item.amenities || [],

  //       shiftTimings:
  //         typeof item.shiftTimings === 'string'
  //           ? JSON.parse(item.shiftTimings)
  //           : item.shiftTimings || [],

  //       pricing:
  //         typeof item.pricing === 'string'
  //           ? JSON.parse(item.pricing)
  //           : item.pricing || [],
  //     }));

  //  /* ======================
  //      UnRegister DATA
  //   ====================== */

  //   const unsql = `
  //     SELECT
  //       uv.id,
  //       uv.name,
  //       uv.address,
  //       uv.lat,
  //       uv.lng,

  //       /* COVER IMAGE */
  //       (
  //         SELECT ug.image
  //         FROM unrigistered_gallery ug
  //         WHERE ug.unreg_id = uv.id
  //         ORDER BY ug.id ASC
  //         LIMIT 1
  //       ) AS coverImage,

  //       /* ALL IMAGES */
  //       (
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'id', ug.id,
  //             'image', ug.image
  //           )
  //         )
  //         FROM unrigistered_gallery ug
  //         WHERE ug.unreg_id = uv.id
  //       ) AS images,

  //       /* TYPES */
  //       (
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'id', ut.id,
  //             'type', ut.type_name
  //           )
  //         )
  //         FROM unrigistered_types ut
  //         WHERE ut.unreg_id = uv.id
  //       ) AS types,

  //       /* EVENT TYPES */
  //       (
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'id', uet.id,
  //             'eventType', uet.event_type
  //           )
  //         )
  //         FROM unrigistered_event_types uet
  //         WHERE uet.unreg_id = uv.id
  //       ) AS eventTypes

  //     FROM unrigistered_venues uv
  //   `;

  //   const unregistered = await this.dataSource.query(unsql);

  //   const unregistered_data = {
  //     success: true,
  //     data: unregistered.map((item: any) => ({
  //       ...item,
  //       images:
  //         typeof item.images === 'string'
  //           ? JSON.parse(item.images)
  //           : item.images || [],

  //       types:
  //         typeof item.types === 'string'
  //           ? JSON.parse(item.types)
  //           : item.types || [],

  //       eventTypes:
  //         typeof item.eventTypes === 'string'
  //           ? JSON.parse(item.eventTypes)
  //           : item.eventTypes || [],
  //     })),
  //   };

  //     return {
  //       success: true,
  //       total,
  //       page,
  //       limit,
  //       totalPages: Math.ceil(total / limit),
  //       // data,
  //       data: [...data, ...unregistered_data]
  //     };
  //   }
  //   async getVenuesPageData(query: any) {
  //   const page = Number(query.page || 1);
  //   const limit = Number(query.limit || 10);

  //   const qb = this.childRepo
  //     .createQueryBuilder('child')

  //     /* ======================
  //        RELATIONS (JOIN ONLY)
  //     ====================== */
  //     .leftJoin('child.parentVenue', 'parentVenue')
  //     .leftJoin('child.galleries', 'gallery')
  //     .leftJoin('child.shiftTimings', 'shiftTimings')
  //     .leftJoin('child.childAmenities', 'amenities')
  //     .leftJoin('child.pricings', 'pricing')

  //     /* ======================
  //        SELECT ONLY REQUIRED FIELDS
  //     ====================== */
  //     .select([
  //       'child.child_venue_id',
  //       'child.child_venue_name',
  //       'child.venueCategoryId',
  //       'child.minGuest',
  //       'child.guestRooms',
  //       'child.venueMode',

  //       'parentVenue.parent_venue_id',
  //       'parentVenue.venueName',
  //       'parentVenue.venueCity',
  //       'parentVenue.venueState',
  //       'parentVenue.venueCountry',
  //       'parentVenue.venueAddress',
  //       'parentVenue.lat',
  //       'parentVenue.lng',
  //       'parentVenue.rating',
  //       'parentVenue.reviews',
  //       'parentVenue.propetyCategory',

  //       'gallery.id',
  //       'gallery.attachment',
  //       'gallery.imageType',

  //       'shiftTimings.id',
  //       'shiftTimings.price',
  //       'shiftTimings.shiftType',
  //       'shiftTimings.fromTime',
  //       'shiftTimings.toTime',

  //       'amenities.id',
  //       'amenities.amenities_id as am_id',

  //       'pricing.id',
  //       'pricing.childVenueId',
  //       'pricing.name',
  //       'pricing.pricingKey',
  //       'pricing.amount',
  //       'pricing.enabled',
  //       'pricing.category',
  //     ]);

  //   /* ======================
  //      SEARCH
  //   ====================== */
  //   if (query.search) {
  //     qb.andWhere(
  //       `(child.child_venue_name LIKE :search
  //         OR parentVenue.venueName LIKE :search
  //         OR parentVenue.venueCity LIKE :search)`,
  //       { search: `%${query.search}%` },
  //     );
  //   }

  //   /* ======================
  //      FILTERS
  //   ====================== */
  //   if (query.category) {
  //     qb.andWhere('parentVenue.propetyCategory = :category', {
  //       category: query.category,
  //     });
  //   }

  //   if (query.subcategory) {
  //     qb.andWhere('child.venueCategoryId = :subcategory', {
  //       subcategory: query.subcategory,
  //     });
  //   }

  //   if (query.country) {
  //     qb.andWhere('parentVenue.venueCountry = :country', {
  //       country: query.country,
  //     });
  //   }

  //   if (query.state) {
  //     qb.andWhere('parentVenue.venueState = :state', {
  //       state: query.state,
  //     });
  //   }

  //   if (query.city) {
  //     qb.andWhere('parentVenue.venueCity = :city', {
  //       city: query.city,
  //     });
  //   }

  //   /* ======================
  //      AMENITIES FILTER
  //   ====================== */
  //   if (query.childAmenities?.length) {
  //     const amenities = Array.isArray(query.childAmenities)
  //       ? query.childAmenities
  //       : query.childAmenities.split(',');

  //     qb.andWhere('amenities.amenities_id IN (:...amenities)', {
  //       amenities,
  //     });
  //   }

  //   /* ======================
  //      PRICE FILTER (SHIFT)
  //   ====================== */
  //   if (query.minPrice) {
  //     qb.andWhere('shiftTimings.price >= :minPrice', {
  //       minPrice: Number(query.minPrice),
  //     });
  //   }

  //   if (query.maxPrice) {
  //     qb.andWhere('shiftTimings.price <= :maxPrice', {
  //       maxPrice: Number(query.maxPrice),
  //     });
  //   }

  //   /* ======================
  //      SORT (LOWEST PRICE FIRST)
  //   ====================== */
  //   qb.orderBy('shiftTimings.price', 'ASC');

  //   /* ======================
  //      PAGINATION
  //   ====================== */
  //   qb.skip((page - 1) * limit);
  //   qb.take(limit);

  //   qb.distinct(true);

  //   /* ======================
  //      EXECUTE
  //   ====================== */
  //   const [rows, total] = await qb.getManyAndCount();

  //   /* ======================
  //      CLEAN RESPONSE
  //   ====================== */
  //   const data = rows.map((item: any) => {
  //     const galleries = item.galleries || [];

  //     return {
  //       childVenueId: item.child_venue_id,
  //       venueName: item.child_venue_name,

  //       category: item.parentVenue?.propetyCategory,
  //       subcategory: item.venueCategoryId,

  //       city: item.parentVenue?.venueCity,
  //       state: item.parentVenue?.venueState,
  //       country: item.parentVenue?.venueCountry,
  //       address: item.parentVenue?.venueAddress,

  //       lat: item.parentVenue?.lat,
  //       lng: item.parentVenue?.lng,

  //       rating: item.parentVenue?.rating,
  //       reviews: item.parentVenue?.reviews,

  //       minGuest: item.minGuest,
  //       maxGuest: item.guestRooms,
  //       venueMode: item.venueMode,

  //       /* COVER */
  //       coverImage:
  //         galleries.find(g => Number(g.imageType) === 1)?.attachment || null,

  //       /* BANNER */
  //       bannerImage:
  //         galleries.find(g => Number(g.imageType) === 2)?.attachment || null,

  //       /* GALLERY */
  //       galleryImages: galleries
  //         .filter(g => Number(g.imageType) === 3)
  //         .map(g => ({
  //           id: g.id,
  //           image: g.attachment,
  //         })),

  //       /* AMENITIES */
  //       amenities: item.childAmenities || [],

  //       /* SHIFT PRICING */
  //       shiftTimings: item.shiftTimings || [],

  //       /* PRICING (IMPORTANT FIX) */
  //       pricing: item.pricings || [],
  //     };
  //   });

  //   return {
  //     success: true,
  //     total,
  //     page,
  //     limit,
  //     totalPages: Math.ceil(total / limit),
  //     data,
  //   };
  // }
  async getVenuesPageData(query: any, country: any) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const offset = (page - 1) * limit;

    const { shift, category_cards, budget } = query.filters || {};

    const mapBounds = query.mapBounds || null;

    const north = mapBounds?.north ?? null;
    const south = mapBounds?.south ?? null;
    const east = mapBounds?.east ?? null;
    const west = mapBounds?.west ?? null;

    /* ======================
     FILTERS
  ====================== */
    const where: string[] = [];
    const params: any[] = [];

    const bucketUrl = process.env.PUBLIC_AWS_BUCKET_URL;

   params.push(bucketUrl);
    


    if (query.search) {
      where.push(`
      (
        cv.child_venue_name LIKE ?
        OR pv.venue_name LIKE ?
        OR pv.venue_city LIKE ?
      )
    `);

      const search = `%${query.search}%`;
      params.push(search, search, search);
    }

    if (query.type) {
      where.push(`pv.propety_category = ?`);
      params.push(query.type?.trim().replace(/s$/, ''));
    }

    if (query.category) {
      where.push(`cv.venue_category_id = ?`);
      params.push(query.category);
    }

    if (country) {
      where.push(`pv.venue_country = ?`);
      params.push(country);
    }

    if (query.city) {
      where.push(`pv.venue_city = ?`);
      params.push(query.city);
    }

    if (mapBounds) {
      where.push(`
      pv.lat BETWEEN ? AND ?
      AND pv.lng BETWEEN ? AND ?
    `);

      params.push(south, north, west, east);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    

    /* ======================
     REGISTERED VENUES
  ====================== */

  


    const sql = `
    SELECT
      cv.child_venue_id AS childVenueId,
      cv.parent_venue_id AS parentVenueId,
      cv.child_venue_name AS venueName,
      cv.guest_rooms AS maxGuests,
      pv.venue_city AS city,
      pv.venue_state AS state,
      pv.venue_state AS venueType,
      pv.venue_name AS parentVenueName,
      pv.venue_country AS country,
      pv.rating AS rating,
      pv.user_ratings_total AS reviewCount,
      pv.user_ratings_total AS featured,
      pv.lat,
      pv.lng,
      pv.propety_category AS category,
      pv.reel_video,
      CASE
    WHEN pv.reel_video IS NOT NULL AND pv.reel_video <> ''
    THEN CONCAT(TRIM(TRAILING '/' FROM ?), '/', TRIM(LEADING '/' FROM pv.reel_video))
    ELSE NULL
END AS videoUrl,

       /* COVER IMAGE */
      (
        SELECT vg.attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = cv.child_venue_id
        AND vg.image_type = 1
        LIMIT 1
      ) AS coverImage,

      /* BANNER IMAGE */
      (
        SELECT vg.attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = cv.child_venue_id
        AND vg.image_type = 2
        LIMIT 1
      ) AS coverImage,

      /* GALLERY  
            'id', vg.id,  AND vg.image_type = 3*/
      (
        SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'image', vg.attachment
          )
        )
        FROM venue_gallery vg
        WHERE vg.child_venue_id = cv.child_venue_id
       
      ) AS images,

(
  SELECT COUNT(*)
  FROM property_likes pl
  WHERE pl.property_id = cv.child_venue_id
) AS totalLikes,
      (
        SELECT MIN(vst.price)
        FROM venue_shift_timing vst
        WHERE vst.child_venue_id = cv.child_venue_id
      ) AS minPrice

    FROM venue_child cv
    INNER JOIN venue_parent pv
      ON pv.parent_venue_id = cv.parent_venue_id

    ${whereClause}

    ORDER BY minPrice ASC
    LIMIT ?
    OFFSET ?
  `;

    const venues = await this.dataSource.query(sql, [...params, limit, offset]);

    /* ======================
     UNREGISTERED (PAGINATED)
  ====================== */

   const wheres: string[] = [];
    const paramss: any[] = [];

   if (mapBounds) {
      wheres.push(`
      uv.lat BETWEEN ? AND ?
      AND uv.lng BETWEEN ? AND ?
    `);

      paramss.push(south, north, west, east);
    }

    const whereClauses = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

const filters = query.filters || {};

const hasAdvancedFilters =
  !!query.category ||
  !!query.search ||
  !!query.city ||

  // Keep type allowed
  false ||

  // Event type
  filters.eventType?.length > 0 ||

  // Capacity
  filters.capacity?.length > 0 ||

  // Category cards
  filters.category_cards?.length > 0 ||

  // Shift
  filters.shift?.length > 0 ||

  // Booking
  filters.booking?.length > 0 ||

  // Amenities
  filters.amenities?.length > 0 ||

  // Quick filters
  filters.quickFilter?.length > 0 ||

  // Farm
  filters.farmType?.length > 0 ||
  filters.farmFood?.length > 0 ||
  filters.farmExperiences?.length > 0 ||

  // Venue
  filters.venueStyle?.length > 0 ||
  filters.foodCatering?.length > 0 ||

  // Workspace
  filters.workspaceType?.length > 0 ||
  filters.workspaceBooking?.length > 0 ||
  filters.workspaceFeatures?.length > 0 ||

  // Studio
  filters.studioType?.length > 0 ||
  filters.studioFeatures?.length > 0 ||

  // Rental
  filters.rentalCategory?.length > 0 ||
  filters.rentalFeatures?.length > 0 ||

  // Stay
  filters.stayType?.length > 0 ||

  // Others
  filters.petFriendly?.length > 0 ||
  filters.kidFriendly?.length > 0 ||
  filters.poolExperience?.length > 0 ||
  filters.loyaltyPerks?.length > 0 ||
  filters.suitability?.length > 0 ||
  filters.experienceType?.length > 0 ||
  filters.expBooking?.length > 0 ||

  // Budget changed from default
  (filters.budget &&
    (filters.budget.min > 0 || filters.budget.max < 500000));

    const unsql = `
  SELECT
    uv.id AS childVenueId,
    uv.id AS parentVenueId,
    uv.name AS venueName,
    uv.name AS parentVenueName,
    uv.name AS category,
    uv.country,
    
    uv.lat,
    uv.lng,
    uv.state,
    uv.city,

     0 AS maxGuests,
     0 AS videoUrl,
    uv.name AS venueType,
    uv.rating,
    uv.user_ratings_total as reviewCount,

    (
      SELECT ug.images
      FROM unrigistered_gallery ug
      WHERE ug.unreg_id = uv.id
      ORDER BY ug.id ASC
      LIMIT 1
    ) AS coverImage,

    (
      SELECT JSON_ARRAYAGG(ug.images)
      FROM unrigistered_gallery ug
      WHERE ug.unreg_id = uv.id
    ) AS images

  FROM unrigistered_venues uv
  ${whereClauses}
  LIMIT ? OFFSET ?
`;

paramss.push(limit, offset);

// const unregistered = await this.dataSource.query(unsql, paramss);

let unregistered = [];

if (!hasAdvancedFilters) {
  unregistered = await this.dataSource.query(unsql, paramss);
}

    /* ======================
     MERGE RESULT (FIXED)
  ====================== */

    /* ======================
     COUNT (only registered for now)
  ====================== */

    const countSql = `
    SELECT COUNT(*) AS total
    FROM venue_child cv
    INNER JOIN venue_parent pv
      ON pv.parent_venue_id = cv.parent_venue_id
    ${whereClause}
  `;

    const totalResult = await this.dataSource.query(countSql, params);

    const total = Number(totalResult[0]?.total || 0);

    /* ======================
     RESPONSE
  ====================== */


    return {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: [...venues, ...unregistered],
    };
  }
  async getVenuesPageDatas(filters: any) {
    const params: any[] = [];

    let query = `
  SELECT 
    cv.child_venue_id,
    cv.child_venue_name,
    cv.guest_rooms,
    pv.venue_country,
    pv.lat,
    pv.lng,
    pv.venue_name,
    cat.name AS category_name,

    -- ================= LOWEST PRICE =================
    IFNULL((
      SELECT MIN(st.price)
      FROM venue_shift_header sh
      INNER JOIN venue_shift_timing st 
        ON sh.name = 
          CASE st.shift_type
            WHEN 1 THEN 'Morning'
            WHEN 2 THEN 'Afternoon'
            WHEN 3 THEN 'Evening'
          END
      WHERE sh.child_id = cv.child_venue_id
        AND sh.publish = 1
        AND sh.created_at = (
          SELECT MAX(created_at)
          FROM venue_shift_header
          WHERE child_venue_id = cv.child_venue_id
            AND publish = 1
        )
    ), 0) AS lowest_price,

    -- ================= AMENITIES =================
    IFNULL((
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', a.id,
          'name', a.name
        )
      )
      FROM venue_child_amenities cva
      LEFT JOIN amenities a ON a.id = cva.amenities_id
      WHERE cva.child_venue_id = cv.child_venue_id
    ), JSON_ARRAY()) AS amenities,

    -- ================= TAGS =================
    IFNULL((
      SELECT JSON_ARRAYAGG(t.name)
      FROM venue_tags vt
      LEFT JOIN venue_categories t ON t.id = vt.venue_cat_id
      WHERE vt.child_venue_id = cv.child_venue_id
    ), JSON_ARRAY()) AS tags,

    -- ================= GALLERY =================
    IFNULL((
      SELECT JSON_ARRAYAGG(gv.attachment)
      FROM venue_gallery gv
      WHERE gv.child_venue_id = cv.child_venue_id
    ), JSON_ARRAY()) AS gallery

  FROM venue_child cv

  LEFT JOIN venue_parent pv 
    ON pv.parent_venue_id = cv.parent_venue_id

  LEFT JOIN venue_categories cat
    ON cat.id = cv.venue_category_id

  WHERE cv.publish_status = 1
`;
    if (filters.venue_id) {
      query += ` AND cv.child_venue_id = ?`;
      params.push(filters.venue_id);
    }

    if (filters.category_id) {
      query += ` AND cv.venue_category_id = ?`;
      params.push(filters.category_id);
    }

    if (filters.country) {
      query += ` AND pv.venue_country = ?`;
      params.push(filters.country);
    }
    if (filters.capacity) {
      query += ` AND cv.guest_rooms >= ?`;
      params.push(filters.capacity);
    }

    if (filters.minPrice || filters.maxPrice) {
      query += `
    AND EXISTS (
      SELECT 1 
      FROM venue_shift_timing st
      WHERE st.child_venue_id = cv.child_venue_id
  `;

      if (filters.minPrice && filters.maxPrice) {
        query += ` AND st.price BETWEEN ? AND ? `;
        params.push(filters.minPrice, filters.maxPrice);
      } else if (filters.minPrice) {
        query += ` AND st.price >= ? `;
        params.push(filters.minPrice);
      } else if (filters.maxPrice) {
        query += ` AND st.price <= ? `;
        params.push(filters.maxPrice);
      }

      query += ` ) `;
    }
    if (filters.tag_id) {
      const tags = filters.tag_id.split(',');

      query += `
    AND EXISTS (
      SELECT 1 
      FROM venue_tags vt
      WHERE vt.child_venue_id = cv.child_venue_id
      AND vt.tag_id IN (${tags.map(() => '?').join(',')})
    )
  `;

      params.push(...tags);
    }

    if (filters.lat && filters.lng && filters.radius) {
      query += `
    AND (
      6371 * acos(
        cos(radians(?)) * cos(radians(pv.lat)) *
        cos(radians(pv.lng) - radians(?)) +
        sin(radians(?)) * sin(radians(pv.lat))
      )
    ) <= ?
  `;

      params.push(filters.lat, filters.lng, filters.lat, filters.radius);
    }

    query += `
  GROUP BY cv.child_venue_id
  ORDER BY cv.child_venue_id DESC
  LIMIT ? OFFSET ?
`;

    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 10);
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    return await this.dataSource.query(query, params);
  }

  async saveWishlistCategory(body: any, userId: any) {
    try {
      let categoryId = body.category_id;

      /* ----------------------------------------
       EXISTING CATEGORY
    -----------------------------------------*/
      if (categoryId) {
        // optional check category belongs to user
        const categoryCheck: any = await this.dataSource.query(
          `SELECT id 
         FROM wishlist_categories
         WHERE id = ?
         AND user_id = ?`,
          [categoryId, userId],
        );

        if (!categoryCheck.length) {
          return {
            success: false,
            message: 'Invalid category',
          };
        }
      } else {
        /* ----------------------------------------
         CREATE NEW CATEGORY
      -----------------------------------------*/

        const categoryResult: any = await this.dataSource.query(
          `INSERT INTO wishlist_categories
        (user_id, name, is_default, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())`,
          [userId, body.name, 0],
        );

        categoryId = categoryResult.insertId;
      }

      /* ----------------------------------------
       CHECK ALREADY EXISTS
    -----------------------------------------*/

      const existingWishlist: any = await this.dataSource.query(
        `SELECT id
       FROM user_wishlists
       WHERE user_id = ?
       AND venue_id = ?
       AND category_id = ?`,
        [userId, body.venue_id, categoryId],
      );

      if (existingWishlist.length) {
        return {
          success: true,
          message: 'Already saved',
        };
      }

      /* ----------------------------------------
       INSERT WISHLIST
    -----------------------------------------*/

      await this.dataSource.query(
        `INSERT INTO user_wishlists
      (user_id, venue_id, category_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [userId, body.venue_id, categoryId, 1],
      );

      return {
        success: true,
        message: 'Wishlist saved successfully',
        category_id: categoryId,
      };
    } catch (error) {
      console.log(error);

      return {
        success: false,
        message: 'Something went wrong',
      };
    }
  }
  async UserWishlistCategory(userId: any) {
    const wishlistCategories = await this.dataSource.query(
      `
  SELECT 
      wc.id,
      wc.user_id,
      wc.name,
      wc.is_default,
      wc.created_at,

      COUNT(DISTINCT uw.id) AS total_wishlist,

      (
          SELECT vg.attachment
          FROM user_wishlists uw2

          LEFT JOIN venue_gallery vg
              ON vg.child_venue_id = uw2.venue_id

          WHERE uw2.category_id = wc.id
          AND uw2.is_active = 1

          ORDER BY vg.id ASC
          LIMIT 1
      ) AS category_image

  FROM wishlist_categories wc

  LEFT JOIN user_wishlists uw
      ON uw.category_id = wc.id
      AND uw.is_active = 1

  WHERE wc.user_id = ?

  GROUP BY
      wc.id,
      wc.user_id,
      wc.name,
      wc.is_default,
      wc.created_at

  ORDER BY wc.created_at DESC
  `,
      [userId],
    );

    return wishlistCategories;
  }

  async UserUserWishlist(userId: any) {
    const UserWishlis = await this.dataSource.query(
      `
  SELECT 
      uc.id,
      uc.user_id,
      uc.venue_id

  FROM user_wishlists uc

  WHERE uc.user_id = ?
  `,
      [userId],
    );

    return UserWishlis;
  }

  async remove_wishlist(body: any, userId: any) {
    const UserWishlis = await this.dataSource.query(
      `
  DELETE

  FROM user_wishlists 

  WHERE user_id = ? AND  venue_id = ? 
  `,
      [userId, body.venue_id],
    );
  }

  //addCompareAPI removeCompareAPI
  /* ================================
   COMPARE SERVICE - NEST JS
================================ */

  async addCompareAPI(body: any, userId: number) {
    try {
      /* ---------------- CHECK EXIST ---------------- */

      const existing: any = await this.dataSource.query(
        `
      SELECT id
      FROM compare_list
      WHERE user_id = ?
      AND venue_id = ?
      LIMIT 1
      `,
        [userId, body.venue_id],
      );

      /* ---------------- REMOVE IF EXISTS ---------------- */

      if (existing.length > 0) {
        await this.dataSource.query(
          `
        DELETE FROM compare_list
        WHERE user_id = ?
        AND venue_id = ?
        `,
          [userId, body.venue_id],
        );

        return {
          success: true,
          action: 'removed',
        };
      }

      /* ---------------- LIMIT CHECK ---------------- */

      const total: any = await this.dataSource.query(
        `
      SELECT COUNT(*) as total
      FROM compare_list
      WHERE user_id = ?
      `,
        [userId],
      );

      if (total[0].total >= 4) {
        return {
          success: false,
          message: 'Only 4 compare venues allowed',
        };
      }

      /* ---------------- INSERT ---------------- */

      await this.dataSource.query(
        `
      INSERT INTO compare_list
      (
        user_id,
        venue_id,
        created_at,
        updated_at
      )
      VALUES
      (
        ?, ?, NOW(), NOW()
      )
      `,
        [userId, body.venue_id],
      );

      return {
        success: true,
        action: 'added',
      };
    } catch (error) {
      console.log(error);

      return {
        success: false,
        message: 'Compare failed',
      };
    }
  }
  async removeCompareAPI(body: any, userId: number) {
    try {
      await this.dataSource.query(
        `
      DELETE FROM compare_list
      WHERE user_id = ?
      AND venue_id = ?
      `,
        [userId, body.venue_id],
      );

      return {
        success: true,
        message: 'Compare removed successfully',
      };
    } catch (error) {
      console.log(error);

      return {
        success: false,
        message: 'Failed to remove compare',
      };
    }
  }

  // async UserCompare(userId: any) {
  //     const UserCompare = await this.dataSource.query(
  //       `
  //   SELECT
  //       uc.id,
  //       uc.user_id,
  //       uc.venue_id

  //   FROM compare_list uc

  //   WHERE uc.user_id = ?
  //   `,
  //       [userId],
  //     );

  //     return UserCompare;
  //   }
  async UserCompare(userId: any) {
    const UserCompare = await this.dataSource.query(
      `
    SELECT 
        uc.id ,
        uc.user_id,
        uc.venue_id as childVenueId,

        cv.child_venue_id,
        cv.child_venue_name AS title,
      

        (
          SELECT vg.attachment
          FROM venue_gallery vg
          WHERE vg.child_venue_id = cv.child_venue_id
          ORDER BY vg.id ASC
          LIMIT 1
        ) AS image

    FROM compare_list uc

    LEFT JOIN venue_child cv
        ON cv.child_venue_id = uc.venue_id

    WHERE uc.user_id = ?

    ORDER BY uc.id DESC
    `,
      [userId],
    );

    return UserCompare;
  }
  async userRecentViewsAPI(body: any, userId: any) {
  await this.dataSource.query(
    `
    INSERT INTO user_recent_views (user_id, venue_id, viewed_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      viewed_at = NOW()
    `,
    [userId, body.venue_id],
  );

  // keep only latest 20
  await this.dataSource.query(
    `
    DELETE FROM user_recent_views
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id
        FROM user_recent_views
        WHERE user_id = ?
        ORDER BY viewed_at DESC
        LIMIT 20
      ) t
    )
    `,
    [userId],
  );
}
  //	user_recent_views

async addLikedProperty(body: any, userId: any) {
  const { property_id, property_type } = body;

   const singular = property_type.endsWith('s') ? property_type.slice(0, -1) : property_type;
    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );

  const [existing] = await this.dataSource.query(
    `
    SELECT id
    FROM property_likes
    WHERE user_id = ?
      AND property_id = ?
      AND property_type = ?
    LIMIT 1
    `,
    [userId, property_id, categorys.id],
  );

  if (existing) {
    await this.dataSource.query(
      `
      DELETE FROM property_likes
      WHERE id = ?
      `,
      [existing.id],
    );

    return {
      liked: false,
      message: 'Property removed from favourites.',
    };
  }

  await this.dataSource.query(
    `
    INSERT INTO property_likes
    (user_id, property_id, property_type)
    VALUES (?, ?, ?)
    `,
    [userId, property_id, categorys.id],
  );

  return {
    liked: true,
    message: 'Property added to favourites.',
  };
}

async likedProperty(userId: any) {


  const likedProperty = await this.dataSource.query(
    `
    SELECT property_id
    FROM property_likes
    WHERE user_id = ?
    `,
    [userId],
  );

  return likedProperty;

}

async totalLikedProperty() {


  const totalLikedProperty = await this.dataSource.query(
    `
    SELECT property_id
    FROM property_likes
    `,
  );

  return totalLikedProperty;

}

  
}

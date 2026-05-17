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
  async getVenuesPageData(query: any) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 10);

  const qb = this.childRepo
    .createQueryBuilder('child')

    /* ======================
       RELATIONS (JOIN ONLY)
    ====================== */
    .leftJoin('child.parentVenue', 'parentVenue')
    .leftJoin('child.galleries', 'gallery')
    .leftJoin('child.shiftTimings', 'shiftTimings')
    .leftJoin('child.childAmenities', 'amenities')
    .leftJoin('child.pricings', 'pricing')

    /* ======================
       SELECT ONLY REQUIRED FIELDS
    ====================== */
    .select([
      'child.child_venue_id',
      'child.childVenueName',
      'child.venueCategoryId',
      'child.minGuest',
      'child.guestRooms',
      'child.venueMode',

      'parentVenue.parent_venue_id',
      'parentVenue.venueName',
      'parentVenue.venueCity',
      'parentVenue.venueState',
      'parentVenue.venueCountry',
      'parentVenue.venueAddress',
      'parentVenue.lat',
      'parentVenue.lng',
      'parentVenue.rating',
      'parentVenue.reviews',
      'parentVenue.propetyCategory',

      'gallery.id',
      'gallery.attachment',
      'gallery.imageType',

      'shiftTimings.id',
      'shiftTimings.price',
      'shiftTimings.shiftType',
      'shiftTimings.fromTime',
      'shiftTimings.toTime',

      'amenities.id',
      'amenities.amenities_id as am_id',

      'pricing.id',
      'pricing.childVenueId',
      'pricing.name',
      'pricing.pricingKey',
      'pricing.amount',
      'pricing.enabled',
      'pricing.category',
    ]);

  /* ======================
     SEARCH
  ====================== */
  if (query.search) {
    qb.andWhere(
      `(child.childVenueName LIKE :search
        OR parentVenue.venueName LIKE :search
        OR parentVenue.venueCity LIKE :search)`,
      { search: `%${query.search}%` },
    );
  }

  /* ======================
     FILTERS
  ====================== */
  if (query.category) {
    qb.andWhere('parentVenue.propetyCategory = :category', {
      category: query.category,
    });
  }

  if (query.subcategory) {
    qb.andWhere('child.venueCategoryId = :subcategory', {
      subcategory: query.subcategory,
    });
  }

  if (query.country) {
    qb.andWhere('parentVenue.venueCountry = :country', {
      country: query.country,
    });
  }

  if (query.state) {
    qb.andWhere('parentVenue.venueState = :state', {
      state: query.state,
    });
  }

  if (query.city) {
    qb.andWhere('parentVenue.venueCity = :city', {
      city: query.city,
    });
  }

  /* ======================
     AMENITIES FILTER
  ====================== */
  if (query.childAmenities?.length) {
    const amenities = Array.isArray(query.childAmenities)
      ? query.childAmenities
      : query.childAmenities.split(',');

    qb.andWhere('amenities.amenities_id IN (:...amenities)', {
      amenities,
    });
  }

  /* ======================
     PRICE FILTER (SHIFT)
  ====================== */
  if (query.minPrice) {
    qb.andWhere('shiftTimings.price >= :minPrice', {
      minPrice: Number(query.minPrice),
    });
  }

  if (query.maxPrice) {
    qb.andWhere('shiftTimings.price <= :maxPrice', {
      maxPrice: Number(query.maxPrice),
    });
  }

  /* ======================
     SORT (LOWEST PRICE FIRST)
  ====================== */
  qb.orderBy('shiftTimings.price', 'ASC');

  /* ======================
     PAGINATION
  ====================== */
  qb.skip((page - 1) * limit);
  qb.take(limit);

  qb.distinct(true);

  /* ======================
     EXECUTE
  ====================== */
  const [rows, total] = await qb.getManyAndCount();

  /* ======================
     CLEAN RESPONSE
  ====================== */
  const data = rows.map((item: any) => {
    const galleries = item.galleries || [];

    return {
      childVenueId: item.child_venue_id,
      venueName: item.childVenueName,

      category: item.parentVenue?.propetyCategory,
      subcategory: item.venueCategoryId,

      city: item.parentVenue?.venueCity,
      state: item.parentVenue?.venueState,
      country: item.parentVenue?.venueCountry,
      address: item.parentVenue?.venueAddress,

      lat: item.parentVenue?.lat,
      lng: item.parentVenue?.lng,

      rating: item.parentVenue?.rating,
      reviews: item.parentVenue?.reviews,

      minGuest: item.minGuest,
      maxGuest: item.guestRooms,
      venueMode: item.venueMode,

      /* COVER */
      coverImage:
        galleries.find(g => Number(g.imageType) === 1)?.attachment || null,

      /* BANNER */
      bannerImage:
        galleries.find(g => Number(g.imageType) === 2)?.attachment || null,

      /* GALLERY */
      galleryImages: galleries
        .filter(g => Number(g.imageType) === 3)
        .map(g => ({
          id: g.id,
          image: g.attachment,
        })),

      /* AMENITIES */
      amenities: item.childAmenities || [],

      /* SHIFT PRICING */
      shiftTimings: item.shiftTimings || [],

      /* PRICING (IMPORTANT FIX) */
      pricing: item.pricings || [],
    };
  });

  return {
    success: true,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data,
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
}

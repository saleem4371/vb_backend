import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class VenueService {
  constructor(private dataSource: DataSource) {}

  async getPopularVenues() {
    return this.dataSource.query(`
      SELECT child_venue_name, child_venue_id
      FROM venue_child
      WHERE publish_status = 1
      LIMIT 10
    `);
  }

  // async getVenuesPageData(filters: any) {
  //   let query = `
  //     SELECT 
  //       cv.child_venue_id,
  //       cv.child_venue_name,
  //       pv.venue_country,
  //       pv.lat,
  //       pv.lng,
  //       pv.venue_name,
  //       cat.name AS category_name,

  //       -- ================= SHIFTS =================
  //       IFNULL((
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'shift', st.shift_type,
  //             'start_time', st.from_time,
  //             'end_time', st.to_time,
  //             'price', st.price
  //           )
  //         )
  //         FROM venue_shift_timing st
  //         WHERE st.child_venue_id = cv.child_venue_id
  //       ), JSON_ARRAY()) AS shifts,

  //       -- ================= AMENITIES =================
  //       IFNULL((
  //         SELECT JSON_ARRAYAGG(
  //           JSON_OBJECT(
  //             'id', a.id,
  //             'name', a.name
  //           )
  //         )
  //         FROM venue_child_amenities cva
  //         LEFT JOIN amenities a ON a.id = cva.amenities_id
  //         WHERE cva.child_venue_id = cv.child_venue_id
  //       ), JSON_ARRAY()) AS amenities,

  //       -- ================= TAGS =================
  //       IFNULL((
  //         SELECT JSON_ARRAYAGG(t.name)
  //         FROM venue_tags vt
  //         LEFT JOIN venue_categories t ON t.id = vt.venue_cat_id
  //         WHERE vt.child_venue_id = cv.child_venue_id
  //       ), JSON_ARRAY()) AS tags,

  //       -- ================= GALLERY =================
  //       IFNULL((
  //         SELECT JSON_ARRAYAGG(gv.attachment)
  //         FROM venue_gallery gv
  //         WHERE gv.child_venue_id = cv.child_venue_id
  //       ), JSON_ARRAY()) AS gallery

  //     FROM venue_child cv

  //     LEFT JOIN venue_parent pv 
  //       ON pv.parent_venue_id = cv.parent_venue_id

  //     LEFT JOIN venue_categories cat
  //       ON cat.id = cv.venue_category_id

  //     WHERE cv.publish_status = 1
  //   `;
  //   //booking_event_types

  //   const params: any[] = [];

  //   // ================= VENUE FILTER =================
  //   if (filters.venue_id) {
  //     query += ` AND cv.child_venue_id = ?`;
  //     params.push(filters.venue_id);
  //   }

  //   // ================= CATEGORY FILTER =================
  //   if (filters.category_id) {
  //     query += ` AND cv.venue_category_id = ?`;
  //     params.push(filters.category_id);
  //   }

  //   // ================= COUNTRY FILTER =================
  //   if (filters.country) {
  //     query += ` AND pv.venue_country = ?`;
  //     params.push(filters.country);
  //   }

  //   // ================= PRICE FILTER =================
  //   if (filters.minPrice && filters.maxPrice) {
  //     query += `
  //       AND EXISTS (
  //         SELECT 1 FROM venue_shift_timing st
  //         WHERE st.child_venue_id = cv.child_venue_id
  //         AND st.price BETWEEN ? AND ?
  //       )
  //     `;
  //     params.push(filters.minPrice, filters.maxPrice);
  //   }

  //   // ================= TAG FILTER =================
  //   if (filters.tag_id) {
  //     const tags = filters.tag_id.split(',');
  //     query += `
  //       AND EXISTS (
  //         SELECT 1 FROM venue_tags vt
  //         WHERE vt.child_venue_id = cv.child_venue_id
  //         AND vt.tag_id IN (${tags.map(() => '?').join(',')})
  //       )
  //     `;
  //     params.push(...tags);
  //   }

  //   // ================= LOCATION FILTER (GOOGLE LAT/LNG) =================
  //   if (filters.lat && filters.lng && filters.radius) {
  //     query += `
  //       AND (
  //         6371 * acos(
  //           cos(radians(?)) * cos(radians(pv.lat)) *
  //           cos(radians(pv.lng) - radians(?)) +
  //           sin(radians(?)) * sin(radians(pv.lat))
  //         )
  //       ) <= ?
  //     `;
  //     params.push(filters.lat, filters.lng, filters.lat, filters.radius);
  //   }

  //   // ================= ORDER =================
  //   query += ` ORDER BY cv.child_venue_id DESC`;

  //   // ================= PAGINATION =================
  //   const page = Number(filters.page || 1);
  //   const limit = Number(filters.limit || 10);
  //   const offset = (page - 1) * limit;

  //   query += ` LIMIT ? OFFSET ?`;
  //   params.push(limit, offset);

  //   return this.dataSource.query(query, params);
  // }
 async getVenuesPageData(filters: any) {
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
  } 
  else if (filters.minPrice) {
    query += ` AND st.price >= ? `;
    params.push(filters.minPrice);
  } 
  else if (filters.maxPrice) {
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
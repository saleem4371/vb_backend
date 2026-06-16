import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { SettingGroup } from './entity/setting-group.entity';
import { Setting } from './entity/setting.entity';
import { VenueSetting } from './entity/venue-setting.entity';

import { PackageCategory } from '../../vendor/packages/entity/package-category.entity'; //entity/package-category.entity

// import { PushService } from '../../push/push.service'


import { v4 as uuidv4 } from 'uuid';
//categoryRepository

@Injectable()
export class BookingsService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
    //  private readonly pushService: PushService,
    @InjectRepository(SettingGroup)
      private readonly settingGroupRepository: Repository<SettingGroup>,

      @InjectRepository(PackageCategory)
      private readonly packageCat: Repository<PackageCategory>,
  ) {}

  

  async invoice_number(user_id: number, id : any) {
  const rows = await this.dataSource.query(
    `
    SELECT auto_increment
    FROM bookings
    WHERE created_under_by = ?
      AND auto_increment IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [user_id]
  );

  if (!rows || rows.length === 0) {
  return "INV00001";
}

  const lastNumber = parseInt(
    rows[0].auto_increment.replace("INV", ""),
    10
  );

  return `INV${String(lastNumber + 1).padStart(5, "0")}`;
}

  async load_shift_event(user_id: number, id : any) 
  {
  const rows = await this.dataSource.query(` 
    SELECT *
    FROM booking_event_types
    WHERE status = 0`);
  return rows;
  }

  async globalSetting(user_id: number, id : any) 
  {
  const rows = await this.dataSource.query(` 
    SELECT *
    FROM venue_booking_setting
    WHERE category_id = ? AND vendor_id = ? `,[1,user_id]);
  return rows;
  }

async availableVenues(body: any, id: number) {
  const {
    selectionMode,
    date,
    startDate,
    endDate,
    shifts = [],
  } = body;

  // Dates
  const from = selectionMode === "single" ? startDate : startDate;
  const to = selectionMode === "single" ? startDate : endDate;

  // Shift Mapping
  const shiftMap: Record<string, number> = {
    morning: 1,
    afternoon: 2,
    evening: 3,
    "full day": 4,
  };

  let shiftIds: number[] = [];

  if (shifts.includes("full day")) {
    shiftIds = [1, 2, 3, 4];
  } else {
    shiftIds = shifts
      .map((s: string) => shiftMap[s])
      .filter(Boolean);
  }

  if (!shiftIds.length) {
    return [];
  }

  // Total Days
  const start = new Date(from);
  const end = new Date(to);

  const totalDays =
    Math.floor(
      (end.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;

  const placeholders = shiftIds.map(() => "?").join(",");

 const sql = `
SELECT
vc.child_venue_id,
vc.parent_venue_id,
vc.child_auto_no,
vc.guest_rooms,
vc.child_venue_name,
vc.venue_category_id,

GROUP_CONCAT(
    DISTINCT vsh.name
    ORDER BY vsh.shift_type
    SEPARATOR ', '
) AS shift_names,

GROUP_CONCAT(
    DISTINCT CONCAT(vsh.from_time,' - ',vsh.to_time)
    ORDER BY vsh.shift_type
    SEPARATOR ', '
) AS shift_timings,

CONCAT(
'[',
GROUP_CONCAT(
    DISTINCT JSON_OBJECT(
        'key', vcs.key,
        'value', vcs.value
    )
),
']'
) AS child_setting,

SUM(DISTINCT cvs.price) AS per_day_price

FROM venue_child vc

INNER JOIN venue_shift_timing cvs
    ON cvs.child_venue_id = vc.child_venue_id

INNER JOIN venue_shift_header vsh
    ON vsh.child_id = vc.child_venue_id
    AND vsh.shift_type = cvs.shift_type
    AND vsh.publish = 1

LEFT JOIN venue_child_settings vcs
    ON vcs.child_id = vc.child_venue_id

WHERE
vc.created_by = ?
AND cvs.shift_type IN (${placeholders})

-- =====================================================
-- ✅ FIXED MULTI-DAY + SHIFT CONFLICT LOGIC
-- =====================================================
AND NOT EXISTS (
    SELECT 1
    FROM bookings b

    INNER JOIN booking_shift bs
        ON bs.booking_id = b.booking_id

    WHERE
        EXISTS (
            SELECT 1
            FROM booking_child_venue bcv
            WHERE bcv.booking_id = b.booking_id
            AND bcv.child_venue_id = vc.child_venue_id
        )

        -- ✅ FIXED DATE OVERLAP (STRICT)
        AND b.from_date <= ?
        AND b.to_date >= ?

        -- ✅ SHIFT MUST MATCH (STRICT CONFLICT)
        AND bs.shift_id IN (${placeholders})
)

GROUP BY vc.child_venue_id

HAVING COUNT(DISTINCT cvs.shift_type) = ?

ORDER BY vc.child_venue_id;
`;
  const venues = await this.dataSource.query(sql, [
  id,

  // venue shifts
  ...shiftIds,

  // date overlap (IMPORTANT ORDER)
   from,
  to,
 

  // booked shifts
  ...shiftIds,

  // full shift match
  shiftIds.length,
]);

 
  return venues.map((venue) => {
 const timings = venue.shift_timings
  ? venue.shift_timings.split(",")
  : [];

let shift_timing = "";

if (timings.length > 0) {
  const firstStart = timings[0].split(" - ")[0];
  const lastEnd = timings[timings.length - 1].split(" - ")[1];

  shift_timing = `${firstStart} to ${lastEnd}`;
}

  return {
    ...venue,

    total_days: totalDays,

    per_day_price: Number(venue.per_day_price),

    total_price: Number(venue.per_day_price) * totalDays,

    shift_names: venue.shift_names
      ? venue.shift_names.split(",")
      : [],

    child_setting: venue.child_setting
    ? JSON.parse(venue.child_setting)
    : [],

    shift_timings:
      timings.length <= 1
        ? timings
        : [timings[0], timings[timings.length - 1]],

         shift_timing
  };
});
}



async Load_all_packages(body: any, id: number) {
  const rows = await this.dataSource.query(
    `
    SELECT
        /* Package */
        p.id AS package_id,
        p.name AS package_name,
        p.price AS package_price,
        p.description,
        p.tags,
        p.icon,
        p.package_type,
        p.allow_events,
        p.count_pack_item,
        p.package_status,

        /* Category */
        pc.id AS config_id,
        pc.category_id,
        pc.count_number,

        c.item_category AS category_name,
        c.cat_icon,
        c.cat_amt,
        c.types,

        /* Items */
        pil.id AS item_id,
        pil.item_name,
        pil.item_price,
        pil.item_price_1,
        pil.image,
        pil.food_pre,
        pi.quantity

    FROM package p

    LEFT JOIN package_category_config pc
        ON pc.package_id = p.id

    LEFT JOIN package_items_category c
        ON c.id = pc.category_id

    LEFT JOIN package_items pi
        ON pi.package_id = p.id

    LEFT JOIN package_items_list pil
        ON pil.id = pi.item_id
       AND pil.cat_id = c.id

    WHERE p.package_status = 1
      AND p.created_by = ?

    ORDER BY p.id,c.id,pil.item_name
    `,
    [id],
  );

  const packageMap = new Map();

  rows.forEach((row: any) => {
    // Package
    if (!packageMap.has(row.package_id)) {
      packageMap.set(row.package_id, {
        id: row.package_id,
        name: row.package_name,
        price: Number(row.package_price),
        description: row.description,
        tags: row.tags,
        icon: row.icon,
        package_type: row.package_type,
        allow_events: row.allow_events,
        count_pack_item: row.count_pack_item,
        package_status: row.package_status,
        categories: [],
      });
    }

    const pkg = packageMap.get(row.package_id);

    // Category
    let category = pkg.categories.find(
      (c: any) => c.id == row.category_id,
    );

    if (!category) {
      category = {
        id: row.category_id,
        name: row.category_name,
        icon: row.cat_icon,
        amount: row.cat_amt,
        type: row.types,
        count: row.count_number,
        items: [],
      };

      pkg.categories.push(category);
    }

    // Item
    if (
      row.item_id &&
      !category.items.some((i: any) => i.id == row.item_id)
    ) {
      category.items.push({
        id: row.item_id,
        name: row.item_name,
        price: Number(row.item_price),
        price1: Number(row.item_price_1),
        image: row.image,
        food_pre: row.food_pre,
        quantity: row.quantity,
      });
    }
  });

  return Array.from(packageMap.values());
}

async loadAllAddons(body: any, id: number) {
  const venue_ids = body; // if body is an array

  if (!Array.isArray(venue_ids) || venue_ids.length === 0) {
    return [];
  }

  const placeholders = venue_ids.map(() => "?").join(",");

  const data = await this.dataSource.query(
    `
    SELECT *
    FROM venue_addon LEFT JOIN add_ons ON add_ons.add_on_id = venue_addon.addon_id
    WHERE venue_addon.child_venue_id IN (${placeholders})
    `,
    [...venue_ids],
  );

  return data;
}
async booking_create(dto: any, id: number) {
  
  const bookingUuid = uuidv4();
  const result: any = await this.dataSource.query(
    `
    INSERT INTO bookings
    (
      booking_id,
      auto_increment,
      booking_type,
      booking_event_type_id,
      child_venue_id,
      from_date,
      to_date,
      booked_shift_type,
      booked_no_of_people,
      guest_capacity,
      total_booking_price,
      base_amount_of_hall,
      security_deposit,
      pax_tax,
      special_request,
      billing_first_name,
      billing_phone,
      billing_email,
      created_at,
      updated_at,
      created_by_,
      created_under_by
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
    [
      bookingUuid,
      dto.invoice_no,
      dto.booking_type == 'book' ? 1 : 2,
      dto.event?.event_type || null, // FIX 1

      dto.venues?.[0]?.child_venue_id || null,

      dto.event?.selection_mode === 'single'
        ? dto.event?.event_date
        : dto.event?.date_range?.start_date || null,

      dto.event?.selection_mode === 'single'
        ? dto.event?.event_date
        : dto.event?.date_range?.end_date || null,

      0,

      dto.pricing?.total_guests || 0,
      dto.event?.guest_capacity || 0,

      dto.pricing?.grand_total || 0,
      dto.pricing?.base_amount || 0,
      dto.pricing?.security_deposit || 0,
      dto.pricing?.pax_gst || 0,

      dto.special_request || null,

      dto.customer?.name || null,
      dto.customer?.phone || null,
      dto.customer?.email || null,
      new Date(),
      new Date(),
      id,
      id,
    ],
  );

  // const bookingId = result.insertId;

  // =========================
  // VENUES
  // =========================
  if (dto.venues?.length) {
    for (const venue of dto.venues) {
      await this.dataSource.query(
        `
        INSERT INTO booking_child_venue
        (booking_id, child_venue_id)
        VALUES (?,?)
        `,
        [bookingUuid, venue.child_venue_id],
      );
    }
  }

  // =========================
  // SHIFTS (FIXED STRING SAFE)
  // =========================
  if (dto.event?.shift?.length) {
    for (const shift of dto.event.shift) {
      const SHIFT_MAP = {
  morning: 1,
  afternoon: 2,
  evening: 3,
};

const shiftId = SHIFT_MAP[shift.toLowerCase()];

    if (!shiftId) continue; // skip invalid values

      await this.dataSource.query(
        `
        INSERT INTO booking_shift
        (booking_id, shift_id)
        VALUES (?,?)
        `,
        [
          bookingUuid,
          shiftId, 
        ],
      );
    }
  }

  // =========================
  // ADDONS
  // =========================
  if (dto.addons?.length) {
    for (const addon of dto.addons) {
      await this.dataSource.query(
        `
        INSERT INTO booking_addon
        (booking_id, qty, price, total)
        VALUES (?,?,?,?)
        `,
        [
          bookingUuid,
          addon.qty,
          addon.unit_price,
          addon.amount,
        ],
      );
    }
  }

  // =========================
  // SERVICE PROVIDERS
  // =========================
  if (dto.service_providers) {
    for (const [type, value] of Object.entries(dto.service_providers)) {
      if (!value) continue;

      await this.dataSource.query(
        `
        INSERT INTO booking_service_provider
        (booking_id, provider_type, provider_name)
        VALUES (?,?,?)
        `,
        [bookingUuid, type, value],
      );
    }
  }

//   await this.pushService.sendToUser(
//     id,
//     'Booking Confirmed',
//     'Your booking has been confirmed.',
//     '/bookings/' + id,
// );

  return {
    success: true,
    booking_id: bookingUuid,
  };
}

}

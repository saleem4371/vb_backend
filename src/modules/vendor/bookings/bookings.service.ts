import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { SettingGroup } from './entity/setting-group.entity';
import { Setting } from './entity/setting.entity';
import { VenueSetting } from './entity/venue-setting.entity';

import { PackageCategory } from '../../vendor/packages/entity/package-category.entity'; //entity/package-category.entity

// import { PushService } from '../../push/push.service'

// import { generateCode , total_code_generating } from 'src/common/utils/code-generator';

import {
  generateCode,
  total_code_generating,
} from '../../../common/utils/code-generator';

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

  async invoice_number(user_id: number, id: any) {
    const rows = await this.dataSource.query(
      `
    SELECT auto_increment
    FROM bookings
    WHERE created_under_by = ?
      AND auto_increment IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
      [user_id],
    );

    if (!rows || rows.length === 0) {
      return 'INV00001';
    }

    const lastNumber = parseInt(rows[0].auto_increment.replace('INV', ''), 10);

    return `INV${String(lastNumber + 1).padStart(5, '0')}`;
  }

  async load_shift_event(user_id: number, id: any) {
    const rows = await this.dataSource.query(` 
    SELECT *
    FROM booking_event_types
    WHERE status = 0`);
    return rows;
  }

  async globalSetting(user_id: number, id: any) {
    const rows = await this.dataSource.query(
      ` 
    SELECT *
    FROM venue_booking_setting
    WHERE category_id = ? AND vendor_id = ? `,
      [1, user_id],
    );
    return rows;
  }

  async availableVenues(body: any, id: number) {
    const { selectionMode, date, startDate, endDate, shifts = [] } = body;

    // Dates
    const from = selectionMode === 'single' ? startDate : startDate;
    const to = selectionMode === 'single' ? startDate : endDate;

    // Shift Mapping
    const shiftMap: Record<string, number> = {
      morning: 1,
      afternoon: 2,
      evening: 3,
      'full day': 4,
    };

    let shiftIds: number[] = [];

    if (shifts.includes('full day')) {
      shiftIds = [1, 2, 3, 4];
    } else {
      shiftIds = shifts.map((s: string) => shiftMap[s]).filter(Boolean);
    }

    if (!shiftIds.length) {
      return [];
    }

    // Total Days
    const start = new Date(from);
    const end = new Date(to);

    const totalDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const placeholders = shiftIds.map(() => '?').join(',');

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
      const timings = venue.shift_timings ? venue.shift_timings.split(',') : [];

      let shift_timing = '';

      if (timings.length > 0) {
        const firstStart = timings[0].split(' - ')[0];
        const lastEnd = timings[timings.length - 1].split(' - ')[1];

        shift_timing = `${firstStart} to ${lastEnd}`;
      }

      return {
        ...venue,

        total_days: totalDays,

        per_day_price: Number(venue.per_day_price),

        total_price: Number(venue.per_day_price) * totalDays,

        shift_names: venue.shift_names ? venue.shift_names.split(',') : [],

        child_setting: venue.child_setting
          ? JSON.parse(venue.child_setting)
          : [],

        shift_timings:
          timings.length <= 1
            ? timings
            : [timings[0], timings[timings.length - 1]],

        shift_timing,
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
      let category = pkg.categories.find((c: any) => c.id == row.category_id);

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

    const placeholders = venue_ids.map(() => '?').join(',');

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
    //
    const singular = dto.category.endsWith('s')
      ? dto.category.slice(0, -1)
      : dto.category;
    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );
    const bookingUuid = uuidv4();
    //const code = generateCode();

    let code = generateCode();
    let code_total = total_code_generating();

    while (true) {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM bookings WHERE booking_auto_id = ? LIMIT 1`,
        [code],
      );

      if (rows.length === 0) {
        break; // Unique code found
      }

      code = generateCode(); // Generate another code
    }

    const crows = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM bookings`,
    );

    const generated_code = Number(crows[0].total);

    const result: any = await this.dataSource.query(
      `
    INSERT INTO bookings
    (
      booking_id,
      booking_auto_id,
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
      created_under_by,
      category_id,
      booking_types
    )
    VALUES (?,?,?, ?, ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      [
        bookingUuid,
        code,
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
        categorys.id,
        dto.reserveType,
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
          [bookingUuid, shiftId],
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
          [bookingUuid, addon.qty, addon.unit_price, addon.amount],
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
      code_total: code_total,
      code_completed: generated_code,
      code_pending: code_total - generated_code,
    };
  }

  async all_reservations(category: any, country: any, id: number) {
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );

    const rows = await this.dataSource.query(
      `
SELECT
    b.booking_id AS id,
    b.booking_auto_id AS refNo,
    b.booking_type AS type,

CASE
    WHEN b.status = '2' THEN 'CANCELLED'

    WHEN  b.booking_types = 3 THEN 'lead'

    WHEN b.status IN ('0', '1')
         AND b.booking_type = '2'
         AND b.booking_types = 1
    THEN 'RESERVED'

    WHEN b.status IN ('0', '1')
         AND b.booking_type = '4'
         AND b.booking_types = 1
    THEN 'EXPIRED'

    WHEN b.status = '0'
         AND b.booking_type = '1'
         AND b.booking_types = 1
    THEN 'PENDING'

    WHEN b.status = '1'
         AND b.booking_type = '1'
         AND b.booking_types = 1
    THEN 'CONFIRMED' 
    
    

    ELSE 'NEW'
END AS workflowState,

    b.billing_first_name AS name,
    b.billing_email AS email,
    b.billing_phone AS phone,

    GROUP_CONCAT(
        DISTINCT vc.child_venue_name
        ORDER BY vc.child_venue_name
        SEPARATOR ', '
    ) AS venue,

    b.booked_no_of_people AS guests,
    b.total_booking_price AS amountNum,
    b.total_booking_price AS amount,
    b.from_date AS eventDate,
    b.created_at AS orderDate,

    GROUP_CONCAT(
        DISTINCT CASE
            WHEN s.shift_id = 1 THEN 'Morning'
            WHEN s.shift_id = 2 THEN 'Afternoon'
            WHEN s.shift_id = 3 THEN 'Evening'
        END
        ORDER BY s.shift_id
        SEPARATOR ', '
    ) AS shift,

    b.booking_auto_id AS source,
    b.booking_auto_id AS caterer,
    b.booking_auto_id AS decorator,
    b.booking_auto_id AS paymentStatus,
    b.booking_auto_id AS assignedStaff,
    b.base_amount_of_hall AS base_amt,

    bet.event_name AS eventType,


    CASE
    WHEN b.status = '2' THEN 'bg-red-500'

    WHEN  b.booking_types = 3 THEN 'bg-green-500'

    WHEN b.status IN ('0', '1')
         AND b.booking_type = '2'
         AND b.booking_types = 1
    THEN 'bg-pink-500'

    WHEN b.status IN ('0', '1')
         AND b.booking_type = '4'
         AND b.booking_types = 1
    THEN 'bg-blue-500'

    WHEN b.status = '0'
         AND b.booking_type = '1'
         AND b.booking_types = 1
    THEN 'bg-emerald-500'

    WHEN b.status = '1'
         AND b.booking_type = '1'
         AND b.booking_types = 1
    THEN 'bg-amber-500' 
    
    

    ELSE 'bg-violet-500'
END AS avatarColor,

    b.booking_auto_id AS tag

FROM bookings b

LEFT JOIN booking_event_types bet
    ON bet.id = b.booking_event_type_id

LEFT JOIN booking_child_venue bcv
    ON bcv.booking_id = b.booking_id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bcv.child_venue_id

LEFT JOIN booking_shift s
    ON s.booking_id = b.booking_id

WHERE b.created_under_by = ?
  AND b.category_id = ? AND b.booking_types in (1,3)

GROUP BY
    b.booking_id,
    b.booking_auto_id,
    b.booking_type,
    b.status,
    b.billing_first_name,
    b.billing_email,
    b.billing_phone,
    b.booked_no_of_people,
    b.total_booking_price,
    b.from_date,
    b.created_at,
    bet.event_name

ORDER BY b.created_at DESC
`,
      [id, categorys.id],
    );

    return rows;
}  

async all_other_reserve(category: any, country: any, id: number) {
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    const [categorys] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? limit 1`,
      [singular],
    );

    const rows = await this.dataSource.query(
      `
SELECT
    b.booking_id AS id,
    b.booking_auto_id AS refNo,
    b.booking_type AS type,

CASE
    WHEN  b.booking_types = 0 THEN 'DRAFT'
    WHEN  b.booking_types = 2 THEN 'QUOTATION'

    ELSE 'NEW'
END AS workflowState,

    b.billing_first_name AS name,
    b.billing_email AS email,
    b.billing_phone AS phone,

    GROUP_CONCAT(
        DISTINCT vc.child_venue_name
        ORDER BY vc.child_venue_name
        SEPARATOR ', '
    ) AS venue,

    b.booked_no_of_people AS guests,
    b.total_booking_price AS amountNum,
    b.total_booking_price AS amount,
    b.from_date AS eventDate,
    b.created_at AS orderDate,

    GROUP_CONCAT(
        DISTINCT CASE
            WHEN s.shift_id = 1 THEN 'Morning'
            WHEN s.shift_id = 2 THEN 'Afternoon'
            WHEN s.shift_id = 3 THEN 'Evening'
        END
        ORDER BY s.shift_id
        SEPARATOR ', '
    ) AS shift,

    b.booking_auto_id AS source,
    b.booking_auto_id AS caterer,
    b.booking_auto_id AS decorator,
    b.booking_auto_id AS paymentStatus,
    b.booking_auto_id AS assignedStaff,
    b.base_amount_of_hall AS base_amt,

    bet.event_name AS eventType,


    CASE

    WHEN  b.booking_types = 0 THEN 'bg-red-500'
    WHEN  b.booking_types = 2 THEN 'bg-green-500'

    ELSE 'bg-violet-500'

END AS avatarColor,

    b.booking_auto_id AS tag

FROM bookings b

LEFT JOIN booking_event_types bet
    ON bet.id = b.booking_event_type_id

LEFT JOIN booking_child_venue bcv
    ON bcv.booking_id = b.booking_id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bcv.child_venue_id

LEFT JOIN booking_shift s
    ON s.booking_id = b.booking_id

WHERE b.created_under_by = ?
  AND b.category_id = ? AND b.booking_types in (0,2)

GROUP BY
    b.booking_id,
    b.booking_auto_id,
    b.booking_type,
    b.status,
    b.billing_first_name,
    b.billing_email,
    b.billing_phone,
    b.booked_no_of_people,
    b.total_booking_price,
    b.from_date,
    b.created_at,
    bet.event_name

ORDER BY b.created_at DESC
`,
      [id, categorys.id],
    );

    return rows;
}

  async reservation_invoice(id: any) {
    const rows = await this.dataSource.query(
      `
SELECT
    b.booking_id AS id,
    b.booking_auto_id AS refNo,
    b.booking_type AS type,

    CASE
        WHEN b.status = '2' THEN 'CANCELLED'
        WHEN b.booking_type = 2 THEN 'RESERVED'
        WHEN b.booking_type = 4 THEN 'NEW'
        WHEN b.status = '1' THEN 'CONFIRMED'
        WHEN b.status = '0' THEN 'PENDING'
        ELSE 'NEW'
    END AS workflowState,

    b.billing_first_name AS name,
    b.billing_email AS email,
    b.billing_phone AS phone,

    GROUP_CONCAT(
        DISTINCT vc.child_venue_name
        ORDER BY vc.child_venue_name
        SEPARATOR ', '
    ) AS venue,

    b.booked_no_of_people AS guests,
    b.total_booking_price AS amountNum,
    b.total_booking_price AS amount,
    b.from_date AS eventDate,
    b.created_at AS orderDate,
b.base_amount_of_hall AS base_amt,

    GROUP_CONCAT(
        DISTINCT CASE
            WHEN s.shift_id = 1 THEN 'Morning'
            WHEN s.shift_id = 2 THEN 'Afternoon'
            WHEN s.shift_id = 3 THEN 'Evening'
        END
        ORDER BY s.shift_id
        SEPARATOR ', '
    ) AS shift,

    b.booking_auto_id AS source,
    b.booking_auto_id AS caterer,
    b.booking_auto_id AS decorator,
    b.booking_auto_id AS paymentStatus,
    b.booking_auto_id AS assignedStaff,

    bet.event_name AS eventType,

    CASE
        WHEN b.status = '2' THEN 'bg-red-500'
        WHEN b.booking_type = 2 THEN 'bg-pink-500'
        WHEN b.booking_type = 4 THEN 'bg-blue-500'
        WHEN b.status = '1' THEN 'bg-emerald-500'
        WHEN b.status = '0' THEN 'bg-amber-500'
        ELSE 'bg-violet-500'
    END AS avatarColor,

    b.booking_auto_id AS tag

FROM bookings b

LEFT JOIN booking_event_types bet
    ON bet.id = b.booking_event_type_id

LEFT JOIN booking_child_venue bcv
    ON bcv.booking_id = b.booking_id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bcv.child_venue_id

LEFT JOIN booking_shift s
    ON s.booking_id = b.booking_id

WHERE b.booking_id = ?

GROUP BY
    b.booking_id,
    b.booking_auto_id,
    b.booking_type,
    b.status,
    b.billing_first_name,
    b.billing_email,
    b.billing_phone,
    b.booked_no_of_people,
    b.total_booking_price,
    b.from_date,
    b.created_at,
    bet.event_name

ORDER BY b.created_at DESC
`,
      [id],
    );

    return rows[0];
  }

  async reservation_manage(id: any) {
    const rows = await this.dataSource.query(
      `
SELECT
    b.booking_id AS id,
    b.booking_auto_id AS refNo,
    b.booking_type AS type,

    CASE
        WHEN b.status = '2' THEN 'CANCELLED'
        WHEN b.booking_type = 2 THEN 'RESERVED'
        WHEN b.booking_type = 4 THEN 'NEW'
        WHEN b.status = '1' THEN 'CONFIRMED'
        WHEN b.status = '0' THEN 'PENDING'
        ELSE 'NEW'
    END AS workflowState,

    b.billing_first_name AS name,
    b.billing_email AS email,
    b.billing_phone AS phone,

    GROUP_CONCAT(
        DISTINCT vc.child_venue_name
        ORDER BY vc.child_venue_name
        SEPARATOR ', '
    ) AS venue,

    b.booked_no_of_people AS guests,
    b.total_booking_price AS amountNum,
    b.total_booking_price AS amount,
    b.from_date AS eventDate,
    b.created_at AS orderDate,
b.base_amount_of_hall AS base_amt,

    GROUP_CONCAT(
        DISTINCT CASE
            WHEN s.shift_id = 1 THEN 'Morning'
            WHEN s.shift_id = 2 THEN 'Afternoon'
            WHEN s.shift_id = 3 THEN 'Evening'
        END
        ORDER BY s.shift_id
        SEPARATOR ', '
    ) AS shift,

    b.booking_auto_id AS source,
    b.booking_auto_id AS caterer,
    b.booking_auto_id AS decorator,
    b.booking_auto_id AS paymentStatus,
    b.booking_auto_id AS assignedStaff,

    bet.event_name AS eventType,

    CASE
        WHEN b.status = '2' THEN 'bg-red-500'
        WHEN b.booking_type = 2 THEN 'bg-pink-500'
        WHEN b.booking_type = 4 THEN 'bg-blue-500'
        WHEN b.status = '1' THEN 'bg-emerald-500'
        WHEN b.status = '0' THEN 'bg-amber-500'
        ELSE 'bg-violet-500'
    END AS avatarColor,

    b.booking_auto_id AS tag

FROM bookings b

LEFT JOIN booking_event_types bet
    ON bet.id = b.booking_event_type_id

LEFT JOIN booking_child_venue bcv
    ON bcv.booking_id = b.booking_id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = bcv.child_venue_id

LEFT JOIN booking_shift s
    ON s.booking_id = b.booking_id

WHERE b.booking_id = ?

GROUP BY
    b.booking_id,
    b.booking_auto_id,
    b.booking_type,
    b.status,
    b.billing_first_name,
    b.billing_email,
    b.billing_phone,
    b.booked_no_of_people,
    b.total_booking_price,
    b.from_date,
    b.created_at,
    bet.event_name

ORDER BY b.created_at DESC
`,
      [id],
    );

    return rows[0];
  }

  async Load_all_venues(id: any) {
    const rows = await this.dataSource.query(
      `
    SELECT *
    FROM venue_child vc
    LEFT JOIN venue_parent vp ON vp.parent_venue_id = vc.parent_venue_id
    WHERE vc.created_by = ?  AND vp.propety_category = ? AND vc.publish_status = 0
    `,
      [id, 'venue'],
    );
    return rows;
  }

  async leads_create(dto: any, id: any) {
    //const singular = dto.category.endsWith("s") ? dto.category.slice(0, -1) : dto.category;
    //const [categorys] = await this.dataSource.query(`SELECT id FROM category WHERE name = ? limit 1`,[singular]);
    const bookingUuid = uuidv4();
    //const code = generateCode();

    let code = generateCode();
    let code_total = total_code_generating();

    while (true) {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM bookings WHERE booking_auto_id = ? LIMIT 1`,
        [code],
      );

      if (rows.length === 0) {
        break; // Unique code found
      }

      code = generateCode(); // Generate another code
    }

    const crows = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM bookings`,
    );

    const generated_code = Number(crows[0].total);

    const result: any = await this.dataSource.query(
      `
    INSERT INTO bookings
    (
      booking_id,
      booking_auto_id,
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
      created_under_by,
      category_id,
      booking_types,
      billing_address
    )
    VALUES (?,?,?, ?, ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      [
        bookingUuid,
        code,
        0,
        '0',
        dto.eventType || null, // FIX 1

        dto.venue || null,

        dto?.eventDate || null,

        dto?.eventDate,

        0,

        dto.guestCount || 0,
        dto.guestCount || 0,

        dto.budget || 0,
        dto.budget || 0,
        0,
        0,

        dto.notes || null,

        dto?.name || null,
        dto?.phone || null,
        dto?.email || null,
        new Date(),
        new Date(),
        id,
        id,
        1,
        3,
        dto?.address || null,
      ],
    );

    await this.dataSource.query(
      `
        INSERT INTO booking_child_venue
        (booking_id, child_venue_id)
        VALUES (?,?)
        `,
      [bookingUuid, dto.venue],
    );

    // =========================
    // SHIFTS (FIXED STRING SAFE)
    // =========================
    const SHIFT_MAP = {
      morning: 1,
      afternoon: 2,
      evening: 3,
    };

    const shiftId = SHIFT_MAP[dto.shift.toLowerCase()];

    await this.dataSource.query(
      `
        INSERT INTO booking_shift
        (booking_id, shift_id)
        VALUES (?,?)
        `,
      [bookingUuid, shiftId],
    );
  }

 async historical_reserve(category: any, country: any, id: number)
 {
   const singular = category.endsWith("s") ?category.slice(0, -1) : category;
    const [categorys] = await this.dataSource.query(`SELECT id FROM category WHERE name = ? limit 1`,[singular]);
   const rows = await this.dataSource.query(
  `
SELECT
    h.id,
    CONCAT('HIS-', LPAD(h.id, 6, '0')) AS refNo,

    h.book_type AS type,

    'HISTORICAL' AS workflowState,

    h.cust_name AS name,
    h.email,
    h.phone,

    CONCAT_WS(
        ' / ',
        vp.venue_name,
        vc.child_venue_name
    ) AS venue,

    h.capacity AS guests,

    h.total AS amountNum,
    h.total AS amount,

    h.book_date AS eventDate,
    h.order_date AS orderDate,

    bet.event_name AS shift,

    h.invoice_no AS source,
    h.invoice_no AS caterer,
    h.invoice_no AS decorator,

    CASE
        WHEN h.total <= (
            IFNULL(h.a_amount,0) +
            IFNULL(h.f_amount,0) +
            IFNULL(h.s_amount,0)
        )
        THEN 'PAID'
        ELSE 'PENDING'
    END AS paymentStatus,

    NULL AS assignedStaff,

    h.base_price AS base_amt,

    h.book_type AS eventType,

    'bg-blue-500' AS avatarColor,

    h.form_no AS tag

FROM historical h

LEFT JOIN venue_parent vp
    ON vp.parent_venue_id = h.parent_id

LEFT JOIN venue_child vc
    ON vc.child_venue_id = h.child_id

LEFT JOIN booking_event_types bet
    ON bet.id = h.event_id

WHERE h.vendor_id = ?

ORDER BY h.created_at DESC
`,
  [id],
);

return rows;
 }

async historical_upload(category: any, country: any, id: number, body: any) {
  const raw = Object.keys(body)[0];
  const payload = JSON.parse(raw);
  const records = payload.data;

  if (!Array.isArray(records) || records.length === 0) {
    throw new BadRequestException('No data found.');
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  

  try {
    for (const item of records) {
      const [parent] = await queryRunner.query(
        `SELECT parent_venue_id
         FROM venue_parent
         WHERE venue_name = ?
         LIMIT 1`,
        [item.parent],
      );

      const [child] = await queryRunner.query(
        `SELECT child_venue_id
         FROM venue_child
         WHERE child_venue_name = ?
         LIMIT 1`,
        [item.child],
      );

      let eventId = item.event_id;

      // If event_id contains an event name instead of an ID
      if (isNaN(Number(item.event_id))) {
        const [eventType] = await queryRunner.query(
          `SELECT id
           FROM booking_event_types
           WHERE event_name = ?
           LIMIT 1`,
          [item.event_id],
        );

        eventId = eventType?.id ?? null;
      }

      const SHIFT_MAP = {
          morning: 1,
          afternoon: 2,
          evening: 3,
        };

        const shiftId = SHIFT_MAP[item.shift.toLowerCase()];

      await queryRunner.query(
        `
        INSERT INTO historical (
          vendor_id,
          last_uploaded,
          order_date,
          parent_id,
          child_id,
          book_date,
          shift,
          from_time,
          to_time,
          event_id,
          capacity,
          form_no,
          cust_name,
          cust_address,
          phone,
          email,
          invoice_no,
          base_price,
          add_on,
          discount,
          gst,
          total,
          book_type,
          paymode,
          areceipt_no,
          a_amount,
          a_pay_mode,
          a_pay_date,
          freceipt_no,
          f_amount,
          f_pay_mode,
          f_pay_date,
          sreceipt_no,
          s_amount,
          s_pay_mode,
          s_pay_date,
          refund_sd,
          refund_date,
          others,
          created_at,
          updated_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
        )
        `,
        [
          id,
          0,
          item.order_date,
          parent?.parent_venue_id ?? null,
          child?.child_venue_id ?? null,
          item.book_date,
          shiftId,
          item.from_time,
          item.to_time,
          eventId,
          item.capacity,
          item.form_no,
          item.cust_name,
          item.cust_address,
          item.phone,
          item.email,
          item.invoice_no,
          item.base_price,
          item.add_on,
          item.discount,
          item.gst,
          item.total,
          item.book_type=='book' ? 1 : 2,
          item.paymode,
          item.areceipt_no,
          item.a_amount,
          item.a_pay_mode,
          item.a_pay_date,
          item.freceipt_no,
          item.f_amount,
          item.f_pay_mode,
          item.f_pay_date,
          item.sreceipt_no,
          item.s_amount,
          item.s_pay_mode,
          item.s_pay_date,
          item.refund_sd,
          item.refund_date || null,
          item.others,
        ],
      );
    }

    await queryRunner.commitTransaction();

    return {
      success: true,
      message: `${records.length} historical records uploaded successfully.`,
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error(error);
    throw new BadRequestException(error);
  } finally {
    await queryRunner.release();
  }
}
  
}

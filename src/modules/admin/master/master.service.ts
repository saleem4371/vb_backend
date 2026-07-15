import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LoyaltyPoint } from './entities/loyalty_point.entity';
import { LoyaltyTier } from './entities/loyalty_tiers.entity';

import { LoyaltyPointMasterItemDto } from './dto/loyalty-point-master-item.dto';
import { CreateLoyaltyTierDto } from './dto/create-loyalty-tier.dto';
import { UpdateLoyaltyTierDto } from './dto/update-loyalty-tier.dto';

@Injectable()
export class MasterService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(LoyaltyPoint)
    private loyaltyPointRepo: Repository<LoyaltyPoint>,

    @InjectRepository(LoyaltyTier)
    private loyaltyTiertRepo: Repository<LoyaltyTier>,
  ) {}

  async findAll(country_id: number) {
    try {
      const data = await this.loyaltyPointRepo.find({
        where: { country_id },
        order: { category_id: 'ASC' },
      });

      return {
        success: true,
        message: 'Loyalty data fetched successfully',
        data,
      };
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Failed to fetch loyalty data');
    }
  }

  // async create(data: LoyaltyPointMasterItemDto[], country_id: number) {
  //   try {
  //     const payload = data.map((item) => ({
  //       country_id: Number(country_id),

  //       category_id: Number(item.category_id),

  //       point_value: Number(item.points),

  //       max_point: Number(item.max_points),
  //     }));

  //     // const result = await this.loyaltyPointRepo.save(payload);
  //     const result = await this.loyaltyPointRepo.upsert(payload, {
  //       conflictPaths: ['country_id', 'category_id'],
  //     });

  //     return {
  //       success: true,
  //       message: 'Point settings saved successfully',
  //       data: result,
  //     };
  //   } catch (error) {
  //     console.log(error);

  //     throw new BadRequestException('Failed to save point settings');
  //   }
  // }

  async create(body: any, country_id: number) {
    const sql = `
    INSERT INTO loyalty_point (
      country_id,
      category_id,
      point_value,
      max_point,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      point_value = VALUES(point_value),
      max_point = VALUES(max_point),
      status = VALUES(status),
      updated_at = NOW();
  `;

    await this.dataSource.query(sql, [
      Number(country_id),
      Number(body.category_id),
      Number(body.rate),
      0,
      body.active == true ? 1 : 0,
    ]);

    return {
      success: true,
      message: 'Loyalty point saved successfully.',
    };
  }

 async createLoyalty(data: any, country_id: number) {
  try {
    const result = await this.dataSource.query(
      `
      INSERT INTO loyalty_tiers (
        country_id,
        tier_name,
        plan_id,
        category_id,
        cust_plan_id,
        color,
        icon,
        burn_coin,
        earn_point,
        discount_percentage,
        bonus_percentage,
        validity_days,
        status,
        created_at,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()
      )
      `,
      [
        Number(country_id),                        // country_id
        data.tname,                               // tier_name
        Number(data.plan_id),                     // plan_id
        Number(data.category_id),                 // category_id
        data.customers_plan,                      // cust_plan_id (Bronze/Gold/Platinum/Diamond)
        data.color,                               // color
        data.icon,                                // icon
        Number(data.min_redeem_points),           // burn_coin
        Number(data.max_spend),          // max_points
        Number(data.discount_percent || 0),       // discount_percentage
        Number(data.bonus_percent || 0),          // bonus_percentage
        Number(data.validity_days),               // validity_days
        data.status === "Active" ? 1 : 0,         // status
      ]
    );

    return {
      success: true,
      message: "Loyalty tier created successfully",
      data: result,
    };
  } catch (error) {
    console.error(error);
    throw new BadRequestException("Failed to save loyalty tier");
  }
}
  // async LoyaltyfindAll(country_id: number) {
  //   try {
  //     const data = await this.loyaltyTiertRepo.find({
  //       where: { country_id },
  //     });

  //     return {
  //       success: true,
  //       message: 'Loyalty data fetched successfully',
  //       data,
  //     };
  //   } catch (error) {
  //     console.log(error);
  //     throw new BadRequestException('Failed to fetch loyalty data');
  //   }
  // }
  async LoyaltyfindAll(country_id: number) {
  try {
    const result = await this.dataSource.query(
      `
      SELECT
          lt.id,
          lt.country_id,
          lt.tier_name,
          lt.plan_id,
          p.plan_name,
          lt.category_id,
          c.name AS category_name,
          lt.cust_plan_id,
          lt.color,
          lt.icon,
          lt.burn_coin,
          lt.earn_point,
          lt.discount_percentage,
          lt.bonus_percentage,
          lt.validity_days,
          lt.status,
          lt.created_at,
          lt.updated_at
      FROM loyalty_tiers lt
      LEFT JOIN plans p
          ON p.id = lt.plan_id
      LEFT JOIN category c
          ON c.id = lt.category_id
      WHERE lt.country_id = ?
      ORDER BY lt.id DESC
      `,
      [country_id],
    );

    return result;
  } catch (error) {
    throw error;
  }
}

  /* UPDATE */
  // async update(id: string, dto: UpdateLoyaltyTierDto) {
  //   const country = await this.loyaltyTiertRepo.findOne({
  //     where: { id: Number(id) },
  //   });

  //   if (!country) {
  //     throw new BadRequestException('Country not found');
  //   }

  //   Object.assign(country, dto);

  //   return await this.loyaltyTiertRepo.save(country);
  // }
  async update(id: string, data: any) {
  try {
    const result = await this.dataSource.query(
      `
      UPDATE loyalty_tiers
      SET
        tier_name = ?,
        plan_id = ?,
        category_id = ?,
        cust_plan_id = ?,
        color = ?,
        icon = ?,
        burn_coin = ?,
        earn_point = ?,
        discount_percentage = ?,
        bonus_percentage = ?,
        validity_days = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        data.tname,                                  // tier_name
        Number(data.plan_id),                        // plan_id
        Number(data.category_id),                    // category_id
        data.customers_plan,                         // cust_plan_id
        data.color,                                  // color
        data.icon,                                   // icon
        Number(data.min_redeem_points),              // burn_coin
        Number(data.max_spend),                      // earn_point
        Number(data.discount_percent || 0),          // discount_percentage
        Number(data.bonus_percent || 0),             // bonus_percentage
        Number(data.validity_days),                  // validity_days
        data.status === 'Active' ? 1 : 0,            // status
        Number(id),                                  // WHERE id
      ],
    );

    return {
      success: true,
      message: 'Loyalty tier updated successfully.',
      data: result,
    };
  } catch (error) {
    console.log(error);
    throw new BadRequestException('Failed to update loyalty tier');
  }
}

  /* DELETE */
  // async remove(id: string) {
  //   const country = await this.loyaltyTiertRepo.findOne({
  //     where: { id: Number(id) },
  //   });

  //   if (!country) {
  //     throw new BadRequestException('Country not found');
  //   }

  //   return await this.loyaltyTiertRepo.remove(country);
  // }

  async remove(id: string) {
  try {
    // Check if record exists
    const [tier] = await this.dataSource.query(
      `
      SELECT id
      FROM loyalty_tiers
      WHERE id = ?
      LIMIT 1
      `,
      [Number(id)],
    );

    if (!tier) {
      throw new BadRequestException('Loyalty tier not found');
    }

    // Delete record
    await this.dataSource.query(
      `
      DELETE FROM loyalty_tiers
      WHERE id = ?
      `,
      [Number(id)],
    );

    return {
      success: true,
      message: 'Loyalty tier deleted successfully.',
    };
  } catch (error) {
    console.log(error);
    throw new BadRequestException('Failed to delete loyalty tier');
  }
}

  /* plans */
  async plans(country_id: number, category_id: any) {
    const sql = `SELECT * FROM plans WHERE country_id = ?  AND category_id = ? `;

    const plans = await this.dataSource.query(sql, [country_id, category_id]);

    return plans;
  }

  // ✅ FIND ONE
  // async findOne(id: number) {
  //   const category = await this.categoryRepo.findOne({
  //     where: { id },
  //     relations: ["venueCategories"],
  //   });

  //   if (!category) {
  //     throw new NotFoundException("Category not found");
  //   }

  //   return category;
  // }

async getIntegrationConfig(countryId?: number) {
  const rows = await this.dataSource.query(
    `
    SELECT
      i.id,
      i.name,
      i.name AS title,
      i.name AS description,
      i.name AS icon,

      ic.country_id,
      ic.environment,
      ic.is_active,
      ic.config_key,
      ic.config_value

    FROM integrations i

    LEFT JOIN integration_configs ic
      ON ic.integration_id = i.id
      AND (
            ic.country_id = ?
            OR (
                ic.country_id IS NULL
                AND NOT EXISTS (
                    SELECT 1
                    FROM integration_configs x
                    WHERE x.integration_id=i.id
                    AND x.country_id=?
                )
            )
      )

    ORDER BY
      i.id,
      ic.country_id,
      ic.environment
    `,
    [countryId, countryId],
  );

  const integrations = {};

  for (const row of rows) {
    if (!integrations[row.id]) {
      integrations[row.id] = {
        id: row.id,
        key: row.name,
        title: row.title,
        description: row.description,
        icon: row.icon,
        fields: [],
        country_configs: {},
      };
    }

    if (row.config_key && !integrations[row.id].fields.includes(row.config_key)) {
      integrations[row.id].fields.push(row.config_key);
    }

    const countryKey = row.country_id ?? "ALL";

    if (!integrations[row.id].country_configs[countryKey]) {
      integrations[row.id].country_configs[countryKey] = {
        country_id: row.country_id,
        enabled: false,
        mode: "TEST",
        test: {},
        live: {},
      };
    }

    const cfg = integrations[row.id].country_configs[countryKey];

    // Active environment
    if (row.is_active == 1) {
      cfg.enabled = true;
      cfg.mode = row.environment;
    }

    if (row.environment === "TEST") {
      cfg.test[row.config_key] = row.config_value;
    } else if (row.environment === "LIVE") {
      cfg.live[row.config_key] = row.config_value;
    }
  }

  return Object.values(integrations).map((item: any) => ({
    ...item,
    country_configs: Object.values(item.country_configs),
  }));
}
}

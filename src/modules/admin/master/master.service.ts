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

  async create(data: LoyaltyPointMasterItemDto[], country_id: number) {
    try {
      const payload = data.map((item) => ({
        country_id: Number(country_id),

        category_id: Number(item.category_id),

        point_value: Number(item.points),

        max_point: Number(item.max_points),
      }));

      // const result = await this.loyaltyPointRepo.save(payload);
      const result = await this.loyaltyPointRepo.upsert(payload, {
        conflictPaths: ['country_id', 'category_id'],
      });

      return {
        success: true,
        message: 'Point settings saved successfully',
        data: result,
      };
    } catch (error) {
      console.log(error);

      throw new BadRequestException('Failed to save point settings');
    }
  }

  async createLoyalty(data: CreateLoyaltyTierDto, country_id: number) {
    try {
      const payload = {
        country_id: Number(country_id),

        tier_name: data.tier_name,

        min_points: Number(data.min_points),

        max_points: Number(data.max_points),

        discount_percentage: Number(data.discount_percentage),

        bonus_percentage: Number(data.bonus_percentage || 0),

        validity_days: Number(data.validity_days),

        status: 1,
      };

      const result = await this.loyaltyTiertRepo.save(payload);

      return {
        success: true,
        message: 'Point settings saved successfully',
        data: result,
      };
    } catch (error) {
      console.log(error);

      throw new BadRequestException('Failed to save point settings');
    }
  }
  async LoyaltyfindAll(country_id: number) {
    try {
      const data = await this.loyaltyTiertRepo.find({
        where: { country_id },
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

   /* UPDATE */
    async update(id: string, dto: UpdateLoyaltyTierDto) {
  
      const country = await this.loyaltyTiertRepo.findOne({
        where: { id: Number(id) },
      });
  
      if (!country) {
        throw new BadRequestException("Country not found");
      }
  
      Object.assign(country, dto);
  
      return await this.loyaltyTiertRepo.save(country);
    }
  
    /* DELETE */
    async remove(id: string) {
  
      const country = await this.loyaltyTiertRepo.findOne({
       where: { id: Number(id) }
      });
  
      if (!country) {
        throw new BadRequestException("Country not found");
      }
  
      return await this.loyaltyTiertRepo.remove(country);
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
}

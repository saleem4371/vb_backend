import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Body,
  Headers,
  BadRequestException,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';
import { LoyaltyPointMasterItemDto } from './dto/loyalty-point-master-item.dto';
import { CreateLoyaltyTierDto } from './dto/create-loyalty-tier.dto';
import { UpdateLoyaltyTierDto } from './dto/update-loyalty-tier.dto';
import { MasterService } from './master.service';

@Controller('admin/master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // ✅ GET ALL
  // @Get('savePointMasterApi')
  // findAll(@Query() query: any) {
  //   return this.masterService.findAll(query);
  // }
  @Post('savePointMasterApi')
  create(
    @Body() data: LoyaltyPointMasterItemDto[],
    @Headers('x-country') country_id: number,
  ) {
    return this.masterService.create(data, country_id);
  }

  @Get('getPointMasterApi')
  findAll(@Headers('x-country') country_id: number) {
    return this.masterService.findAll(country_id);
  }
  
  @Get('LoyaltyPointApi')
  LoyaltyfindAll(@Headers('x-country') country_id: number) {
    return this.masterService.LoyaltyfindAll(country_id);
  }

  @Post('LoyaltyPointSaveApi')
  createLoyalty(
    @Body() data: CreateLoyaltyTierDto,
    @Headers('x-country') country_id: number,
  ) {
    return this.masterService.createLoyalty(data, country_id);
  }

   @Put("LoyaltyPointUpdateApi/:id")
    update(@Param("id") id: string, @Body() dto: UpdateLoyaltyTierDto) {
      return this.masterService.update(id, dto);
    }
  
    /* DELETE */
    @Delete("deleteLoyaltyPointApi/:id")
    remove(@Param("id") id: string) {
      return this.masterService.remove(id);
    }

}

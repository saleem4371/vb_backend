import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';

import { ListedVendorService } from './listed_vendor.service';

@Controller('admin/listed_vendor')
export class ListedVendorController {
  constructor(private readonly listedVendorService: ListedVendorService) {}

  // ✅ GET ALL
  @Get('all_vendor')
  findAll(@Query() query: any) {
    return this.listedVendorService.findAll(query);
  }
}
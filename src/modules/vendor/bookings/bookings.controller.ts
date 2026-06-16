import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { BookingsService } from './bookings.service';
@Controller('booking')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('InvoiceNOAPI')
  invoice_number(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bookingsService.invoice_number(user?.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('load_shift_event')
  load_shift_event(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bookingsService.load_shift_event(user?.id, id);
  }
  @UseGuards(JwtAuthGuard)
  @Post('available-venues')
  async availableVenues(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.availableVenues(body, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('Load_all_packages')
  async Load_all_packages(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.Load_all_packages(body, user?.id);
  }
  
  @UseGuards(JwtAuthGuard)
  @Post('loadAllAddons')
  async loadAllAddons(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.loadAllAddons(body, user?.id);
  } 
  
  @UseGuards(JwtAuthGuard)
  @Post('globalSetting')
  async globalSetting(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.globalSetting( user?.id,body);
  }
  
  @UseGuards(JwtAuthGuard)
  @Post('booking_create')
  async booking_create(@Body() body: any, @CurrentUser() user: any) {
    return await this.bookingsService.booking_create(body, user?.id);
  }
}

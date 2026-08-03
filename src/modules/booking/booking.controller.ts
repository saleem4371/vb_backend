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
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

import { BookingService } from './booking.service';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile_main_page')
  profile_main_page(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.bookingService.profile_main_page(userId);
  } 
  
  @UseGuards(JwtAuthGuard)
  @Get('allbookingData')
  allbookingData(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.bookingService.allbookingData(userId);
  }
 @UseGuards(JwtAuthGuard)
  @Post('editBookingRequest')
async editRequest(
  @Body() body: any,
  @Req() req: any,
) {
  return await this.bookingService.editRequest(body, req.user.id);
}
}

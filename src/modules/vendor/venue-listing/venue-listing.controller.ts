import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Patch,
  Query,
  Put,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';

import { VenueListingService } from './venue-listing.service';

@Controller('venue-listing')
export class VenueListingController {
  constructor(private readonly venueListingService: VenueListingService) {}

  @Get('venue')
  getHome() {
    return this.venueListingService.getListData();
  }
}

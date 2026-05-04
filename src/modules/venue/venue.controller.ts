import { Controller, Post, Body } from '@nestjs/common';
import { VenueService } from './venue.service';
import { VenueFilterDto } from './dto/VenueFilterDto.dto';

@Controller('listing')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  getVenues(@Body() filters: VenueFilterDto) {
    return this.venueService.getVenuesPageData(filters);
  }
}
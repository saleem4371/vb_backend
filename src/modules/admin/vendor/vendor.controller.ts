import { Body, Controller, Post, Req ,UseGuards, Get} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { VendorService } from './vendor.service';
@Controller('admin/vendor')
export class VendorController {
    constructor(private readonly vendorService: VendorService) {}

        @Get('amenities')
        getMe(@Req() req) {
          return this.vendorService.GetAmenities();
          // return req.user; // 🔥 comes from JwtStrategy
        }

}

import { Module } from '@nestjs/common';
import { VenueListingController } from './venue-listing.controller';
import { VenueListingService } from './venue-listing.service';
import { VenueChild } from '../../../modules/listing/entities/venue-child.entity';
import { TypeOrmModule } from "@nestjs/typeorm";
import { SocketModule } from '../../socket/socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VenueChild,
      SocketModule
    ]),
  ]
  controllers: [VenueListingController],
  providers: [VenueListingService],
   
})
export class VenueListingModule {}

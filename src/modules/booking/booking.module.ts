import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { NotificationModule } from '../../notifications/notification.module'

@Module({
   imports: [
      NotificationModule,
    
      ],
  providers: [BookingService],
  exports: [BookingService],
  controllers: [BookingController],
})
export class BookingModule {}


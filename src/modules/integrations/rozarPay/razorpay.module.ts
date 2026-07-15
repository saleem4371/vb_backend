import { Module } from '@nestjs/common';
import { RazorpayService } from './razorpay.service';
import { RazorpayController } from './razorpay.controller';
import { IntegSettingsModule } from '../integSettings/integSettings.module';
import { HttpModule } from '@nestjs/axios';

@Module({
   imports: [
    HttpModule,
    IntegSettingsModule,
  ],
  controllers: [RazorpayController], // <-- ADD THIS
  providers: [RazorpayService],
  exports: [RazorpayService],
})
export class StripeModule {}
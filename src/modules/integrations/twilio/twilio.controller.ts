import { Body, Controller, Post,Get } from '@nestjs/common';
import { TwilioService } from './twilio.service';

@Controller('twilio')
export class TwilioController {
  constructor(private readonly twilioService: TwilioService) {}

  @Get('sms')
  async sendSMS(@Body() body: any) {
    return await this.twilioService.sendSMS(
     // body.to,
     // body.message,
     "+917760384559",
     "Welcome to venuebook.in."
    );
  }

@Get('whatsapp')
async sendWhatsApp(@Body() body: any) {
  return await this.twilioService.sendWhatsApp({
    // to: body.to,
    // body: body.message,
    to:"+917760384559",
     body: 'Thank you for your booking! Your abc booking has been received successfully'});
}
}
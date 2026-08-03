import { Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private client: Twilio;

  constructor() {
    this.client = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendSMS(to: string, body: string) {
    return await this.client.messages.create({
      body,
      from: process.env.TWILIO_PHONE,
      to,
    });
  }

 async sendWhatsApp({to,body}: {
  to: any;
  body: any;
}) {
  return this.client.messages.create({
   from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${to}`,
    body,
  });
}
}
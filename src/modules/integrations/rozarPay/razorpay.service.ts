import { Injectable, BadRequestException } from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';

import Razorpay from 'razorpay';
import * as crypto from 'crypto';

import dayjs from 'dayjs';

@Injectable()
export class RazorpayService {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private readonly dataSource: DataSource,
  ) {}

 async subscription(body: any, userId: number, countryId: number) {
  try {

    const [plan] = await this.dataSource.query(
      `SELECT * FROM plans WHERE id=? LIMIT 1`,
      [body.selectedPlan],
    );

    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const [user] = await this.dataSource.query(
      `SELECT * FROM users WHERE id=? LIMIT 1`,
      [userId],
    );

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const config = await this.integrationService.getIntegrationConfig(
      'razorpay',
    );
 const configData = typeof config === 'string' ? JSON.parse(config) : config;
    const razorpay = new Razorpay({
      key_id: configData.key_id,
      key_secret: configData.key_secret,
    });

    /**
     * plan.plan_id must contain Razorpay Plan Id
     * Example:
     * plan_PjN7fdxxxxxxxx
     */

    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.plan_id,
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
      notes: {
        user_id: String(userId),
        plan_id: String(plan.id),
      },
    });

    const subscriptionCode = `SUB_${Date.now()}`;

    await this.dataSource.query(
      `
      INSERT INTO user_subscriptions
      (
        user_id,
        country_id,
        plan_id,
        subscription_code,
        subscription_id,
        status,
        created_at,
        updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, 'pending', NOW(), NOW())
      `,
      [
        userId,
        countryId,
        plan.id,
        subscriptionCode,
        subscription.id,
      ],
    );

    return {
      success: true,
      subscription_id: subscription.id,
      razorpay_key: configData.key_id,
    };
  } catch (e) {
    console.log(e);

    throw new BadRequestException(
      'Unable to create Razorpay subscription',
    );
  }
}

async verifySubscription(subscriptionId: string) {

   const config =
      await this.integrationService.getIntegrationConfig('razorpay');
 const configData = typeof config === 'string' ? JSON.parse(config) : config;
   const razorpay = new Razorpay({
      key_id: configData.key_id,
      key_secret: configData.key_secret,
   });

   const subscription =
      await razorpay.subscriptions.fetch(subscriptionId);

   return {
      success: true,
      subscription_id: subscription.id,
      status: subscription.status,
      current_start: subscription.current_start,
      current_end: subscription.current_end,
      charge_at: subscription.charge_at,
      total_count: subscription.total_count,
      paid_count: subscription.paid_count,
   };
}
 async verifyPayment(body: any,id:any) {

   const config =
      await this.integrationService.getIntegrationConfig('razorpay');

       const configData = typeof config === 'string' ? JSON.parse(config) : config;

   const expected = crypto
      .createHmac('sha256', configData.key_secret)
      .update(
         body.razorpay_payment_id +
         "|" +
         body.razorpay_subscription_id,
      )
      .digest('hex');

   if (expected !== body.razorpay_signature) {
      throw new BadRequestException(
         'Invalid Signature',
      );
   }

   await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
      status='active',
      updated_at=NOW()
      WHERE subscription_id=?
      `,
      [body.razorpay_subscription_id],
   );

   return {
      success: true,
      message: 'Subscription Activated',
   };
}
}

import { Injectable, BadRequestException , Logger,} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';

import Razorpay from 'razorpay';
import * as crypto from 'crypto';

import dayjs from 'dayjs';
import axios from 'axios';

import { InvoiceService } from '../../invoice/invoice.service'
import { SocketService } from '../../socket/socket.service';
import { NotificationService } from '../../../notifications/notification.service';

import {
  generateCode
} from '../../../common/utils/code-generator';

import { ZohoService } from '../../integrations/zoho/zoho.service';
import { TwilioService } from '../../integrations/twilio/twilio.service';

@Injectable()
export class RazorpayService {
  private readonly logger =
    new Logger(RazorpayService.name);

  constructor(
     private readonly socketService: SocketService,
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private readonly dataSource: DataSource,
    private readonly zohoService: ZohoService,
    private readonly twilioService: TwilioService,
   

     private invoiceService: InvoiceService,
    private readonly notificationService: NotificationService,
  ) {}

  // async subscription(body: any, userId: number, countryId: number) {
  //   try {
  //     const [plan] = await this.dataSource.query(
  //       `SELECT * FROM plans WHERE plan_id= ? LIMIT 1`,
  //       [body.selectedPlan],
  //     );

  //     if (!plan) {
  //       throw new BadRequestException('Plan not found');
  //     }

  //     const [user] = await this.dataSource.query(
  //       `SELECT * FROM users WHERE id=? LIMIT 1`,
  //       [userId],
  //     );

  //     if (!user) {
  //       throw new BadRequestException('User not found');
  //     }

  //     const config =
  //       await this.integrationService.getIntegrationConfig('razorpay');
  //     const configData =
  //       typeof config === 'string' ? JSON.parse(config) : config;
  //     const razorpay = new Razorpay({
  //       key_id: configData.key_id,
  //       key_secret: configData.key_secret,
  //     });

     
  //     const subscription = await razorpay.subscriptions.create({
  //       plan_id:plan.plan_id,
  //       total_count: 12,
  //       quantity: body.quantity,
  //       customer_notify: 1,
  //     });

  //     const subscriptionCode = `SUB_${Date.now()}`;

  //     // await this.dataSource.query(
  //     //   `
  //     // INSERT INTO user_subscriptions
  //     // (
  //     //   user_id,
  //     //   country_id,
  //     //   plan_id,
  //     //   subscription_code,
  //     //   subscription_id,
  //     //   status,
  //     //   created_at,
  //     //   updated_at
  //     // )
  //     // VALUES
  //     // (?, ?, ?, ?, ?, 'pending', NOW(), NOW())
  //     // `,
  //     //   [userId, countryId, plan.id, subscriptionCode, subscription.id],
  //     // );
  //      // =========================================================
  //   // 10. Save subscription in VenueBook
  //   // =========================================================
  //   await this.dataSource.query(
  //     `
  //     INSERT INTO user_subscriptions
  //     (
  //       user_id,
  //       country_id,
  //       plan_id,
  //       razorpay_plan_id,

  //       subscription_code,
  //       subscription_id,

  //       quantity,
  //       price_per_unit,
  //       gst_rate,
  //       gst_amount,
  //       current_amount,
  //       total_amount,

  //       start_date,
  //       next_billing_date,
  //       end_date,

  //       total_count,
  //       paid_count,

  //       auto_renew,
  //       status,
  //       razorpay_status,

  //       payment_method,
  //       webhook_status,

  //       created_at,
  //       updated_at
  //     )
  //     VALUES
  //     (
  //       ?, ?, ?, ?,
  //       ?, ?,
  //       ?, ?, ?, ?, ?, ?,
  //       ?, ?, ?,
  //       ?, ?,
  //       1,
  //       'pending',
  //       ?,
  //       NULL,
  //       'pending',
  //       NOW(),
  //       NOW()
  //     )
  //     `,
  //     [
  //       userId,
  //       countryId,
  //       plan.id,
  //       plan.plan_id,

  //       subscriptionCode,
  //       subscription.id,

  //       body.quantity,
  //       pricePerVenue,
  //       gstRate,
  //       gstAmount,
  //       baseAmount,
  //       totalAmount,

  //       startDate,
  //       nextBillingDate,
  //       endDate,

  //       subscription.total_count || 12,
  //       subscription.paid_count || 0,

  //       subscription.status || 'created',
  //     ],
  //   );

  //     return {
  //     success: true,
  //     key_id: configData.key_id,
  //     subscription_id: subscription.id,
  //     url: subscription.short_url,
  //   };
  //   } catch (e) {
  //     console.log(e);

  //     throw new BadRequestException('Unable to create Razorpay subscription');
  //   }
  // }
//   async subscription(
//   body: any,
//   userId: number,
//   countryId: number,
// ) {
//   try {
//     // =========================================================
//     // 1. Validate quantity
//     // =========================================================
//     const quantity = Number(body.quantity);

//     if (!Number.isInteger(quantity) || quantity < 1) {
//       throw new BadRequestException(
//         'Quantity must be a valid number greater than 0',
//       );
//     }

//     // =========================================================
//     // 2. Get VenueBook plan
//     // =========================================================
//     const [plan] = await this.dataSource.query(
//       `
//       SELECT *
//       FROM plans
//       WHERE plan_id = ?
//       LIMIT 1
//       `,
//       [body.selectedPlan],
//     );

//     if (!plan) {
//       throw new BadRequestException('Plan not found');
//     }

//     // =========================================================
//     // 3. Get user
//     // =========================================================
//     const [user] = await this.dataSource.query(
//       `
//       SELECT *
//       FROM users
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [userId],
//     );

//     if (!user) {
//       throw new BadRequestException('User not found');
//     }

//     // =========================================================
//     // 4. Pricing
//     //
//     // ₹199 = base price per venue
//     // GST   = 18%
//     // Total = ₹234.82 per venue
//     // =========================================================

//     const pricePerVenue = plan.amounts;
//     const gstRate = 18.00;

//     const baseAmount = Number(
//       (pricePerVenue * quantity).toFixed(2),
//     );

//     const gstAmount = Number(
//       ((baseAmount * gstRate) / 100).toFixed(2),
//     );

//     const totalAmount = Number(
//       (baseAmount + gstAmount).toFixed(2),
//     );

//     // =========================================================
//     // 5. Get Razorpay configuration
//     // =========================================================
//     const config =
//       await this.integrationService.getIntegrationConfig(
//         'razorpay',
//       );

//     const configData =
//       typeof config === 'string'
//         ? JSON.parse(config)
//         : config;

//     if (
//       !configData?.key_id ||
//       !configData?.key_secret
//     ) {
//       throw new BadRequestException(
//         'Razorpay configuration is missing',
//       );
//     }

//     // =========================================================
//     // 6. Initialize Razorpay
//     // =========================================================
//     const razorpay = new Razorpay({
//       key_id: configData.key_id,
//       key_secret: configData.key_secret,
//     });

//     // =========================================================
//     // 7. Create Razorpay subscription
//     //
//     // IMPORTANT:
//     // Razorpay charges:
//     //
//     //     Plan Amount × Quantity
//     //
//     // Therefore the Razorpay Plan should be ₹234.82
//     // if you want ₹199 + 18% GST to be charged automatically.
//     // =========================================================
//     const subscription =
//       await razorpay.subscriptions.create({
//         plan_id: plan.plan_id,
//         total_count: 12,
//         quantity,
//         customer_notify: 1,
//       });

//     // =========================================================
//     // 8. Generate internal subscription code
//     // =========================================================
//     const subscriptionCode =
//       `SUB_${Date.now()}_${userId}`;

//     // =========================================================
//     // 9. Convert Razorpay timestamps
//     // =========================================================
//     const startDate = subscription.start_at
//       ? new Date(subscription.start_at * 1000)
//       : null;

//     const nextBillingDate = subscription.charge_at
//       ? new Date(subscription.charge_at * 1000)
//       : null;

//     const endDate = subscription.end_at
//       ? new Date(subscription.end_at * 1000)
//       : null;

//     // =========================================================
//     // 10. Save subscription in VenueBook
//     // =========================================================
//     await this.dataSource.query(
//       `
//       INSERT INTO user_subscriptions
//       (
//         user_id,
//         country_id,
//         plan_id,
//         razorpay_plan_id,

//         subscription_code,
//         subscription_id,

//         quantity,
//         price_per_unit,
//         gst_rate,
//         gst_amount,
//         current_amount,
//         total_amount,

//         start_date,
//         next_billing_date,
//         end_date,

//         total_count,
//         paid_count,

//         auto_renew,
//         status,
//         razorpay_status,

//         payment_method,
//         webhook_status,

//         created_at,
//         updated_at
//       )
//       VALUES
//       (
//         ?, ?, ?, ?,
//         ?, ?,
//         ?, ?, ?, ?, ?, ?,
//         ?, ?, ?,
//         ?, ?,
//         1,
//         'pending',
//         ?,
//         NULL,
//         'pending',
//         NOW(),
//         NOW()
//       )
//       `,
//       [
//         userId,
//         countryId,
//         plan.id,
//         plan.plan_id,

//         subscriptionCode,
//         subscription.id,

//         quantity,
//         pricePerVenue,
//         gstRate,
//         gstAmount,
//         baseAmount,
//         totalAmount,

//         startDate,
//         nextBillingDate,
//         endDate,

//         subscription.total_count || 12,
//         subscription.paid_count || 0,

//         subscription.status || 'created',
//       ],
//     );

//     // =========================================================
//     // 11. Return response
//     // =========================================================
//     return {
//       success: true,

//       key_id: configData.key_id,

//       subscription_id: subscription.id,

//       subscription_code: subscriptionCode,

//       plan_id: plan.plan_id,

//       quantity,

//       pricing: {
//         price_per_venue: pricePerVenue,
//         base_amount: baseAmount,
//         gst_rate: gstRate,
//         gst_amount: gstAmount,
//         total_amount: totalAmount,
//         currency: 'INR',
//       },

//       status: subscription.status,

//       start_date: startDate,

//       next_billing_date: nextBillingDate,

//       end_date: endDate,

//       short_url: subscription.short_url,
//     };
//   } catch (error) {
//     // =========================================================
//     // Log actual Razorpay error
//     // =========================================================
//     console.error(
//       'Razorpay subscription creation failed:',
//       error,
//     );

//     if (error instanceof BadRequestException) {
//       throw error;
//     }

//     throw new BadRequestException(
//       error ||
//         'Unable to create Razorpay subscription',
//     );
//   }
// }

//   async subscription(
//   body: any,
//   userId: number,
//   countryId: number,
// ) {
//   try {
//     // =========================================================
//     // 1. Validate quantity
//     // =========================================================

//     const quantity = Number(body.quantity);

//     if (!Number.isInteger(quantity) || quantity < 1) {
//       throw new BadRequestException(
//         'Quantity must be a valid number greater than 0',
//       );
//     }

//     // =========================================================
//     // 2. Get VenueBook plan
//     // =========================================================

//     const [plan] = await this.dataSource.query(
//       `
//       SELECT *
//       FROM plans
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [body.selectedPlan],
//     );

//     if (!plan) {
//       throw new BadRequestException(
//         'Plan not found',
//       );
//     }

//     // =========================================================
//     // 3. Get user
//     // =========================================================

//     const [user] = await this.dataSource.query(
//       `
//       SELECT
//         id,
//         name,
//         email,
//         phone
//       FROM users
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [userId],
//     );

//     if (!user) {
//       throw new BadRequestException(
//         'User not found',
//       );
//     }

//     // =========================================================
//     // 4. Calculate pricing
//     // =========================================================

//     const pricePerVenue = Number(plan.amount);

//     if (
//       !Number.isFinite(pricePerVenue) ||
//       pricePerVenue <= 0
//     ) {
//       throw new BadRequestException(
//         'Invalid plan amount',
//       );
//     }

//     const gstRate = 18;

//     const baseAmount = Number(
//       (pricePerVenue * quantity).toFixed(2),
//     );

//     const gstAmount = Number(
//       ((baseAmount * gstRate) / 100).toFixed(2),
//     );

//     const totalAmount = Number(
//       (baseAmount + gstAmount).toFixed(2),
//     );

//     // =========================================================
//     // 5. Razorpay configuration
//     // =========================================================

//     const config =
//       await this.integrationService.getIntegrationConfig(
//         'razorpay',
//       );

//     const configData =
//       typeof config === 'string'
//         ? JSON.parse(config)
//         : config;

//     const keyId =
//       String(configData?.key_id || '').trim();

//     const keySecret =
//       String(configData?.key_secret || '').trim();

//     if (!keyId || !keySecret) {
//       throw new BadRequestException(
//         'Razorpay configuration is missing',
//       );
//     }

//     // =========================================================
//     // 6. Initialize Razorpay
//     // =========================================================

//     const razorpay = new Razorpay({
//       key_id: keyId,
//       key_secret: keySecret,
//     });

//     // =========================================================
//     // 7. Generate internal reference
//     // =========================================================

//     const subscriptionCode =
//       `SUB_${Date.now()}_${userId}`;

//     // =========================================================
//     // 8. Create Payment Link
//     // =========================================================

//     const paymentLink =
//       await razorpay.paymentLink.create({
//         amount: Math.round(totalAmount * 100),

//         currency: 'INR',

//         accept_partial: false,

//         description:
//           `Venuebook ${plan.plan_name} Subscription`,

//         reference_id: subscriptionCode,

//         customer: {
//           name: user.name,
//           email: user.email,
//           contact: user.phone,
//         },

//         expire_by:
//           Math.floor(Date.now() / 1000) +
//           24 * 60 * 60,

//         notify: {
//           sms: true,
//           email: true,
//         },

//         reminder_enable: true,

//         notes: {
//           user_id: String(user.id),
//           plan_id: String(plan.id),
//           category_id: String(
//             body.categoryId || 0,
//           ),
//           country_id: String(countryId),
//           quantity: String(quantity),
//           subscription_code: subscriptionCode,
//           base_amount: String(baseAmount),
//           gst_amount: String(gstAmount),
//           total_amount: String(totalAmount),
//         },

//         callback_url:
//           `${process.env.APP_URL}/payment/razorpay/callback`,

//         callback_method: 'get',
//       });

//     // =========================================================
//     // 9. Save local subscription/payment record
//     // =========================================================

//     const [insertResult] =
//       await this.dataSource.query(
//         `
//         INSERT INTO user_subscriptions
//         (
//           user_id,
//           country_id,
//           category_id,
//           plan_id,

//           subscription_code,

//           quantity,
//           price_per_unit,

//           gst_rate,
//           gst_amount,

//           current_amount,
//           total_amount,

//           start_date,
//           next_billing_date,

//           auto_renew,

//           status,
//           payment_status,

//           payment_Razorpay Payment Link creation failed: TypeError: (intermediate value) is not iterable
//     at RazorpayService.subscription (/home/syfte/Syfte/International/vb backend/src/modules/integrations/rozarPay/razorpay.service.ts:667:7)
//     at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
// [Nest] 44247  - 08/24/2026, 1:10:35 PM   ERROR [ExceptionsHandler] TypeError: (intermediate value) is not iterable
//     at RazorpayService.subscription (/home/syfte/Syfte/International/vb backend/src/modules/integrations/rozarPay/razorpay.service.ts:667:7)
//     at process.processTicksAndRejections (node:internal/process/task_queues:104:5)link_id,
//           payment_link_url,

//           created_at,
//           updated_at
//         )
//         VALUES
//         (
//           ?, ?, ?, ?,
//           ?,
//           ?, ?,
//           ?, ?,
//           ?, ?,
//           NULL,
//           NULL,
//           0,
//           'pending',
//           'pending',
//           ?,
//           ?,
//           NOW(),
//           NOW()
//         )
//         `,
//         [
//           userId,
//           countryId,
//           body.categoryId || 1,
//           plan.id,

//           subscriptionCode,

//           quantity,
//           pricePerVenue,

//           gstRate,
//           gstAmount,

//           baseAmount,
//           totalAmount,

//           paymentLink.id,
//           paymentLink.short_url,
//         ],
//       );

//     // =========================================================
//     // 10. Update Payment Link notes with local ID
//     // =========================================================

//     // We don't need to update Razorpay here.
//     // The local subscription ID can be obtained using
//     // reference_id / payment_link_id in webhook.

//     // =========================================================
//     // 11. Return response
//     // =========================================================

//     return {
//       success: true,

//       message:
//         'Razorpay Payment Link created successfully',

//       key_id: keyId,

//       subscription: {
//         id: insertResult?.insertId || null,
//         subscription_code: subscriptionCode,

//         status: 'pending',

//         payment_link_id:
//           paymentLink.id,

//         payment_link_url:
//           paymentLink.short_url,
//       },

//       pricing: {
//         price_per_venue: pricePerVenue,
//         quantity,

//         base_amount: baseAmount,

//         gst_rate: gstRate,

//         gst_amount: gstAmount,

//         total_amount: totalAmount,

//         currency: 'INR',
//       },
//     };
//   } catch (error) {
//     console.error(
//       'Razorpay Payment Link creation failed:',
//       error,
//     );

//     if (
//       error instanceof BadRequestException
//     ) {
//       throw error;
//     }

//     throw new BadRequestException(
//       error,
//       'Unable to create Razorpay Payment Link',
//     );
//   }
// }

// async subscription(
//   body: any,
//   userId: number,
//   countryId: number,
// ) {
//   try {
//     // =========================================================
//     // 1. Validate quantity
//     // =========================================================

//     const quantity = Number(body.quantity);

//     if (!Number.isInteger(quantity) || quantity < 1) {
//       throw new BadRequestException(
//         'Quantity must be a valid number greater than 0',
//       );
//     }

//     // =========================================================
//     // 2. Get VenueBook plan
//     // =========================================================

//     const [plan] = await this.dataSource.query(
//       `
//       SELECT *
//       FROM plans
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [body.selectedPlan],
//     );

//     if (!plan) {
//       throw new BadRequestException(
//         'Plan not found',
//       );
//     }

//     // =========================================================
//     // 3. Get user
//     // =========================================================

//     const [user] = await this.dataSource.query(
//       `
//       SELECT
//         id,
//         name,
//         email,
//         phone
//       FROM users
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [userId],
//     );

//     if (!user) {
//       throw new BadRequestException(
//         'User not found',
//       );
//     }

//     // =========================================================
//     // 4. Calculate pricing
//     // =========================================================

//     // Your DB currently appears to use "amount"
//     const pricePerVenue = Number(plan.amount);

//     if (
//       !Number.isFinite(pricePerVenue) ||
//       pricePerVenue <= 0
//     ) {
//       throw new BadRequestException(
//         'Invalid plan amount',
//       );
//     }

//     const gstRate = 18;

//     const baseAmount = Number(
//       (pricePerVenue * quantity).toFixed(2),
//     );

//     const gstAmount = Number(
//       ((baseAmount * gstRate) / 100).toFixed(2),
//     );

//     const totalAmount = Number(
//       (baseAmount + gstAmount).toFixed(2),
//     );

//     // Razorpay amount is always paise
//     const razorpayAmount = Math.round(
//       totalAmount * 100,
//     );

//     // =========================================================
//     // 5. Get category
//     // =========================================================

//     const categoryId = Number(
//       body.categoryId || plan.category_id || 1,
//     );

//     // =========================================================
//     // 6. Get Razorpay configuration
//     // =========================================================

//     const config =
//       await this.integrationService.getIntegrationConfig(
//         'razorpay',
//       );

//     const configData =
//       typeof config === 'string'
//         ? JSON.parse(config)
//         : config;

//     const keyId = String(
//       configData?.key_id || '',
//     ).trim();

//     const keySecret = String(
//       configData?.key_secret || '',
//     ).trim();

//     if (!keyId || !keySecret) {
//       throw new BadRequestException(
//         'Razorpay configuration is missing',
//       );
//     }

//     // =========================================================
//     // 7. Initialize Razorpay
//     // =========================================================

//     const razorpay = new Razorpay({
//       key_id: keyId,
//       key_secret: keySecret,
//     });

//     // =========================================================
//     // 8. Generate internal subscription code
//     // =========================================================

//     const subscriptionCode =
//       `SUB_${Date.now()}_${userId}`;

//     // =========================================================
//     // 9. Create Razorpay Payment Link
//     // =========================================================

//     const paymentLink =
//       await razorpay.paymentLink.create({
//         amount: razorpayAmount,

//         currency: 'INR',

//         accept_partial: false,

//         description:
//           `Venuebook ${plan.plan_name} Subscription`,

//         reference_id:
//           subscriptionCode,

//         customer: {
//           name: user.name,
//           email: user.email,
//           contact: user.phone,
//         },

//         expire_by:
//           Math.floor(Date.now() / 1000) +
//           24 * 60 * 60,

//         notify: {
//           sms: true,
//           email: true,
//         },

//         reminder_enable: true,

//         notes: {
//           user_id: String(userId),

//           plan_id: String(plan.id),

//           category_id: String(categoryId),

//           country_id: String(countryId),

//           quantity: String(quantity),

//           subscription_code:
//             subscriptionCode,

//           base_amount:
//             String(baseAmount),

//           gst_rate:
//             String(gstRate),

//           gst_amount:
//             String(gstAmount),

//           total_amount:
//             String(totalAmount),
//         },

//         callback_url:
//           `${process.env.APP_URL}/razorpay/callback`,

//         callback_method: 'get',
//       });

//     // =========================================================
//     // 10. Validate Payment Link
//     // =========================================================

//     if (!paymentLink?.id) {
//       throw new BadRequestException(
//         'Razorpay Payment Link ID missing',
//       );
//     }

//     if (!paymentLink?.short_url) {
//       throw new BadRequestException(
//         'Razorpay Payment Link URL missing',
//       );
//     }

//     // =========================================================
//     // 11. Save subscription
//     // =========================================================

//     const insertResult =
//       await this.dataSource.query(
//         `
//         INSERT INTO user_subscriptions
//         (
//           user_id,
//           country_id,
//           category_id,
//           plan_id,

//           subscription_code,

//           quantity,
//           price_per_unit,

//           gst_rate,
//           gst_amount,

//           current_amount,
//           total_amount,

//           start_date,
//           next_billing_date,

//           auto_renew,

//           status,
//           payment_status,

//           payment_link_id,
//           payment_link_url,

//           created_at,
//           updated_at
//         )
//         VALUES
//         (
//           ?, ?, ?, ?,

//           ?,

//           ?, ?,

//           ?, ?,

//           ?, ?,

//           NULL,
//           NULL,

//           0,

//           'pending',
//           'pending',

//           ?,
//           ?,

//           NOW(),
//           NOW()
//         )
//         `,
//         [
//           userId,
//           countryId,
//           categoryId,
//           plan.id,

//           subscriptionCode,

//           quantity,
//           pricePerVenue,

//           gstRate,
//           gstAmount,

//           baseAmount,
//           totalAmount,

//           paymentLink.id,
//           paymentLink.short_url,
//         ],
//       );

//     const localSubscriptionId =
//       insertResult?.insertId || null;

//     // =========================================================
//     // 12. Return response
//     // =========================================================

//     return {
//       success: true,

//       message:
//         'Razorpay Payment Link created successfully',

//       key_id: keyId,

//       subscription: {
//         id: localSubscriptionId,

//         subscription_code:
//           subscriptionCode,

//         status: 'pending',

//         payment_status: 'pending',

//         auto_renew: false,

//         payment_link_id:
//           paymentLink.id,

//         payment_link_url:
//           paymentLink.short_url,

//         reference_id:
//           paymentLink.reference_id ||
//           subscriptionCode,

//         razorpay_status:
//           paymentLink.status || 'created',

//         expire_by:
//           paymentLink.expire_by
//             ? new Date(
//                 paymentLink.expire_by * 1000,
//               )
//             : null,
//       },

//       pricing: {
//         price_per_venue:
//           pricePerVenue,

//         quantity,

//         base_amount:
//           baseAmount,

//         gst_rate:
//           gstRate,

//         gst_amount:
//           gstAmount,

//         total_amount:
//           totalAmount,

//         razorpay_amount:
//           razorpayAmount,

//         currency:
//           'INR',
//       },
//     };
//   } catch (error) {
//     console.error(
//       'Razorpay Payment Link creation failed:',
//       error,
//     );

//     if (
//       error instanceof BadRequestException
//     ) {
//       throw error;
//     }

//     const errorMessage =
//       error
//       'Unable to create Razorpay Payment Link';

//     throw new BadRequestException(
//       errorMessage,
//     );
//   }
// }
// async subscription(
//   body: any,
//   userId: number,
//   countryId: number,
// ) {
//   try {
//     // =========================================================
//     // 1. Validate quantity
//     // =========================================================

//     const quantity = Number(body.quantity);

//     if (
//       !Number.isInteger(quantity) ||
//       quantity < 1
//     ) {
//       throw new BadRequestException(
//         'Quantity must be a valid number greater than 0',
//       );
//     }

//     // =========================================================
//     // 2. Get VenueBook plan
//     // =========================================================

//     const [plan] =
//       await this.dataSource.query(
//         `
//         SELECT *
//         FROM plans
//         WHERE id = ?
//         LIMIT 1
//         `,
//         [body.selectedPlan],
//       );

//     if (!plan) {
//       throw new BadRequestException(
//         'Plan not found',
//       );
//     }

//     // =========================================================
//     // 3. Get user
//     // =========================================================

//     const [user] =
//       await this.dataSource.query(
//         `
//         SELECT
//           id,
//           name,
//           email,
//           phone
//         FROM users
//         WHERE id = ?
//         LIMIT 1
//         `,
//         [userId],
//       );

//     if (!user) {
//       throw new BadRequestException(
//         'User not found',
//       );
//     }

//     // =========================================================
//     // 4. Validate user details
//     // =========================================================

//     const userName =
//       String(
//         user.name || 'VenueBook User',
//       ).trim();

//     const userEmail =
//       String(
//         user.email || '',
//       ).trim();

//     const userPhone =
//       String(
//         user.phone || '',
//       ).trim();

//     if (!userEmail) {
//       throw new BadRequestException(
//         'User email is required',
//       );
//     }

//     if (!userPhone) {
//       throw new BadRequestException(
//         'User phone is required',
//       );
//     }

//     // =========================================================
//     // 5. Calculate pricing
//     // =========================================================

//     const pricePerVenue =
//       Number(plan.amount);

//     if (
//       !Number.isFinite(
//         pricePerVenue,
//       ) ||
//       pricePerVenue <= 0
//     ) {
//       throw new BadRequestException(
//         'Invalid plan amount',
//       );
//     }

//     const gstRate = 18;

//     const baseAmount =
//       Number(
//         (
//           pricePerVenue *
//           quantity
//         ).toFixed(2),
//       );

//     const gstAmount =
//       Number(
//         (
//           (baseAmount *
//             gstRate) /
//           100
//         ).toFixed(2),
//       );

//     const totalAmount =
//       Number(
//         (
//           baseAmount +
//           gstAmount
//         ).toFixed(2),
//       );

//     // Razorpay amount = paise
//     const razorpayAmount =
//       Math.round(
//         totalAmount * 100,
//       );

//     // =========================================================
//     // 6. Category
//     // =========================================================

//     const categoryId =
//       Number(
//         body.categoryId ||
//         body.category ||
//         plan.category_id ||
//         1,
//       );

//     if (
//       !Number.isInteger(
//         categoryId,
//       ) ||
//       categoryId < 1
//     ) {
//       throw new BadRequestException(
//         'Invalid category',
//       );
//     }

//     // =========================================================
//     // 7. Razorpay configuration
//     // =========================================================

//     const config =
//       await this.integrationService
//         .getIntegrationConfig(
//           'razorpay',
//         );

//     const configData =
//       typeof config === 'string'
//         ? JSON.parse(config)
//         : config;

//     const keyId =
//       String(
//         configData?.key_id || '',
//       ).trim();

//     const keySecret =
//       String(
//         configData?.key_secret ||
//           '',
//       ).trim();

//     if (
//       !keyId ||
//       !keySecret
//     ) {
//       throw new BadRequestException(
//         'Razorpay configuration is missing',
//       );
//     }

//     // =========================================================
//     // 8. Initialize Razorpay
//     // =========================================================

//     const razorpay =
//       new Razorpay({
//         key_id: keyId,
//         key_secret: keySecret,
//       });

//     // =========================================================
//     // 9. Generate internal subscription code
//     // =========================================================

//     const subscriptionCode =
//       `SUB_${Date.now()}_${userId}`;

//     // =========================================================
//     // 10. Find existing Razorpay customer in DB
//     // =========================================================

//     let razorpayCustomerId:
//       string | null = null;

//     const [
//       existingCustomer,
//     ] =
//       await this.dataSource.query(
//         `
//         SELECT
//           razorpay_customer_id
//         FROM user_subscriptions
//         WHERE user_id = ?
//           AND razorpay_customer_id IS NOT NULL
//           AND razorpay_customer_id != ''
//         ORDER BY id DESC
//         LIMIT 1
//         `,
//         [userId],
//       );

//     if (
//       existingCustomer
//         ?.razorpay_customer_id
//     ) {
//       razorpayCustomerId =
//         String(
//           existingCustomer
//             .razorpay_customer_id,
//         );

//       console.log(
//         'Existing Razorpay customer from DB:',
//         razorpayCustomerId,
//       );
//     }

//     // =========================================================
//     // 11. If DB doesn't have customer,
//     //     search Razorpay by email
//     // =========================================================

//     // =========================================================
// // 9. GET OR CREATE RAZORPAY CUSTOMER
// // =========================================================

// let customer: any = null;

// // ---------------------------------------------------------
// // 9.1 Check if this user already has a Razorpay customer
// // ---------------------------------------------------------

// const [existingCustomer] = await this.dataSource.query(
//   `
//   SELECT razorpay_customer_id
//   FROM user_subscriptions
//   WHERE user_id = ?
//     AND razorpay_customer_id IS NOT NULL
//     AND razorpay_customer_id != ''
//   ORDER BY id DESC
//   LIMIT 1
//   `,
//   [userId],
// );

// if (existingCustomer?.razorpay_customer_id) {
//   // -------------------------------------------------------
//   // Reuse existing Razorpay customer
//   // -------------------------------------------------------

//   try {
//     customer = await razorpay.customers.fetch(
//       existingCustomer.razorpay_customer_id,
//     );

//     console.log(
//       'Existing Razorpay customer reused:',
//       customer.id,
//     );
//   } catch (error) {
//     console.warn(
//       'Existing Razorpay customer could not be fetched:',
//       error,
//     );

//     customer = null;
//   }
// }

// // ---------------------------------------------------------
// // 9.2 Create customer only when no existing customer exists
// // ---------------------------------------------------------

// if (!customer?.id) {
//   try {
//     customer = await razorpay.customers.create({
//       name: user.name || undefined,
//       email: user.email || undefined,
//       contact: user.phone || undefined,

//       notes: {
//         user_id: String(userId),
//       },
//     });

//     console.log(
//       'New Razorpay customer created:',
//       customer.id,
//     );
//   } catch (error: any) {
//     console.error(
//       'Razorpay customer creation failed:',
//       error?.error || error,
//     );

//     throw new BadRequestException(
//       error?.error?.description ||
//         'Unable to create Razorpay customer',
//     );
//   }
// }

// if (!customer?.id) {
//   throw new BadRequestException(
//     'Razorpay customer ID missing',
//   );
// }

//     // =========================================================
//     // 12. Create customer if still not found
//     // =========================================================

//     if (
//       !razorpayCustomerId
//     ) {
//       try {
//         const customer =
//           await razorpay.customers.create(
//             {
//               name: userName,

//               email:
//                 userEmail,

//               contact:
//                 userPhone,

//               notes: {
//                 user_id:
//                   String(
//                     userId,
//                   ),
//               },
//             },
//           );

//         if (
//           !customer?.id
//         ) {
//           throw new BadRequestException(
//             'Razorpay customer ID missing',
//           );
//         }

//         razorpayCustomerId =
//           String(
//             customer.id,
//           );

//         console.log(
//           'New Razorpay customer created:',
//           razorpayCustomerId,
//         );
//       } catch (
//         customerError
//       ) {
//         console.error(
//           'Razorpay customer creation failed:',
//           customerError,
//         );

//         throw new BadRequestException(
//           customerError
//             ?.error
//             ?.description ||
//             customerError
//               ?.response
//               ?.error
//               ?.description ||
//             customerError?.message ||
//             'Unable to create Razorpay customer',
//         );
//       }
//     }

//     // =========================================================
//     // Safety check
//     // =========================================================

//     if (
//       !razorpayCustomerId
//     ) {
//       throw new BadRequestException(
//         'Razorpay customer could not be created or found',
//       );
//     }

//     // =========================================================
//     // 13. Find existing Razorpay Plan
//     //
//     // IMPORTANT:
//     // A Razorpay Subscription requires a Razorpay Plan.
//     //
//     // We store the Razorpay plan ID in your `plans` table.
//     // =========================================================

//     let razorpayPlanId =
//       plan.razorpay_plan_id ||
//       null;

//     // =========================================================
//     // 14. Create Razorpay Plan if not available
//     // =========================================================

//     if (
//       !razorpayPlanId
//     ) {
//       try {
//         const razorpayPlan =
//           await razorpay.plans.create(
//             {
//               period:
//                 'monthly',

//               interval: 1,

//               item: {
//                 name:
//                   `${plan.plan_name} - ${quantity} Venue${
//                     quantity > 1
//                       ? 's'
//                       : ''
//                   }`,

//                 amount:
//                   razorpayAmount,

//                 currency:
//                   'INR',

//                 description:
//                   `VenueBook monthly subscription - ${quantity} venue${
//                     quantity > 1
//                       ? 's'
//                       : ''
//                   }`,
//               },

//               notes: {
//                 venuebook_plan_id:
//                   String(
//                     plan.id,
//                   ),

//                 user_id:
//                   String(
//                     userId,
//                   ),

//                 quantity:
//                   String(
//                     quantity,
//                   ),

//                 category_id:
//                   String(
//                     categoryId,
//                   ),

//                 country_id:
//                   String(
//                     countryId,
//                   ),
//               },
//             },
//           );

//         if (
//           !razorpayPlan?.id
//         ) {
//           throw new BadRequestException(
//             'Razorpay plan creation failed',
//           );
//         }

//         razorpayPlanId =
//           String(
//             razorpayPlan.id,
//           );

//         // =====================================================
//         // Save Razorpay plan ID
//         // =====================================================

//         await this.dataSource.query(
//           `
//           UPDATE plans
//           SET
//             razorpay_plan_id = ?,
//             updated_at = NOW()
//           WHERE id = ?
//           `,
//           [
//             razorpayPlanId,
//             plan.id,
//           ],
//         );

//         console.log(
//           'New Razorpay plan created:',
//           razorpayPlanId,
//         );
//       } catch (
//         planError
//       ) {
//         console.error(
//           'Razorpay plan creation failed:',
//           planError,
//         );

//         throw new BadRequestException(
//           planError
//             ?.error
//             ?.description ||
//             planError
//               ?.response
//               ?.error
//               ?.description ||
//             planError?.message ||
//             'Unable to create Razorpay plan',
//         );
//       }
//     }

//     // =========================================================
//     // 15. Create Razorpay Subscription
//     // =========================================================

//     let razorpaySubscription:
//       any;

//     try {
//       razorpaySubscription =
//         await razorpay.subscriptions.create(
//           {
//             plan_id:
//               razorpayPlanId,

//             // 12 monthly payments
//             total_count: 12,

//             // One subscription
//             quantity: 1,

//             customer_notify:
//               true,

//             notes: {
//               user_id:
//                 String(
//                   userId,
//                 ),

//               venuebook_plan_id:
//                 String(
//                   plan.id,
//                 ),

//               category_id:
//                 String(
//                   categoryId,
//                 ),

//               country_id:
//                 String(
//                   countryId,
//                 ),

//               venue_quantity:
//                 String(
//                   quantity,
//                 ),

//               subscription_code:
//                 subscriptionCode,

//               base_amount:
//                 String(
//                   baseAmount,
//                 ),

//               gst_rate:
//                 String(
//                   gstRate,
//                 ),

//               gst_amount:
//                 String(
//                   gstAmount,
//                 ),

//               total_amount:
//                 String(
//                   totalAmount,
//                 ),
//             },
//           },
//         );

//       console.log(
//         'Razorpay subscription created:',
//         razorpaySubscription,
//       );
//     } catch (
//       subscriptionError
//     ) {
//       console.error(
//         'Razorpay subscription creation failed:',
//         subscriptionError,
//       );

//       throw new BadRequestException(
//         subscriptionError
//           ?.error
//           ?.description ||
//           subscriptionError
//             ?.response
//             ?.error
//             ?.description ||
//           subscriptionError?.message ||
//           'Unable to create Razorpay subscription',
//       );
//     }

//     // =========================================================
//     // 16. Validate subscription
//     // =========================================================

//     if (
//       !razorpaySubscription?.id
//     ) {
//       throw new BadRequestException(
//         'Razorpay subscription ID missing',
//       );
//     }

//     // =========================================================
//     // 17. Save local subscription
//     // =========================================================

//     const insertResult =
//       await this.dataSource.query(
//         `
//         INSERT INTO user_subscriptions
//         (
//           user_id,
//           country_id,
//           category_id,
//           plan_id,

//           subscription_code,

//           quantity,
//           price_per_unit,

//           gst_rate,
//           gst_amount,

//           current_amount,
//           total_amount,

//           start_date,
//           next_billing_date,

//           auto_renew,

//           status,
//           payment_status,

//           razorpay_customer_id,
//           razorpay_subscription_id,

//           created_at,
//           updated_at
//         )
//         VALUES
//         (
//           ?, ?, ?, ?,

//           ?,

//           ?, ?,

//           ?, ?,

//           ?, ?,

//           NULL,
//           NULL,

//           1,

//           'pending',
//           'pending',

//           ?,
//           ?,

//           NOW(),
//           NOW()
//         )
//         `,
//         [
//           userId,

//           countryId,

//           categoryId,

//           plan.id,

//           subscriptionCode,

//           quantity,

//           pricePerVenue,

//           gstRate,

//           gstAmount,

//           baseAmount,

//           totalAmount,

//           razorpayCustomerId,

//           razorpaySubscription.id,
//         ],
//       );

//     const localSubscriptionId =
//       insertResult?.insertId ||
//       null;

//     // =========================================================
//     // 18. Return response
//     // =========================================================

//     return {
//       success: true,

//       message:
//         'Razorpay recurring subscription created successfully',

//       key_id:
//         keyId,

//       customer: {
//         id:
//           razorpayCustomerId,
//       },

//       plan: {
//         id:
//           razorpayPlanId,
//       },

//       subscription: {
//         id:
//           localSubscriptionId,

//         subscription_code:
//           subscriptionCode,

//         razorpay_subscription_id:
//           razorpaySubscription.id,

//         razorpay_customer_id:
//           razorpayCustomerId,

//         razorpay_plan_id:
//           razorpayPlanId,

//         status:
//           razorpaySubscription.status ||
//           'created',

//         payment_status:
//           'pending',

//         auto_renew:
//           true,

//         short_url:
//           razorpaySubscription.short_url ||
//           null,
//       },

//       pricing: {
//         price_per_venue:
//           pricePerVenue,

//         quantity,

//         base_amount:
//           baseAmount,

//         gst_rate:
//           gstRate,

//         gst_amount:
//           gstAmount,

//         total_amount:
//           totalAmount,

//         razorpay_amount:
//           razorpayAmount,

//         currency:
//           'INR',

//         billing:
//           'monthly',
//       },
//     };
//   } catch (error) {
//     // =========================================================
//     // GLOBAL ERROR HANDLING
//     // =========================================================

//     console.error(
//       'Razorpay recurring subscription failed:',
//       error,
//     );

//     console.error(
//       'Razorpay error details:',
//       error?.error ||
//         error?.response ||
//         error?.message ||
//         error,
//     );

//     if (
//       error instanceof
//       BadRequestException
//     ) {
//       throw error;
//     }

//     throw new BadRequestException(
//       error||
//         'Unable to create Razorpay recurring subscription',
//     );
//   }
// }

async subscription(
  body: any,
  userId: number,
  countryId: number,
) {
  try {
    // =========================================================
    // 1. Validate quantity
    // =========================================================
 
    const quantity = Number(body.quantity);
 
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException(
        'Quantity must be a valid number greater than 0',
      );
    }
 
    // =========================================================
    // 2. Get VenueBook plan
    // =========================================================
 
    const [plan] = await this.dataSource.query(
      `
      SELECT *
      FROM plans
      WHERE id = ?
      LIMIT 1
      `,
      [body.selectedPlan],
    );
 
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }
 
    // =========================================================
    // 3. Get user
    // =========================================================
 
    const [user] = await this.dataSource.query(
      `
      SELECT id, name, email, phone
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId],
    );
 
    if (!user) {
      throw new BadRequestException('User not found');
    }
 
    // =========================================================
    // 4. Validate user details
    // =========================================================
 
    const userName = String(user.name || 'VenueBook User').trim();
    const userEmail = String(user.email || '').trim();
    const userPhone = String(user.phone || '').trim();
 
    if (!userEmail) {
      throw new BadRequestException('User email is required');
    }
 
    if (!userPhone) {
      throw new BadRequestException('User phone is required');
    }
 
    // =========================================================
    // 5. Calculate pricing
    // =========================================================
 
    const pricePerVenue = Number(plan.amount);
 
    if (!Number.isFinite(pricePerVenue) || pricePerVenue <= 0) {
      throw new BadRequestException('Invalid plan amount');
    }
 
    const gstRate = 18;
 
    const baseAmount = Number((pricePerVenue * quantity).toFixed(2));
 
    const gstAmount = Number(
      ((baseAmount * gstRate) / 100).toFixed(2),
    );
 
    const totalAmount = Number(
      (baseAmount + gstAmount).toFixed(2),
    );
 
    // Razorpay amount = paise
    const razorpayAmount = Math.round(totalAmount * 100);
 
    // =========================================================
    // 6. Category
    // =========================================================
 
    const categoryId = Number(
      body.categoryId || body.category || plan.category_id || 1,
    );
 
    // if (!Number.isInteger(categoryId) || categoryId < 1) {
    //   throw new BadRequestException('Invalid category');
    // }
 
    // =========================================================
    // 7. Razorpay configuration
    // =========================================================
 
    const config = await this.integrationService.getIntegrationConfig(
      'razorpay',
    );
 
    const configData =
      typeof config === 'string' ? JSON.parse(config) : config;
 
    const keyId = String(configData?.key_id || '').trim();
    const keySecret = String(configData?.key_secret || '').trim();
 
    if (!keyId || !keySecret) {
      throw new BadRequestException(
        'Razorpay configuration is missing',
      );
    }
 
    // =========================================================
    // 8. Initialize Razorpay
    // =========================================================
 
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
 
    // =========================================================
    // 9. Generate internal subscription code
    // =========================================================
 
    const subscriptionCode = `SUB_${Date.now()}_${userId}`;

 

const interval = 1;

const today = dayjs();

const startDate = today.format(
  'YYYY-MM-DD HH:mm:ss',
);

const planTitle = Number(plan.plan_title);

let nextBillingDate: string;
let endDate: string;

switch (planTitle) {
  case 1:
    nextBillingDate = today
      .add(interval, 'month')
      .format('YYYY-MM-DD HH:mm:ss');

    endDate = today
      .add(interval, 'month')
      .format('YYYY-MM-DD HH:mm:ss');
    break;

  case 2:
    nextBillingDate = today
      .add(interval, 'year')
      .format('YYYY-MM-DD HH:mm:ss');

    endDate = today
      .add(interval, 'year')
      .format('YYYY-MM-DD HH:mm:ss');
    break;

  default:
    throw new Error(
      `Invalid plan_title: ${plan.plan_title}`,
    );
}

console.log({
  startDate,
  nextBillingDate,
  endDate,
});
 
    // =========================================================
    // 10. GET OR CREATE RAZORPAY CUSTOMER
    // =========================================================


let razorpayCustomerId: string | null = null;

// ---------------------------------------------------------
// 10.1 First check our database
// ---------------------------------------------------------

const [existingCustomer] =
  await this.dataSource.query(
    `
    SELECT razorpay_customer_id
    FROM user_subscriptions
    WHERE user_id = ?
      AND razorpay_customer_id IS NOT NULL
      AND razorpay_customer_id != ''
    ORDER BY id DESC
    LIMIT 1
    `,
    [userId],
  );

if (existingCustomer?.razorpay_customer_id) {
  try {
    const existingRazorpayCustomer =
      await razorpay.customers.fetch(
        existingCustomer.razorpay_customer_id,
      );

    if (existingRazorpayCustomer?.id) {
      razorpayCustomerId =
        String(existingRazorpayCustomer.id);

      console.log(
        'Existing Razorpay customer reused:',
        razorpayCustomerId,
      );
    }
  } catch (error) {
    console.warn(
      'Stored Razorpay customer ID is invalid:',
      existingCustomer.razorpay_customer_id,
    );

    razorpayCustomerId = null;
  }
}

// ---------------------------------------------------------
// 10.2 If not found locally, create/retrieve using
//      Razorpay fail_existing = "0"
// ---------------------------------------------------------

if (!razorpayCustomerId) {
  try {
    /**
     * IMPORTANT:
     *
     * Razorpay API expects:
     *
     * fail_existing: "0"
     *
     * not:
     *
     * fail_existing: 0
     *
     * Razorpay documentation confirms that "0" returns
     * the existing customer when the same customer exists.
     */

    const customer =
      await (razorpay.customers.create as any)({
        name: userName,
        email: userEmail,
        contact: userPhone,

        fail_existing: '0',

        notes: {
          user_id: String(userId),
        },
      });

    console.log(
      'Razorpay customer response:',
      JSON.stringify(customer, null, 2),
    );

    if (customer?.id) {
      razorpayCustomerId =
        String(customer.id);

      console.log(
        'Razorpay customer created/reused:',
        razorpayCustomerId,
      );
    }
  } catch (customerError: any) {
    console.error(
      'Razorpay customer creation failed:',
      JSON.stringify(
        customerError,
        null,
        2,
      ),
    );

    const description =
      String(
        customerError?.error?.description ||
        customerError?.response?.error?.description ||
        customerError?.message ||
        '',
      ).toLowerCase();

    // -------------------------------------------------------
    // 10.3 If Razorpay says customer already exists,
    //      fetch all customers and find matching email/contact
    // -------------------------------------------------------

    if (
      description.includes(
        'customer already exists',
      ) ||
      description.includes(
        'already exists',
      )
    ) {
      try {
        console.log(
          'Searching Razorpay customers for existing customer...',
        );

        let skip = 0;

        const count = 100;

        let foundCustomer: any = null;

        /**
         * Razorpay Fetch All Customers API supports
         * count and skip pagination.
         */
        while (!foundCustomer) {
          const customers =
            await razorpay.customers.all({
              count,
              skip,
            });

          const customerList =
            customers?.items || [];

          if (!customerList.length) {
            break;
          }

          foundCustomer =
            customerList.find(
              (customer: any) => {
                const razorpayEmail =
                  String(
                    customer?.email || '',
                  )
                    .trim()
                    .toLowerCase();

                const razorpayContact =
                  String(
                    customer?.contact || '',
                  )
                    .replace(/\D/g, '');

                const localEmail =
                  userEmail
                    .trim()
                    .toLowerCase();

                const localContact =
                  userPhone.replace(
                    /\D/g,
                    '',
                  );

                return (
                  razorpayEmail ===
                    localEmail ||
                  razorpayContact ===
                    localContact
                );
              },
            );

          if (
            customerList.length < count
          ) {
            break;
          }

          skip += count;
        }

        if (foundCustomer?.id) {
          razorpayCustomerId =
            String(foundCustomer.id);

          console.log(
            'Existing Razorpay customer found:',
            razorpayCustomerId,
          );
        }
      } catch (searchError) {
        console.error(
          'Failed to search Razorpay customers:',
          JSON.stringify(
            searchError,
            null,
            2,
          ),
        );
      }
    }

    // -------------------------------------------------------
    // 10.4 Still not found
    // -------------------------------------------------------

    if (!razorpayCustomerId) {
      throw new BadRequestException(
        description ||
          'Razorpay customer could not be created or found',
      );
    }
  }
}

// ---------------------------------------------------------
// 10.5 Final validation
// ---------------------------------------------------------

if (!razorpayCustomerId) {
  throw new BadRequestException(
    'Razorpay customer could not be created or found',
  );
}

console.log(
  'Final Razorpay Customer ID:',
  razorpayCustomerId,
);
 
    // =========================================================
    // 11. Create an Order for THIS charge
    // =========================================================
 
    let razorpayOrder: any;
 
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: razorpayAmount,
        currency: 'INR',
        receipt: subscriptionCode,
        payment_capture: true,
        notes: {
          user_id: String(userId),
          venuebook_plan_id: String(plan.id),
          category_id: String(1),
          country_id: String(countryId),
          venue_quantity: String(quantity),
          subscription_code: subscriptionCode,
          base_amount: String(baseAmount),
          gst_rate: String(gstRate),
          gst_amount: String(gstAmount),
          total_amount: String(totalAmount),
          recurring_setup: 'true',
        },
      });
 
      console.log('Razorpay order created:', razorpayOrder);
    } catch (orderError) {
      console.error(
        'Razorpay order creation failed:',
        JSON.stringify(
            orderError,
          null,
          2,
        ),
      );

      throw new BadRequestException(
        orderError ||
          'Unable to create Razorpay order',
      );
    }
 
    if (!razorpayOrder?.id) {
      throw new BadRequestException('Razorpay order ID missing');
    }
 
    // =========================================================
    // 12. Save local subscription record.
    // =========================================================


 
    const insertResult = await this.dataSource.query(
      `
      INSERT INTO user_subscriptions
      (
        user_id,
        country_id,
        category_id,
        plan_id,
 
        subscription_code,
 
        quantity,
        price_per_unit,
 
        gst_rate,
        gst_amount,
 
        current_amount,
        total_amount,
 
        start_date,
        next_billing_date,
 
        auto_renew,
 
        status,
        payment_status,
 
        razorpay_customer_id,
        razorpay_order_id,
        razorpay_token_id,
 
        created_at,
        updated_at
      )
      VALUES
      (
        ?, ?, ?, ?,
 
        ?,
 
        ?, ?,
 
        ?, ?,
 
        ?, ?,
 
        ?,
        ?,
 
        1,
 
        'pending',
        'pending',
 
        ?,
        ?,
        NULL,
 
        NOW(),
        NOW()
      )
      `,
      [
        userId,
        countryId,
        1,
        plan.id,
 
        subscriptionCode,
 
        quantity,
        pricePerVenue,
 
        gstRate,
        gstAmount,
 
        baseAmount,
        totalAmount,

        startDate,
        nextBillingDate,
 
        razorpayCustomerId,
        razorpayOrder.id,
      ],
    );
 
    const localSubscriptionId = insertResult?.insertId || null;
 
    // =========================================================
    // 13. Return response.
    // =========================================================
 
    return {
      success: true,
 
      message:
        'Razorpay order created for recurring (token-based) setup',
 
      key_id: keyId,
 
      customer: {
        id: razorpayCustomerId,
      },
 
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
 
      subscription: {
        id: localSubscriptionId,
        subscription_code: subscriptionCode,
        razorpay_customer_id: razorpayCustomerId,
        razorpay_order_id: razorpayOrder.id,
        status: 'created',
        payment_status: 'pending',
        auto_renew: true,
      },
 
      pricing: {
        price_per_venue: pricePerVenue,
        quantity,
        base_amount: baseAmount,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        razorpay_amount: razorpayAmount,
        currency: 'INR',
        billing: 'monthly',
      },
    };
  } catch (error) {
    // =========================================================
    // GLOBAL ERROR HANDLING
    // =========================================================
 
    console.error('Razorpay token-based recurring setup failed:', error);
 
    console.error(
      'Razorpay error details:',
      error,
    );
 
    if (error instanceof BadRequestException) {
      throw error;
    }
 
    throw new BadRequestException(
      error ||
        'Unable to create Razorpay recurring (token-based) setup',
    );
  }
}

async updateSubscriptionQuantity(
  body: any,
  userId: number,
) {
  try {
    const newQuantity = Number(body.quantity);

    if (!Number.isInteger(newQuantity) || newQuantity < 1) {
      throw new BadRequestException(
        'Quantity must be at least 1',
      );
    }

    // =====================================================
    // Get user's active subscription
    // =====================================================
    const [subscription] = await this.dataSource.query(
      `
      SELECT *
      FROM user_subscriptions
      WHERE user_id = ?
        AND status = 'active'
      ORDER BY id DESC
      LIMIT 1
      `,
      [userId],
    );

    if (!subscription) {
      throw new BadRequestException(
        'Active subscription not found',
      );
    }

    if (!subscription.subscription_id) {
      throw new BadRequestException(
        'Razorpay subscription ID not found',
      );
    }

    // =====================================================
    // Get Razorpay configuration
    // =====================================================
    const config =
      await this.integrationService.getIntegrationConfig(
        'razorpay',
      );

    const configData =
      typeof config === 'string'
        ? JSON.parse(config)
        : config;

    const razorpay = new Razorpay({
      key_id: configData.key_id,
      key_secret: configData.key_secret,
    });

    // =====================================================
    // Current quantity
    // =====================================================
    const oldQuantity = Number(
      subscription.quantity || 1,
    );

    // =====================================================
    // Determine upgrade / downgrade
    // =====================================================
    let changeType = 'same';

    if (newQuantity > oldQuantity) {
      changeType = 'upgrade';
    } else if (newQuantity < oldQuantity) {
      changeType = 'downgrade';
    }

    if (changeType === 'same') {
      return {
        success: true,
        message: 'Quantity is already the same',
        quantity: oldQuantity,
      };
    }

    // =====================================================
    // Calculate amounts
    // =====================================================
    const pricePerUnit = Number(
      subscription.price_per_unit || 199,
    );

    const gstRate = Number(
      subscription.gst_rate || 18,
    );

    const newBaseAmount = Number(
      (pricePerUnit * newQuantity).toFixed(2),
    );

    const newGstAmount = Number(
      ((newBaseAmount * gstRate) / 100).toFixed(2),
    );

    const newTotalAmount = Number(
      (newBaseAmount + newGstAmount).toFixed(2),
    );

    // =====================================================
    // Update Razorpay subscription
    //
    // cycle_end:
    // New quantity starts from next billing cycle.
    // =====================================================
    const updatedSubscription =
    await razorpay.subscriptions.update(
      subscription.subscription_id,
      {
        quantity: newQuantity,
        schedule_change_at: 'cycle_end',
        customer_notify: true,
      },
    );

    // =====================================================
    // Update VenueBook database
    // =====================================================
    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
        quantity = ?,
        current_amount = ?,
        gst_amount = ?,
        total_amount = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        newQuantity,
        newBaseAmount,
        newGstAmount,
        newTotalAmount,
        subscription.id,
      ],
    );

    // =====================================================
    // Return response
    // =====================================================
    return {
      success: true,

      change_type: changeType,

      old_quantity: oldQuantity,
      new_quantity: newQuantity,

      pricing: {
        price_per_unit: pricePerUnit,

        base_amount: newBaseAmount,

        gst_rate: gstRate,

        gst_amount: newGstAmount,

        total_amount: newTotalAmount,

        currency: 'INR',
      },

      razorpay: {
        subscription_id:
          updatedSubscription.id,

        status:
          updatedSubscription.status,

        quantity:
          updatedSubscription.quantity,

        schedule_change_at:
          updatedSubscription.schedule_change_at,

        has_scheduled_changes:
          updatedSubscription.has_scheduled_changes,
      },
    };
  } catch (error) {
    console.error(
      'Razorpay quantity update failed:',
      error,
    );

    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException(
      error ||
        'Unable to update subscription quantity',
    );
  }
}

  // async verifySubscription(body: any) {

  //   console.log(body)
  //    const config =
  //   await this.integrationService.getIntegrationConfig('razorpay');

  // const configData =
  //   typeof config === 'string' ? JSON.parse(config) : config;

  // const expectedSignature = crypto
  //   .createHmac('sha256', configData.key_secret)
  //   .update(
  //     body.payment_id + '|' + body.subscription_id,
  //   )
  //   .digest('hex');

  // if (expectedSignature !== body.signature) {
  //   throw new BadRequestException('Invalid signature');
  // }

  // await this.dataSource.query(
  //   `
  //     UPDATE user_subscriptions
  //     SET
  //       status='active',
  //       subscription_code=?,
  //       updated_at=NOW()
  //     WHERE subscription_id=?
  //   `,
  //   [
  //     body.payment_id,
  //     body.subscription_id,
  //   ],
  // );

  // return {
  //   success: true,
  //   subscription_id:body.subscription_id
    
  // };
  // }

  // async verifys(id: any) 
  // {
  //    const result  = await this.dataSource.query(
  //   `
  //     SELECT * FROM  user_subscriptions WHERE id = ? 
  //   `,
  //   [
  //     id,
  //   ],
  // );
  // return result[0];
  // }
//   async verifySubscription(body: any) {
//   console.log(
//     '========== VERIFY RAZORPAY PAYMENT =========='
//   );

//   console.log('Verify body:', body);

//   // =========================================================
//   // 1. Validate required fields
//   // =========================================================

//   if (!body?.payment_id) {
//     throw new BadRequestException(
//       'Payment ID is required',
//     );
//   }

//   if (!body?.order_id) {
//     throw new BadRequestException(
//       'Order ID is required',
//     );
//   }

//   if (!body?.signature) {
//     throw new BadRequestException(
//       'Razorpay signature is required',
//     );
//   }

//   if (!body?.subscription_table_id) {
//     throw new BadRequestException(
//       'Subscription table ID is required',
//     );
//   }

//   // =========================================================
//   // 2. Get Razorpay configuration
//   // =========================================================

//   const config =
//     await this.integrationService.getIntegrationConfig(
//       'razorpay',
//     );

//   const configData =
//     typeof config === 'string'
//       ? JSON.parse(config)
//       : config;

//   const keySecret =
//     String(
//       configData?.key_secret || '',
//     ).trim();

//   if (!keySecret) {
//     throw new BadRequestException(
//       'Razorpay key secret is missing',
//     );
//   }

//   // =========================================================
//   // 3. Generate Razorpay signature
//   //
//   // IMPORTANT:
//   //
//   // Razorpay Checkout signature:
//   //
//   // order_id|payment_id
//   //
//   // NOT:
//   //
//   // payment_id|subscription_id
//   // =========================================================

//   const signaturePayload =
//     `${body.order_id}|${body.payment_id}`;

//   console.log(
//     'Signature payload:',
//     signaturePayload,
//   );

//   const expectedSignature =
//     crypto
//       .createHmac(
//         'sha256',
//         keySecret,
//       )
//       .update(signaturePayload)
//       .digest('hex');

//   console.log(
//     'Expected signature:',
//     expectedSignature,
//   );

//   console.log(
//     'Received signature:',
//     body.signature,
//   );

//   // =========================================================
//   // 4. Compare signatures
//   // =========================================================

//   if (
//     expectedSignature !==
//     String(body.signature).trim()
//   ) {
//     console.error(
//       'Razorpay signature mismatch',
//     );

//     throw new BadRequestException(
//       'Invalid signature',
//     );
//   }

//   console.log(
//     'Razorpay signature verified successfully',
//   );

//   // =========================================================
//   // 5. Find local subscription
//   // =========================================================

//   const [subscription] =
//     await this.dataSource.query(
//       `
//       SELECT *
//       FROM user_subscriptions
//       WHERE id = ?
//       LIMIT 1
//       `,
//       [
//         Number(
//           body.subscription_table_id,
//         ),
//       ],
//     );

//   if (!subscription) {
//     throw new BadRequestException(
//       'Subscription record not found',
//     );
//   }

//   // =========================================================
//   // 6. Verify order belongs to this subscription
//   // =========================================================

//   if (
//     subscription.razorpay_order_id &&
//     subscription.razorpay_order_id !==
//       body.order_id
//   ) {
//     throw new BadRequestException(
//       'Order does not belong to this subscription',
//     );
//   }

//   // =========================================================
//   // 7. Update subscription
//   // =========================================================

//   await this.dataSource.query(
//     `
//     UPDATE user_subscriptions
//     SET
//       status = 'active',
//       payment_status = 'paid',
//       razorpay_payment_id = ?,
//       razorpay_order_id = ?,
//       updated_at = NOW()
//     WHERE id = ?
//     `,
//     [
//       body.payment_id,
//       body.order_id,
//       Number(
//         body.subscription_table_id,
//       ),
//     ],
//   );

//   // =========================================================
//   // 8. Return result
//   // =========================================================

//   return {
//     success: true,

//     message:
//       'Razorpay payment verified successfully',

//     subscription_id:
//       subscription.id,

//     subscription_code:
//       subscription.subscription_code,

//     payment_id:
//       body.payment_id,

//     order_id:
//       body.order_id,

//     status:
//       'active',

//     payment_status:
//       'paid',
//   };
// }


async verifySubscription(body: any) {
  console.log(
    '========== VERIFY RAZORPAY PAYMENT =========='
  );

  console.log('Verify body:', body);

  // =========================================================
  // 1. Validate required fields
  // =========================================================

  if (!body?.payment_id) {
    throw new BadRequestException(
      'Payment ID is required',
    );
  }

  if (!body?.order_id) {
    throw new BadRequestException(
      'Order ID is required',
    );
  }

  if (!body?.signature) {
    throw new BadRequestException(
      'Razorpay signature is required',
    );
  }

  const subscriptionTableId = Number(
    body?.subscription_table_id,
  );

  if (
    !Number.isInteger(subscriptionTableId) ||
    subscriptionTableId <= 0
  ) {
    throw new BadRequestException(
      'Valid subscription table ID is required',
    );
  }

  // =========================================================
  // 2. Get Razorpay configuration
  // =========================================================

  const config =
    await this.integrationService.getIntegrationConfig(
      'razorpay',
    );



  const configData =
    typeof config === 'string'
      ? JSON.parse(config)
      : config;

  const keySecret = String(
    configData?.key_secret || '',
  ).trim();

  if (!keySecret) {
    throw new BadRequestException(
      'Razorpay key secret is missing',
    );
  }

   const razorpay = new Razorpay({
      key_id: configData.key_id,
      key_secret: configData.key_secret,
    });

  // =========================================================
  // 3. Verify Razorpay Checkout signature
  //
  // Checkout signature:
  //
  // order_id|payment_id
  // =========================================================

  const signaturePayload =
    `${body.order_id}|${body.payment_id}`;

  const expectedSignature =
    crypto
      .createHmac(
        'sha256',
        keySecret,
      )
      .update(signaturePayload)
      .digest('hex');

  console.log(
    'Signature payload:',
    signaturePayload,
  );

  console.log(
    'Expected signature:',
    expectedSignature,
  );

  console.log(
    'Received signature:',
    body.signature,
  );

  if (
    expectedSignature !==
    String(body.signature).trim()
  ) {
    console.error(
      'Razorpay signature mismatch',
    );

    throw new BadRequestException(
      'Invalid signature',
    );
  }

  console.log(
    'Razorpay signature verified successfully',
  );

  // =========================================================
  // 4. Find subscription
  // =========================================================

  const [subscription] =
    await this.dataSource.query(
      `
      SELECT
        *
      FROM user_subscriptions
      WHERE id = ?
      LIMIT 1
      `,
      [subscriptionTableId],
    );

  if (!subscription) {
    throw new BadRequestException(
      'Subscription record not found',
    );
  }

  // =========================================================
  // 5. Verify order belongs to subscription
  // =========================================================

  if (
    subscription.razorpay_order_id &&
    subscription.razorpay_order_id !==
      body.order_id
  ) {
    throw new BadRequestException(
      'Order does not belong to this subscription',
    );
  }

  // =========================================================
  // 6. Prevent duplicate payment
  // =========================================================

  const [existingPayment] =
    await this.dataSource.query(
      `
      SELECT
        id
      FROM user_subscription_payments
      WHERE payment_id = ?
      LIMIT 1
      `,
      [body.payment_id],
    );

  if (existingPayment) {
    console.log(
      'Payment already exists:',
      existingPayment.id,
    );

    return {
      success: true,

      message:
        'Payment already verified',

      subscription_id:
        subscription.id,

      subscription_code:
        subscription.subscription_code,

      payment_id:
        body.payment_id,

      order_id:
        body.order_id,

      status:
        'active',

      payment_status:
        'paid',
    };
  }

  // =========================================================
  // 7. Token / authorization reference
  //
  // IMPORTANT:
  //
  // Your current Checkout response does NOT contain
  // razorpay_token_id.
  //
  // Therefore this will normally be NULL unless your
  // frontend/webhook/backend sends it.
  // =========================================================

  // const tokenId =
  //   body?.token_id ||
  //   body?.razorpay_token_id ||
  //   null;

  // console.log(
  //   'Razorpay token ID:',
  //   tokenId,
  // );

  const payment = await razorpay.payments.fetch(
  body.payment_id,
);

const tokenId =
  payment?.token_id || null;

console.log(
  'Razorpay token:',
  tokenId,
);
  // =========================================================
  // 8. Calculate payment values
  // =========================================================

  const amount = Number(
    subscription.current_amount ??
      subscription.total_amount ??
      0,
  );

  const totalAmount = Number(
    subscription.total_amount ??
      amount,
  );

  const gstAmount = Number(
    subscription.gst_amount ?? 0,
  );

  if (
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0
  ) {
    throw new BadRequestException(
      'Invalid subscription amount',
    );
  }

  // Database amount is normally INR.
  // user_subscription_payments.amount should match
  // your existing table convention.
  const paymentAmount = totalAmount;

  // =========================================================
  // 9. Calculate billing dates
  // =========================================================

//const startDate = dayjs().format('YYYY-MM-DD HH:mm:ss');;

//const nextBillingDate = startDate.add(1, 'month').format('YYYY-MM-DD HH:mm:ss');

  //const interval = Number(plan.interval || 1);

const interval = 1;

const startDate = dayjs();

const nextBillingDate = startDate.add(
  interval,
  'month',
);

const startDateFormatted =
  startDate.format('YYYY-MM-DD HH:mm:ss');

const nextBillingDateFormatted =
  nextBillingDate.format('YYYY-MM-DD HH:mm:ss');

console.log({
  startDateFormatted,
  nextBillingDateFormatted,
});

  // =========================================================
  // 10. Start DB transaction
  // =========================================================

  const queryRunner =
    this.dataSource.createQueryRunner();

  await queryRunner.connect();

  await queryRunner.startTransaction();

  try {
    // =======================================================
    // 11. Update subscription
    // =======================================================

    await queryRunner.query(
      `
      UPDATE user_subscriptions
      SET
        status = 'active',

        payment_status = 'paid',

        razorpay_payment_id = ?,

        razorpay_order_id = ?,

        

        razorpay_token_id = COALESCE(?, razorpay_token_id),

        token_status =
          CASE
            WHEN ? IS NOT NULL
            THEN 'active'
            ELSE token_status
          END,

        

        start_date = ?,

        next_billing_date = ?,

        auto_renew = 1,

        updated_at = NOW()

      WHERE id = ?
      `,
      [
        body.payment_id,

        body.order_id,

        // body.signature,

        //tokenId,

        tokenId,

        tokenId,

        startDateFormatted,

        nextBillingDateFormatted,

        subscriptionTableId,
      ],
    );

    // =======================================================
    // 12. Insert payment transaction
    // =======================================================

    await queryRunner.query(
      `
      INSERT INTO user_subscription_payments
      (
        subscription_id,

        user_id,

        order_id,

        transaction_id,

        payment_id,

        amount,

        tax_amount,

        total_amount,

        payment_method,

        payment_status,

        paid_at,

        created_at
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        NOW(),
        NOW()
      )
      `,
      [
        subscriptionTableId,

        subscription.user_id,

        body.order_id,

        body.payment_id,

        body.payment_id,

        paymentAmount - gstAmount,

        gstAmount,

        totalAmount,

        'razorpay',

        'paid',
      ],
    );

    // =======================================================
    // 13. Commit transaction
    // =======================================================

    await queryRunner.commitTransaction();

    console.log(
      'Subscription activated successfully',
    );

    console.log(
      'Payment transaction inserted successfully',
    );

    // =======================================================
    // 14. Return
    // =======================================================

    return {
      success: true,

      message:
        'Razorpay payment verified successfully',

      subscription_id:
        subscription.id,

      subscription_code:
        subscription.subscription_code,

      payment_id:
        body.payment_id,

      order_id:
        body.order_id,

      token_id:
        tokenId,

      status:
        'active',

      payment_status:
        'paid',

      auto_renew:
        true,

      start_date:
        startDate,

      next_billing_date:
        nextBillingDate,

      payment: {
        amount:
          paymentAmount - gstAmount,

        tax_amount:
          gstAmount,

        total_amount:
          totalAmount,

        currency:
          'INR',

        payment_method:
          'razorpay',

        payment_status:
          'paid',
      },
    };

  } catch (error) {

    // =======================================================
    // Rollback if anything fails
    // =======================================================

    await queryRunner.rollbackTransaction();

    console.error(
      'Subscription verification DB transaction failed:',
      error,
    );

    throw error;

  } finally {

    // =======================================================
    // Release connection
    // =======================================================

    await queryRunner.release();
  }
}

  async verifys(id: any ,param:any,payment_id:any) {
    console.log(payment_id)
  const result = await this.dataSource.query(
    `
      SELECT *
      FROM user_subscriptions
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  const subscription = result[0];

  if (!subscription) {
    console.log(
      'Subscription not found',
    );
  }

  // Already active
  if (subscription.status === 'active') {
    return {
      success: true,
      subscription_id: subscription.id,
      status: 'active',
      already_verified: true,
    };
  }

  // You need these values to call verifySubscription()
  if (
    !subscription.subscription_code 
  ) {
    return {
      success: false,
      subscription_id: subscription.id,
      status: subscription.status,
      message:
        'Payment verification information is missing',
    };
  }

  // Automatically verify
  // return await this.verifySubscription({
  //   subscription_id:
  //     subscription.subscription_code,
  //     signature:param,
  //     payment_id:payment_id,

  // });

   await this.dataSource.query(
    `
      UPDATE user_subscriptions
      SET
        status='active' ,
        updated_at=NOW()
      WHERE subscription_code=?
    `,
    [
      subscription.subscription_code
    ],
  );
}
    async verifyPayment(body: any, id: any) {
    const config =
      await this.integrationService.getIntegrationConfig('razorpay');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    const expected = crypto
      .createHmac('sha256', configData.key_secret)
      .update(body.razorpay_payment_id + '|' + body.razorpay_subscription_id)
      .digest('hex');

    if (expected !== body.razorpay_signature) {
      throw new BadRequestException('Invalid Signature');
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

  // payment.service.ts

  async createOrder(body: any) {
    const options = {
      amount: body.amount * 100, // ₹500 => 50000 paise
      currency: 'INR',
      receipt: `RCPT_${Date.now()}`,
      payment_capture: true,
      notes: {
        booking_id: body.booking_id,
      },
    };

    const config =
      await this.integrationService.getIntegrationConfig('razorpay');

    const configData = typeof config === 'string' ? JSON.parse(config) : config;

    const response = await axios.post(
      'https://api.razorpay.com/v1/orders',
      options,
      {
        auth: {
          username: configData.key_id.trim(),
          password: configData.key_secret.trim(),
        },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response?.data;
  }

  async verify(body: any) {
    const config =
      await this.integrationService.getIntegrationConfig('razorpay');
    const configData = typeof config === 'string' ? JSON.parse(config) : config;
    const generatedSignature = crypto
      .createHmac('sha256', configData.key_secret)
      .update(body.razorpay_order_id + '|' + body.razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== body.razorpay_signature) {
      throw new Error('Payment verification failed');
    }

    // Update booking/payment status


    return {
      success: true,
    };
  }

  async createOnlineBooking(dto: any, id: number, country: any) {

   
    const booking      = dto.booking || {};
    const rawPricing   = dto.pricing || {};
    const customer     = dto.customer || dto.customer_details || {};
    const rawAddons    = dto.addons || [];

    const category      = booking.category ?? dto.category;
    const bookingType    = booking.booking_type ?? dto.booking_type ?? dto.reserveType;
    const guestCapacity  = booking.guests ?? dto.event?.guest_capacity ?? 0;
    // const eventType      = booking.event_type ?? dto.event?.event_type ?? null;
    const selectionType  = booking.selection_type ?? dto.event?.selection_type ?? null;
    const selectionMode  = booking.selection_mode ?? dto.event?.selection_mode ?? null;
    const reservation_end_date  = booking.reservation_end_date ??  null;
    const specialRequest = dto.special_request ?? booking.notes ?? null;

    //wallets

   



    // Single-venue shape (new) vs. multi-venue array shape (old / farmstay)
    const venueId   = booking.venue_id ?? null;
    const venueName = booking.venue_name ?? null;
    const legacyVenues = Array.isArray(dto.venues) ? dto.venues : null;

    // Dates: single `date`, or check_in/check_out range (new) vs. event.date_range /
    // event.event_date (old)
    const singleDate = booking.date ?? null;
    const checkIn    = booking.check_in ?? null;
    const checkOut   = booking.check_out ?? null;

    // Shift: single string (new) vs. array of strings (old)
    const shiftRaw = booking.shift ?? dto.event?.shift ?? null;
    const shifts: string[] = Array.isArray(shiftRaw) ? shiftRaw : (shiftRaw ? [shiftRaw] : []);

    // Customer
    const customerName  = customer.name  ?? null;
    const customerPhone = customer.phone ?? null;
    const customerEmail = customer.email ?? null;

    // Pricing — new payload uses camelCase + a single combined GST figure;
    // legacy payload uses snake_case + separate venue/pax GST figures.
    const pricing = {
      baseAmount:        rawPricing.baseAmount        ?? rawPricing.base_amount ?? 0,
      cleaningAmount:    rawPricing.cleaningAmount     ?? 0,
      convenienceFee:    rawPricing.convenienceFee     ?? 0,
      addonAmount:       rawPricing.addon_amount       ?? rawPricing.addonAmount ?? 0,
      securityDeposit:   rawPricing.securityDeposit    ?? rawPricing.security_deposit ?? 0,
      advanceAmount:     rawPricing.advance_amount     ?? 0,
      reservationAmount: rawPricing.reservation_amount ?? 0,
      walletDiscount:    rawPricing.wallet_discount    ?? 0,
      discountAmount:    rawPricing.discount_amount    ?? 0,
      discountPercent:   rawPricing.discount_percent   ?? 0,
      grandTotal:        rawPricing.grand_total ?? rawPricing.final_total ?? 0,
      // GST — combined (new) or split venue/pax GST (legacy)
      isCombinedGst:     rawPricing.gstAmount != null,
      gstAmount:         rawPricing.gstAmount ?? 0,
      gstPercent:        rawPricing.gstPercent ?? 18,
      gstTotalLegacy:    rawPricing.gst_total ?? 0,
      paxGstLegacy:      rawPricing.pax_gst ?? 0,
      estimated_total:      rawPricing.estimated_total ?? 0,

      burnPoint:      rawPricing.burnPoint ?? 0,
      earnedPoints:      rawPricing.earnedPoints ?? 0,
      wallet_discount:      rawPricing.wallet_discount ?? 0,
      paid_amount:      rawPricing.payableNow ?? 0,
    };


    //Find Which Vendor Under 
     const [vendor_detial] = await this.dataSource.query(
      `SELECT created_by FROM venue_child WHERE child_venue_id = ? LIMIT 1`,
      [venueId],
    );


    //Online payment 
    const payment = dto.payment || {};

  
    const taxAmountTotal = pricing.isCombinedGst
      ? pricing.gstAmount
      : (pricing.gstTotalLegacy + pricing.paxGstLegacy);

    const discountAmountTotal = pricing.discountAmount || pricing.walletDiscount || 0;

    // -----------------------------
    // 1. CATEGORY
    // -----------------------------
    const singular = category?.endsWith('s')
      ? category.slice(0, -1)
      : category;

    const [categoryRow] = await this.dataSource.query(
      `SELECT id FROM category WHERE name = ? LIMIT 1`,
      [singular],
    );

    // -----------------------------
    // 2. IDS
    // -----------------------------
    let code = generateCode();

    while (true) {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM bookings WHERE invoice_number = ? LIMIT 1`,
        [code],
      );

      if (rows.length === 0) break;
      code = generateCode();
    }

    // 'book' -> 'booked', 'reserve' -> 'reserve', anything else passes through.
    const reserveType = bookingType === 'book' ? 'booked' : (bookingType || 'draft');

       // Event Type
    const eventRows: any = await this.dataSource.query(
      `SELECT id FROM booking_event_types WHERE event_name = ? LIMIT 1`,
      [booking.event_type ?? dto.event?.event_type],
    );

    const eventTypeId = eventRows.length ? eventRows[0].id : null;

    // -----------------------------
    // 3. MAIN BOOKING INSERT
    // -----------------------------
    const result: any = await this.dataSource.query(
      `
      INSERT INTO bookings
      (
        booking_code,
        invoice_number,
        booking_type,
        category,
        country_id,
        status,
        total_pax,
        base_amount,
        discount_amount,
        tax_amount,
        total_amount,
        notes,
        vendor_id,
        created_by,
        updated_by,
        created_at,
        updated_at,
        booking_event_type_id,
        selection_mode,
        selection_type,
        estimated_total,
        reservation_end_date

      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        code,
        0,
        reserveType,
        categoryRow?.id || null,
        country,
        'active',

        guestCapacity || 0,
        pricing.baseAmount || 0,
        discountAmountTotal,
        taxAmountTotal,
        pricing.grandTotal || 0,

        specialRequest,

        vendor_detial.created_by, // Venue create by vendor ID
        id,
        id,
        new Date(),
        new Date(),
        eventTypeId,
        'Online',
        'Online',
        pricing.estimated_total || 0,
        booking.reservation_end_date
      ],
    );

    const bookingId = result.insertId;

   
    // -----------------------------
    // 4. VENUES
    // -----------------------------
    let venueValues: any[] = [];

    if (legacyVenues?.length) {
      // Old multi-venue / farmstay shape
      venueValues = legacyVenues.map((venue: any) => [
        bookingId,
        venue.parent_venue_id || null,
        venue.child_venue_id || null,
        venue.child_venue_name || null,
      ]);
    } else if (venueId) {
      // New single-venue shape
      venueValues = [[
        bookingId,
        null,
        venueId,
        
        venueName,
      ]];
    }

    if (venueValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_venues
        (booking_id, parent_venue_id, child_venue_id, venue_name_snapshot)
        VALUES ?
        `,
        [venueValues],
      );
    }

    // -----------------------------
    // 5. EVENT DATES
    // -----------------------------
    let eventDates: string[] = [];

    // Farmstay / multi-venue date range (old shape)
    if (legacyVenues?.length && legacyVenues[0]?.start_date && legacyVenues[0]?.end_date) {
      eventDates = getDatesBetween(legacyVenues[0].start_date, legacyVenues[0].end_date);
    }
    // Single-venue check-in/check-out range (new shape)
    else if (checkIn && checkOut) {
      eventDates = getDatesBetween(checkIn, checkOut);
    }
    // Event date range (old shape)
    else if (dto.event?.date_range?.start_date && dto.event?.date_range?.end_date) {
      eventDates = getDatesBetween(
        dto.event.date_range.start_date,
        dto.event.date_range.end_date,
      );
    }
    // Multiple selected dates (old shape)
    else if (Array.isArray(dto.event?.event_date)) {
      eventDates = dto.event.event_date;
    }
    // Single date (new shape)
    else if (singleDate) {
      eventDates = [singleDate];
    }
    // Single date (old shape)
    else if (dto.event?.event_date) {
      eventDates = [dto.event.event_date];
    }

    // Remove duplicates
    eventDates = [...new Set(eventDates)];

    // Insert dates
    const eventDateResult: any[] = [];

    for (const date of eventDates) {
      const res: any = await this.dataSource.query(
        `
          INSERT INTO booking_event_dates
          (booking_id, event_date)
          VALUES (?, ?)
        `,
        [bookingId, date],
      );

      eventDateResult.push({
        id: res.insertId,
        date,
      });
    }

    // -----------------------------
    // 6. SHIFTS
    // -----------------------------
    const SHIFT_MAP: any = {
      morning: 1,
      afternoon: 2,
      evening: 3,
    };

    const shiftValues: any[] = [];

    for (const ed of eventDateResult) {
      for (const shift of shifts) {
        const shiftId = SHIFT_MAP[shift.toLowerCase()];
        if (!shiftId) continue;

        shiftValues.push([
          bookingId,
          ed.id,
          0,
          shift,
          'active',
        ]);
      }
    }

    if (shiftValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_shifts
        (booking_id, event_date_id, venue_id, shift_name, status)
        VALUES ?
        `,
        [shiftValues],
      );
    }

    // -----------------------------
    // 7. CUSTOMER
    // -----------------------------
    await this.dataSource.query(
      `
      INSERT INTO booking_parties
      (
        booking_id,
        party_type,
        party_id,
        name,
        phone,
        email
      )
      VALUES (?,?,?,?,?,?)
      `,
      [
        bookingId,
        'customer',
        0,
        customerName,
        customerPhone,
        customerEmail
      ],
    );

    // -----------------------------
    // 8. SERVICE PROVIDERS
    // -----------------------------
    const providers = dto.service_providers || {};

    const providerValues = Object.entries(providers)
      .filter(([, value]) => value)
      .map(([type, value]: any) => [
        bookingId,
        type,
        0,
        value,
      ]);

    if (providerValues.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_parties
        (booking_id, party_type, party_id, name)
        VALUES ?
        `,
        [providerValues],
      );
    }

    // -----------------------------
    // 9. CHARGES
    // -----------------------------
    const chargeValues: any[] = [];

    // --------------------
    // 1. BASE AMOUNT
    // --------------------
    chargeValues.push([
      bookingId,
      'base',
      'Base Amount',
      1,
      pricing.baseAmount || 0,
      pricing.baseAmount || 0,
    ]);

    // --------------------
    // 2. ADDONS
    // --------------------
    if (rawAddons.length) {
      // New shape sends { add_on_id, qty, price, total } with no name — look the
      // names up in one batch query so charge rows stay human-readable.
      const addonIds = rawAddons
        .map((a: any) => a.add_on_id)
        .filter((v: any) => v != null);

      let addonNameById: Record<string, string> = {};
      if (addonIds.length) {
        const addonRows = await this.dataSource.query(
          `SELECT add_on_id as id, add_on_name as name FROM add_ons WHERE add_on_id IN (?)`,
          [addonIds],
        );
        addonNameById = Object.fromEntries(
          addonRows.map((r: any) => [r.id, r.name]),
        );
      }

      for (const addon of rawAddons) {
        const name     = addon.name || addonNameById[addon.add_on_id] || 'Add-on';
        const qty      = addon.qty ?? 1;
        const unitPrice = addon.price ?? addon.unit_price ?? 0;
        const total    = addon.total ?? addon.amount ?? (qty * unitPrice);

        chargeValues.push([
          bookingId,
          'addon',
          name,
          qty,
          unitPrice,
          total,
        ]);
      }
    }

    // --------------------
    // 3. CONVENIENCE FEE (new)
    // --------------------
    if (pricing.convenienceFee) {
      chargeValues.push([
        bookingId,
        'convenience_fee',
        'Convenience Fee',
        1,
        pricing.convenienceFee,
        pricing.convenienceFee,
      ]);
    }

    // --------------------
    // 4. CLEANING FEE (new)
    // --------------------
    if (pricing.cleaningAmount) {
      chargeValues.push([
        bookingId,
        'cleaning_fee',
        'Cleaning Fee',
        1,
        pricing.cleaningAmount,
        pricing.cleaningAmount,
      ]);
    }

    // --------------------
    // 5. SECURITY DEPOSIT
    // --------------------
    if (pricing.securityDeposit) {
      chargeValues.push([
        bookingId,
        'security_deposit',
        'Security Deposit',
        1,
        pricing.securityDeposit,
        pricing.securityDeposit,
      ]);
    }

    // --------------------
    // 6. ADVANCE PAYMENT
    // --------------------
    if (pricing.advanceAmount) {
      chargeValues.push([
        bookingId,
        'advance',
        'Advance Payment',
        1,
        pricing.advanceAmount,
        pricing.advanceAmount,
      ]);
    }

    // --------------------
    // 7. RESERVATION AMOUNT
    // --------------------
    if (pricing.reservationAmount) {
      chargeValues.push([
        bookingId,
        'reservation',
        'Reservation Amount',
        1,
        pricing.reservationAmount,
        pricing.reservationAmount,
      ]);
    }

    // --------------------
    // 8. DISCOUNT — explicit discount (old) takes priority over wallet discount (new)
    // --------------------
    if (pricing.discountAmount) {
      chargeValues.push([
        bookingId,
        'discount',
        'Discount',
        1,
        -pricing.discountPercent,
        -pricing.discountAmount,
      ]);
    } else if (pricing.walletDiscount) {
      chargeValues.push([
        bookingId,
        'wallet_discount',
        'Wallet Discount',
        1,
        0,
        -pricing.walletDiscount,
      ]);
    }

    // --------------------
    // INSERT ALL
    // --------------------
    await this.dataSource.query(
      `
      INSERT INTO booking_charges
      (booking_id, charge_type, title, quantity, unit_price, total_price)
      VALUES ?
      `,
      [chargeValues],
    );

    // -----------------------------
    // TAXES — combined GST (new) or split venue/pax GST (legacy)
    // -----------------------------
    const taxes: any[] = [];

    if (pricing.isCombinedGst) {
      if (pricing.gstAmount > 0) {
        taxes.push([
          bookingId,
          'GST',
          pricing.gstPercent || 18,
          0,
          pricing.gstAmount,
        ]);
      }
    } else {
      if (pricing.gstTotalLegacy > 0) {
        taxes.push([
          bookingId,
          'Venue GST',
          18,
          0,
          pricing.gstTotalLegacy,
        ]);
      }

      if (pricing.paxGstLegacy > 0) {
        taxes.push([
          bookingId,
          'PAX GST',
          5,
          0,
          pricing.paxGstLegacy,
        ]);
      }
    }

    if (taxes.length) {
      await this.dataSource.query(
        `
        INSERT INTO booking_taxes
        (booking_id, tax_name, tax_percent, taxable_amount, tax_amount)
        VALUES ?
        `,
        [taxes],
      );
    }

    // -----------------------------
    // 10. LOGS
    // -----------------------------
    await this.createLog(
      'booking',
      bookingId,
      'created',
      `Booking ${code} created`,
      id,
      null,
      {
        booking_type: reserveType,
        customer: customerName,
        total_amount: pricing.grandTotal,
      },
    );

    // Realtime
    this.socketService.realtime(
      id.toString(),
      'Booking',
      `Booking ${code} created`
    );

    // Email
    const invoiceData = {
      email: customerEmail,
      id: bookingId,
    };
    this.invoiceService.sendInvoice(invoiceData);

    await this.notificationService.createNotification({
      type: reserveType,
      referenceId: bookingId,
      title: `New ${reserveType}`,
      message: `New ${reserveType} received - ${code}`,
      createdBy: id,
    });

    //twilioService
//   await this.twilioService.sendWhatsApp({
//   to: `+91${customerPhone}`,
//   body: `Your ${reserveType} booking has been received successfully.📌 Booking ID: ${code}`
// });
    //ZOHO 

    //Payment

//------------------------------------------------------------------
//Online transaction  AMount
//------------------------------------------------------------------

let paid = pricing.paid_amount;

await this.addPayment(bookingId,paid ,id ,payment)

await this.updateMemberTier(id);//check membership

//------------------------------------------------------------------
//Online transaction  AMount
//------------------------------------------------------------------
   

const subtotalWithoutExcluded = chargeValues.reduce((total, charge) => {
  const excludedTypes = [
    'convenience_fee',
    'wallet_discount',
    'security_deposit',
    'discount',
    'reservation',
  ];

  if (excludedTypes.includes(charge[1])) {
    return total;
  }

  return total + Number(charge[5] || 0);
}, 0);


    const commison  = subtotalWithoutExcluded*5/100; // Calculate Commision


    //-------------------------------------------------------//
    //  ZOHO ACTIVATION //
    //-------------------------------------------------------//

    await this.createZohoTransaction({
      customer: customerName,
      email: customerEmail,
      phone: customerPhone,
      bookingId: code,
     
      total_amount: pricing.grandTotal,
      category:singular,
      convenienceFee:pricing.convenienceFee,
      charge_amount:commison

    });

     //wallets


  const rewardCategoryId = categoryRow?.id ?? null;

  // Wrapped in try/catch so a rewards failure (insufficient points, a bad
  // category id, a transient DB error, etc.) never rolls back or crashes an
  // already-successful booking — it just gets logged, and the booking
  // response still returns success.
  if (pricing.earnedPoints > 0) {
    try {
      await this.addRewardPoints(
        id,                        // user_id
        bookingId,                 // booking_id
        '',                      // order_id / invoice number
        rewardCategoryId,          // category_id
        Math.round(pricing.earnedPoints),  // points — force integer
        pricing.grandTotal,        // amount
        'Booking reward earned',
        'reward',
      );
    } catch (err) {
      console.error('Failed to credit reward points for booking', bookingId, err);
    }
  }

  if (pricing.burnPoint > 0) {
    try {
      await this.addRewardPoints(
        id,                     // user_id
        bookingId,              // booking_id
        '',                   // order_id / invoice number
        rewardCategoryId,       // category_id
        Math.round(pricing.burnPoint),  // points — force integer
        pricing.burnPoint,        // redeemed amount
        'Reward points redeemed',
        'redeem',
      );
    } catch (err) {
      console.error('Failed to redeem reward points for booking', bookingId, err);
    }
  }



    return {
      success: true,
      booking_id: bookingId,
      invoice_number: code,
      reserveType: reserveType
    };
  }



async createLog(
  module: string,
  recordId: number,
  action: string,
  description: string,
  userId?: number,
  oldValue?: any,
  newValue?: any,
) {
  await this.dataSource.query(
  `
  INSERT INTO booking_logs
  (
    booking_id,
    action,
    description,
    old_value,
    new_value,
    created_by,
    created_at
  )
  VALUES (?,?,?,?,?,?,?)
  `,
  [
    recordId,
     module,
    description,
    null,
    JSON.stringify(newValue),
    userId,
    new Date(),
  ]
);

}
  //

//   async webhook(req: any, res: any) {
//   try {
//     // Get Razorpay configuration
//     const config = await this.integrationService.getIntegrationConfig('razorpay');

//     const configData =
//       typeof config === 'string' ? JSON.parse(config) : config;

//     // Get Razorpay Signature
//     const signature = req.headers['x-razorpay-signature'];

//     if (!signature) {
//       return res.status(400).send('Missing Signature');
//     }

//     // Verify Webhook Signature
//     const generatedSignature = crypto
//       .createHmac('sha256', configData.webhook_secret)
//       .update(req.rawBody)
//       .digest('hex');

//     if (signature !== generatedSignature) {
//       return res.status(400).send('Invalid Signature');
//     }

//     const event = req.body.event;

//     switch (event) {
//       case 'payment.captured': {
//         const payment = req.body.payload.payment.entity;

//         await this.dataSource.query(
//           `
//           INSERT INTO user_subscription_payments (
//             subscription_id,
//             user_id,
//             order_id,
//             transaction_id,
//             payment_id,
//             amount,
//             tax_amount,
//             total_amount,
//             payment_method,
//             payment_status,
//             paid_at,
//             failure_reason,
//             created_at
//           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())
//           `,
//           [
//             null,                           // subscription_id
//             null,                           // user_id
//             payment.order_id,
//             payment.id,
//             payment.id,
//             payment.amount / 100,
//             0,
//             payment.amount / 100,
//             payment.method,
//             payment.status,
//             null,
//           ],
//         );

//         console.log('Payment Captured:', payment.id);
//         break;
//       }

//       case 'payment.failed': {
//         const payment = req.body.payload.payment.entity;

//         await this.dataSource.query(
//           `
//           INSERT INTO user_subscription_payments (
//             subscription_id,
//             user_id,
//             order_id,
//             transaction_id,
//             payment_id,
//             amount,
//             tax_amount,
//             total_amount,
//             payment_method,
//             payment_status,
//             paid_at,
//             failure_reason,
//             created_at
//           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NOW())
//           `,
//           [
//             null,
//             null,
//             payment.order_id,
//             payment.id,
//             payment.id,
//             payment.amount / 100,
//             0,
//             payment.amount / 100,
//             payment.method,
//             'failed',
//             payment.error_description || payment.error_reason || null,
//           ],
//         );

//         console.log('Payment Failed:', payment.id);
//         break;
//       }

//       case 'order.paid': {
//         const order = req.body.payload.order.entity;

//         console.log('Order Paid:', order.id);

//         break;
//       }

//       default:
//         console.log('Unhandled Event:', event);
//     }

//     return res.status(200).send({
//       success: true,
//       message: 'Webhook Processed',
//     });
//   } catch (error) {
//     console.error('Webhook Error:', error);

//     return res.status(500).send({
//       success: false,
//       message: 'Internal Server Error',
//     });
//   }
// }

//wallets
async addRewardPoints(
  userId: number,
  bookingId: number,
  orderId: string,
  categoryId: number,
  points: number,
  amount: number,
  remarks: string,
  transactionType: 'reward' | 'redeem',
) {
  const queryRunner = this.dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const balance = await queryRunner.query(
      `
      SELECT *
      FROM reward_point_balance
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId],
    );

    if (balance.length > 0) {
      if (transactionType === 'reward') {
        // Add points
        await queryRunner.query(
          `
          UPDATE reward_point_balance
          SET
            total_points = total_points + ?,
            available_points = available_points + ?,
            updated_at = NOW()
          WHERE user_id = ?
          `,
          [points, points, userId],
        );
      } else {
        // Redeem points
        const available = Number(balance[0].available_points);

        if (available < points) {
          throw new BadRequestException('Insufficient reward points.');
        }

        await queryRunner.query(
          `
          UPDATE reward_point_balance
          SET
            available_points = available_points - ?,
            redeemed_points = redeemed_points + ?,
            updated_at = NOW()
          WHERE user_id = ?
          `,
          [points, points, userId],
        );
      }
    } else {
      if (transactionType === 'reward') {
        // First reward entry
        await queryRunner.query(
          `
          INSERT INTO reward_point_balance
          (
            user_id,
            mem_id,
            total_points,
            available_points,
            redeemed_points,
            expired_points,
            updated_at
          )
          VALUES (?, ?, ?, ?, 0, 0, NOW())
          `,
          [
            userId,
            1, // Default membership tier
            points,
            points,
          ],
        );
      } else {
        throw new BadRequestException('Reward wallet not found.');
      }
    }

    // Transaction history
    await queryRunner.query(
      `
      INSERT INTO reward_point_transactions
      (
        user_id,
        booking_id,
        order_id,
        category_id,
        transaction_type,
        points,
        amount,
        expiry_date,
        remarks,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR), ?, NOW())
      `,
      [
        userId,
        bookingId,
        orderId,
        categoryId,
        transactionType, // reward | redeem
        points,
        amount,
        remarks,
      ],
    );

    await queryRunner.commitTransaction();

    return {
      success: true,
      message:
        transactionType === 'reward'
          ? 'Reward points credited successfully.'
          : 'Reward points redeemed successfully.',
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
async onlinepayment(body:any,id:any)
{
  const  { booking_id,paid_amount } = body.payment;
  return await this.addPayment(booking_id,paid_amount,id ,body.payment);
}

async addPayment(bookingId:any,paid:any,id:any ,payment:any)
{

  const transactionId = payment.razorpay_payment_id || null;
  const paymentMethod = payment.payment_method || 'Online';

// const charges = await this.dataSource.query(
//   `
//   SELECT
//       charge_type,
//       total_price
//   FROM booking_charges
//   WHERE booking_id = ?
//     AND charge_type IN ('addon','security_deposit','base')
//   ORDER BY FIELD(charge_type,'addon','security_deposit','base')
//   `,
//   [bookingId],
// );

const charges = await this.dataSource.query(
  `
 SELECT
    c.charge_type,
    CASE
        WHEN c.charge_type IN ('base', 'addon','convenience_fee')
            THEN ROUND(c.total_price * 1.18, 2)
        ELSE
            c.total_price
    END AS total_price
FROM booking_charges c
WHERE c.booking_id = ?
  AND c.charge_type IN ('addon', 'base', 'security_deposit','convenience_fee')
ORDER BY FIELD(c.charge_type, 'addon', 'security_deposit', 'base','convenience_fee');
  `,
  [bookingId],
);

const payments: any[] = [];

for (const charge of charges) {
  if (paid <= 0) break;

  const amount = Math.min(charge.total_price, paid);

  await this.dataSource.query(
    `
    INSERT INTO booking_payments
    (
      booking_id,
      payment_date,
      payment_type,
      payment_method,
      transaction_id,
      amount_paid,
      payment_status,
      paid_at
    )
    VALUES (?, CURDATE(), ?, ?, ?, ?, 'paid', NOW())
    `,
    [
      bookingId,
      charge.charge_type =='base' ? 'base_amount': charge.charge_type,
      paymentMethod,
      transactionId,
      amount,
    ],
  );

  payments.push({
    booking_id: bookingId,
    payment_type: charge.charge_type =='base' ? 'base_amount': charge.charge_type,
    payment_method: paymentMethod,
    transaction_id: transactionId,
    amount_paid: amount,
    payment_date: new Date(),
  });

  paid -= amount;
}

// Create log for each payment
for (const payment of payments) {
  await this.createLog(
    'booking',
    bookingId,
    'payment_received',
    `Payment received - ${payment.payment_type} ₹${Number(
      payment.amount_paid,
    ).toLocaleString('en-IN')}`,
    id,
    null,
    {
      payment_type: payment.payment_type,
      payment_method: payment.payment_method,
      amount_paid: payment.amount_paid,
      payment_date: payment.payment_date,
      transaction_id: payment.transaction_id,
    },
  );
}

// Realtime Notification
// this.socketService.realtime(
//   id.toString(),
//   'Payment',
//   `Payment of ₹${payments
//     .reduce((sum, p) => sum + Number(p.amount_paid), 0)
//     .toLocaleString('en-IN')} received`,
// );

// App Notification
await this.notificationService.createNotification({
  type: 'Payment',
  referenceId: bookingId,
  title: 'New Payment',
  message: `Payment of ₹${payments
    .reduce((sum, p) => sum + Number(p.amount_paid), 0)
    .toLocaleString('en-IN')} received successfully.`,
  createdBy: id,
});

}

async updateMemberTier(userId: number) {
  // Get booking count and amount
  const [booking] = await this.dataSource.query(
    `
    SELECT
      COUNT(*) AS booking_count,
      COALESCE(SUM(total_amount), 0) AS booking_amount
    FROM bookings
    WHERE selection_mode = 'Online'
      AND booking_type = 'booked'
      AND created_by = ?
    `,
    [userId],
  );

  const bookingCount = Number(booking.booking_count);
  const bookingAmount = Number(booking.booking_amount);

  // Get all tiers
  const tiers = await this.dataSource.query(
    `
    SELECT *
    FROM member_tier
    ORDER BY min_booking ASC
    `,
  );

  let currentTier: any = null;

  // Find the correct tier
  for (const tier of tiers) {
    const minBooking = Number(tier.min_booking);
    const maxBooking = Number(tier.max_booking);

    if (
      bookingCount >= minBooking &&
      bookingCount <= maxBooking
    ) {
      currentTier = tier;
      break;
    }
  }

  // No tier found
  if (!currentTier) {
    return {
      success: false,
      message: 'No tier found',
    };
  }

  // Check reward balance row exists
  const [balance] = await this.dataSource.query(
    `
    SELECT id
    FROM reward_point_balance
    WHERE user_id = ?
    `,
    [userId],
  );

  if (balance) {
    // Update existing record
    await this.dataSource.query(
      `
      UPDATE reward_point_balance
      SET
        mem_id = ?,
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [currentTier.id, userId],
    );
  } else {
    // Create new record
    await this.dataSource.query(
      `
      INSERT INTO reward_point_balance
      (
        user_id,
        mem_id,
        total_points,
        available_points,
        redeemed_points,
        expired_points,
        updated_at
      )
      VALUES (?, ?, 0, 0, 0, 0, NOW())
      `,
      [userId, currentTier.id],
    );
  }

  return {
    success: true,
    bookingCount,
    bookingAmount,
    tier: currentTier,
  };
}


//ZOHO 
//  async createZohoTransaction({
//   customer,
//   email,
//   phone,
//   bookingId,
//   total_amount,
//   category,
//   convenienceFee,
//   charge_amount,
// }: {
//   customer: string;
//   email: string;
//   phone: string;
//   bookingId: string;
//   total_amount: number;
//   category: string;
//   convenienceFee: any;
//   charge_amount: any;
// }) {
//   const items = [] as any[];

//   // Convenience Fee (common for venue & farmstay)
//   if (category === 'venue' || category === 'farmstay') {
//     items.push({
//       itemId: '3975444000000033267', // Convenience Fee
//       quantity: 1,
//       rate: convenienceFee,
//     });
//   }

//   // Venue Commission
//   if (category === 'venue') {
//     items.push({
//       itemId: '3975444000000033239', // Venue Commission
//       quantity: 1,
//       rate: charge_amount,
//     });
//   }

//   // Farmstay Commission
//   if (category === 'farmstay') {
//     items.push({
//       itemId: '3975444000000033258', // Farmstay Commission
//       quantity: 1,
//       rate: charge_amount,
//     });
//   }

//   // // Subscription
//   if (category === 'subscription') {
//     items.push({
//       itemId: '3975444000000033229', // Subscription
//       quantity: 1,
//       rate: total_amount,
//     });
//   }

//   return await this.zohoService.completeBookingZoho({
//     customer: {
//       name: customer,
//       email,
//       phone,
//     },
//     items,
//     booking: {
//       bookingNo: bookingId,
//       bookingDate: dayjs().format('YYYY-MM-DD'),
//       notes: `Customer ${category} booking`,
//     },
//     payment: {
//       amount: total_amount,
//       mode: 'Online',
//       date: dayjs().format('YYYY-MM-DD'),
//     },
//   });
// }

async cancelBooking(body: any, id: number) {
  const refundAmount = Number(body.refund_amount || 0);

  await this.dataSource.transaction(async (manager) => {
    // Cancel Booking
    await manager.query(
      `
      UPDATE bookings
      SET
        status = ?,
        cancellation_date = NOW(),
        cancellation_reason = ?
      WHERE id = ?
      `,
      ['cancelled', body.reason, body.booking_id],
    );

    // Insert Refund Payment
    if (refundAmount > 0) {
      await manager.query(
        `
        INSERT INTO booking_payments
        (
          booking_id,
          payment_date,
          payment_type,
          payment_method,
          transaction_id,
          amount_paid,
          payment_status,
          paid_at
        )
        VALUES
        (?, CURDATE(), 'refund', 'System', NULL, ?, 'refunded', NOW())
        `,
        [body.booking_id, refundAmount],
      );
    }

    // Booking Log
    await this.createLog(
      'booking',
      body.booking_id,
      'booking_cancelled',
      `Booking cancelled${refundAmount > 0 ? ` - Refund ₹${refundAmount.toLocaleString('en-IN')}` : ''}`,
      id,
      null,
      {
        cancellation_reason: body.reason,
        refund_amount: refundAmount,
      },
    );

    // Notification
    await this.notificationService.createNotification({
      type: 'Booking',
      referenceId: body.booking_id,
      title: 'Booking Cancelled',
      message:
        refundAmount > 0
          ? `Your booking has been cancelled. Refund of ₹${refundAmount} will be processed.`
          : 'Your booking has been cancelled.',
      createdBy: id,
    });

    // Realtime Notification
    // this.socketService.realtime(
    //   id.toString(),
    //   'Booking',
    //   refundAmount > 0
    //     ? `Booking cancelled. Refund ₹${refundAmount.toLocaleString('en-IN')} initiated.`
    //     : 'Booking cancelled successfully.',
    // );
  });

  return {
    success: true,
    message: 'Booking cancelled successfully.',
  };
}


 // =========================================================
  // RAZORPAY WEBHOOK
  // =========================================================

  async webhook(req: any, res: any) {
    console.log( 'Razorpay webhook Has been Created')
    try {
      // =====================================================
      // 1. GET RAZORPAY CONFIG
      // =====================================================

      const config =
        await this.integrationService.getIntegrationConfig(
          'razorpay',
        );

      const configData =
        typeof config === 'string'
          ? JSON.parse(config)
          : config;

      const webhookSecret =
        configData?.webhook_secret;

      if (!webhookSecret) {
        this.logger.error(
          'Razorpay webhook secret not configured',
        );

        return res.status(500).send({
          success: false,
          message:
            'Razorpay webhook secret not configured',
        });
      }

      // =====================================================
      // 2. GET HEADERS
      // =====================================================

      const signature =
        req.headers['x-razorpay-signature'];

      const eventId =
        req.headers['x-razorpay-event-id'];

      if (!signature) {
        this.logger.error(
          'Missing Razorpay signature',
        );

        return res.status(400).send({
          success: false,
          message: 'Missing Signature',
        });
      }

      if (!eventId) {
        this.logger.error(
          'Missing Razorpay event ID',
        );

        return res.status(400).send({
          success: false,
          message: 'Missing Event ID',
        });
      }

      // =====================================================
      // 3. GET RAW BODY
      // =====================================================

      const rawBody =
        req.rawBody ||
        (Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(
              JSON.stringify(req.body),
            ));

      if (!rawBody) {
        this.logger.error(
          'Razorpay raw body is missing',
        );

        return res.status(400).send({
          success: false,
          message: 'Raw body unavailable',
        });
      }

      // =====================================================
      // 4. VERIFY RAZORPAY SIGNATURE
      // =====================================================

      const generatedSignature =
        crypto
          .createHmac(
            'sha256',
            webhookSecret,
          )
          .update(rawBody)
          .digest('hex');

      if (
        signature.length !==
        generatedSignature.length
      ) {
        this.logger.error(
          'Invalid Razorpay signature length',
        );

        return res.status(400).send({
          success: false,
          message: 'Invalid Signature',
        });
      }

      const isValid =
        crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(generatedSignature),
        );

      if (!isValid) {
        this.logger.error(
          'Invalid Razorpay webhook signature',
        );

        return res.status(400).send({
          success: false,
          message: 'Invalid Signature',
        });
      }

      this.logger.log(
        'Razorpay signature verified',
      );

      // =====================================================
      // 5. GET EVENT
      // =====================================================

      const event =
        req.body?.event;

      if (!event) {
        return res.status(400).send({
          success: false,
          message: 'Event missing',
        });
      }

      this.logger.log(
        `Razorpay Event: ${event}`,
      );

      this.logger.log(
        `Razorpay Event ID: ${eventId}`,
      );

      // =====================================================
      // 6. CHECK DUPLICATE WEBHOOK
      // =====================================================

      const [existingEvent] =
        await this.dataSource.query(
          `
          SELECT id, status
          FROM razorpay_webhook_events
          WHERE event_id = ?
          LIMIT 1
          `,
          [eventId],
        );

      if (existingEvent) {
        this.logger.warn(
          `Duplicate Razorpay webhook: ${eventId}`,
        );

        return res.status(200).send({
          success: true,
          message: 'Webhook already processed',
        });
      }

      // =====================================================
      // 7. SAVE WEBHOOK EVENT
      // =====================================================

      await this.dataSource.query(
        `
        INSERT INTO razorpay_webhook_events
        (
          event_id,
          event_type,
          payload,
          status,
          created_at
        )
        VALUES (?, ?, ?, 'received', NOW())
        `,
        [
          eventId, 
          event,
          JSON.stringify(req.body),
        ],
      );

      // =====================================================
      // 8. PAYMENT CAPTURED
      // =====================================================

      if (event === 'payment.captured') {
        await this.handlePaymentCaptured(
          req.body,
        );
      }

      else if (event === 'subscription.authenticated') {
        await this.handlePaymentCaptured(
          req.body,
        );
      }
      else if (event === 'subscription.activated') {
        await this.handlePaymentCaptured(
          req.body,
        );
      }

      

      // =====================================================
      // 9. PAYMENT FAILED
      // =====================================================

      else if (event === 'payment.failed') {
        await this.handlePaymentFailed(
          req.body,
        );
      }

      // =====================================================
      // 10. ORDER PAID
      // =====================================================

      else if (event === 'order.paid') {
        await this.handleOrderPaid(
          req.body,
        );
      }

      // =====================================================
      // 11. REFUND CREATED
      // =====================================================

      else if (event === 'refund.created') {
        await this.handleRefundCreated(
          req.body,
        );
      }

      // =====================================================
      // 12. REFUND PROCESSED
      // =====================================================

      else if (event === 'refund.processed') {
        await this.handleRefundProcessed(
          req.body,
        );
      }

      // =====================================================
      // 13. REFUND FAILED
      // =====================================================

      else if (event === 'refund.failed') {
        await this.handleRefundFailed(
          req.body,
        );
      }

      // =====================================================
      // 14. UNKNOWN EVENT
      // =====================================================

      else {
        this.logger.warn(
          `Unhandled Razorpay event: ${event}`,
        );
      }

      // =====================================================
      // 15. MARK WEBHOOK PROCESSED
      // =====================================================

      await this.dataSource.query(
        `
        UPDATE razorpay_webhook_events
        SET
          status = 'processed',
          processed_at = NOW()
        WHERE event_id = ?
        `,
        [eventId],
      );

      // =====================================================
      // 16. RESPONSE
      // =====================================================

      return res.status(200).send({
        success: true,
        message: 'Webhook Processed',
        event,
        eventId,
      });

    } catch (error) {
      this.logger.error(
        'Razorpay Webhook Error',
         error,
      );

      return res.status(500).send({
        success: false,
        message: 'Internal Server Error',
      });
    }
  }

  // =========================================================
  // PAYMENT CAPTURED
  // =========================================================

  private async handlePaymentCaptured(
    body: any,
  ) {
    const payment =
      body?.payload?.payment?.entity;

    if (!payment) {
      throw new Error(
        'Payment entity not found',
      );
    }

    const razorpayOrderId =
      payment.order_id;

    const razorpayPaymentId =
      payment.id;

    const amount =
      Number(payment.amount || 0) / 100;

    this.logger.log(
      `Payment Captured: ${razorpayPaymentId}`,
    );

    this.logger.log(
      `Razorpay Order: ${razorpayOrderId}`,
    );

    // =====================================================
    // FIND SUBSCRIPTION
    // =====================================================

    const [subscription] =
      await this.dataSource.query(
        `
        SELECT
          id,
          user_id,
          razorpay_order_id,
          status
        FROM user_subscriptions
        WHERE razorpay_order_id = ?
        LIMIT 1
        `,
        [razorpayOrderId],
      );

    if (!subscription) {
      this.logger.error(
        `Subscription not found for Razorpay order: ${razorpayOrderId}`,
      );

      throw new Error(
        `Subscription not found: ${razorpayOrderId}`,
      );
    }

    const subscriptionId =
      subscription.id;

    const userId =
      subscription.user_id;

    // =====================================================
    // GET USER
    // =====================================================

    const [user] =
      await this.dataSource.query(
        `
        SELECT
          id,
          name,
          email,
          phone
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
        [userId],
      );

    if (!user) {
      throw new Error(
        `User not found: ${userId}`,
      );
    }

    const customerName =
      user.name || '';

    const customerEmail =
      user.email || '';

    const customerPhone =
      user.phone || '';

    // =====================================================
    // CHECK EXISTING PAYMENT
    // =====================================================

    const [existingPayment] =
      await this.dataSource.query(
        `
        SELECT
          id,
          payment_status
        FROM user_subscription_payments
        WHERE payment_id = ?
        LIMIT 1
        `,
        [razorpayPaymentId],
      );

    // =====================================================
    // INSERT PAYMENT
    // =====================================================

    if (!existingPayment) {
      await this.dataSource.query(
        `
        INSERT INTO user_subscription_payments
        (
          subscription_id,
          user_id,
          order_id,
          transaction_id,
          payment_id,
          amount,
          tax_amount,
          total_amount,
          payment_method,
          payment_status,
          paid_at,
          failure_reason,
          created_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          'captured',
          NOW(),
          NULL,
          NOW()
        )
        `,
        [
          subscriptionId,
          userId,
          razorpayOrderId,
          razorpayPaymentId,
          razorpayPaymentId,

          amount,

          0,

          amount,

          payment.method || null,
        ],
      );

      this.logger.log(
        `Payment inserted: ${razorpayPaymentId}`,
      );
    }

    // =====================================================
    // UPDATE EXISTING PAYMENT
    // =====================================================

    else {
      await this.dataSource.query(
        `
        UPDATE user_subscription_payments
        SET
          subscription_id = ?,
          user_id = ?,
          order_id = ?,
          amount = ?,
          total_amount = ?,
          payment_method = ?,
          payment_status = 'captured',
          paid_at = NOW(),
          failure_reason = NULL
        WHERE payment_id = ?
        `,
        [
          subscriptionId,
          userId,
          razorpayOrderId,

          amount,
          amount,

          payment.method || null,

          razorpayPaymentId,
        ],
      );

      this.logger.log(
        `Payment updated: ${razorpayPaymentId}`,
      );
    }

    // =====================================================
    // UPDATE SUBSCRIPTION
    // =====================================================

    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
        status = 'active',
        payment_status = 'paid',
        razorpay_payment_id = ?,
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        razorpayPaymentId,
        subscriptionId,
      ],
    );

    this.logger.log(
      `Subscription activated: ${subscriptionId}`,
    );

    // =====================================================
    // ZOHO ACTIVATION
    // =====================================================

    try {
      await this.createZohoTransaction({
        customer: customerName,
        email: customerEmail,
        phone: customerPhone,

        // Use your subscription code if available.
        // Otherwise use subscription ID.
        bookingId: `SUB-${subscriptionId}`,

        // Razorpay amount is paise.
        // Zoho gets normal currency amount.
        total_amount: amount,

        category: 'subscription',

        convenienceFee: 0,

        charge_amount: 0,
      });

      this.logger.log(
        `Zoho transaction created for payment: ${razorpayPaymentId}`,
      );

    } catch (zohoError) {
     
      this.logger.error(
        `Zoho transaction failed for payment ${razorpayPaymentId}`,
         zohoError,
      );

    }

    // =====================================================
    // END PAYMENT CAPTURED
    // =====================================================

    return {
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      subscriptionId,
      userId,
      amount,
    };
  }

  // =========================================================
  // PAYMENT FAILED
  // =========================================================

  private async handlePaymentFailed(
    body: any,
  ) {
    const payment =
      body?.payload?.payment?.entity;

    if (!payment) {
      throw new Error(
        'Payment entity not found',
      );
    }

    const razorpayOrderId =
      payment.order_id;

    const razorpayPaymentId =
      payment.id;

    const amount =
      Number(payment.amount || 0) / 100;

    const failureReason =
      payment.error_description ||
      payment.error_reason ||
      payment.error_code ||
      'Payment failed';

    this.logger.warn(
      `Payment Failed: ${razorpayPaymentId}`,
    );

    // =====================================================
    // FIND SUBSCRIPTION
    // =====================================================

    const [subscription] =
      await this.dataSource.query(
        `
        SELECT
          id,
          user_id
        FROM user_subscriptions
        WHERE razorpay_order_id = ?
        LIMIT 1
        `,
        [razorpayOrderId],
      );

    if (!subscription) {
      this.logger.warn(
        `Subscription not found: ${razorpayOrderId}`,
      );

      return;
    }

    // =====================================================
    // CHECK PAYMENT
    // =====================================================

    const [existingPayment] =
      await this.dataSource.query(
        `
        SELECT id
        FROM user_subscription_payments
        WHERE payment_id = ?
        LIMIT 1
        `,
        [razorpayPaymentId],
      );

    // =====================================================
    // INSERT
    // =====================================================

    if (!existingPayment) {
      await this.dataSource.query(
        `
        INSERT INTO user_subscription_payments
        (
          subscription_id,
          user_id,
          order_id,
          transaction_id,
          payment_id,
          amount,
          tax_amount,
          total_amount,
          payment_method,
          payment_status,
          paid_at,
          failure_reason,
          created_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          0,
          ?,
          ?,
          'failed',
          NULL,
          ?,
          NOW()
        )
        `,
        [
          subscription.id,
          subscription.user_id,

          razorpayOrderId,
          razorpayPaymentId,
          razorpayPaymentId,

          amount,
          amount,

          payment.method || null,

          failureReason,
        ],
      );
    }

    // =====================================================
    // UPDATE SUBSCRIPTION
    // =====================================================

    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
        payment_status = 'failed',
        updated_at = NOW()
      WHERE id = ?
      `,
      [subscription.id],
    );

    this.logger.log(
      `Subscription payment marked failed: ${subscription.id}`,
    );
  }

  // =========================================================
  // ORDER PAID
  // =========================================================

  private async handleOrderPaid(
    body: any,
  ) {
    const order =
      body?.payload?.order?.entity;

    if (!order) {
      throw new Error(
        'Order entity not found',
      );
    }

    this.logger.log(
      `Order Paid: ${order.id}`,
    );

    const [subscription] =
      await this.dataSource.query(
        `
        SELECT id
        FROM user_subscriptions
        WHERE razorpay_order_id = ?
        LIMIT 1
        `,
        [order.id],
      );

    if (!subscription) {
      this.logger.warn(
        `Local subscription not found for order: ${order.id}`,
      );

      return;
    }

    await this.dataSource.query(
      `
      UPDATE user_subscriptions
      SET
        status = 'active',
        payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
      WHERE id = ?
      `,
      [subscription.id],
    );

    this.logger.log(
      `Order marked paid: ${order.id}`,
    );
  }

  // =========================================================
  // REFUND CREATED
  // =========================================================

  private async handleRefundCreated(
    body: any,
  ) {
    const refund =
      body?.payload?.refund?.entity;

    if (!refund) {
      return;
    }

    this.logger.log(
      `Refund Created: ${refund.id}`,
    );

    // Add refund DB update here if required.
  }

  // =========================================================
  // REFUND PROCESSED
  // =========================================================

  private async handleRefundProcessed(
    body: any,
  ) {
    const refund =
      body?.payload?.refund?.entity;

    if (!refund) {
      return;
    }

    this.logger.log(
      `Refund Processed: ${refund.id}`,
    );

    // Add refund DB update here if required.
  }

  // =========================================================
  // REFUND FAILED
  // =========================================================

  private async handleRefundFailed(
    body: any,
  ) {
    const refund =
      body?.payload?.refund?.entity;

    if (!refund) {
      return;
    }

    this.logger.warn(
      `Refund Failed: ${refund.id}`,
    );

    // Add refund DB update here if required.
  }

  // =========================================================
  // ZOHO TRANSACTION
  // =========================================================

  private async createZohoTransaction(
    data: {
      customer: string;
      email: string;
      phone: string;
      bookingId: string;
      total_amount: number;
      category: string;
      convenienceFee: number;
      charge_amount: number;
    },
  ) {
    // YOUR EXISTING ZOHO IMPLEMENTATION
    //
    // Example:
    //
    // return await this.zohoService.createTransaction(data);

    console.log(
      'Zoho Transaction:',
      data,
    );
  }

 async handleCallback(data: any) {
  console.log(
    'Razorpay callback service:',
    data,
  );

  const {
    razorpay_payment_id,
    razorpay_payment_link_id,
    razorpay_payment_link_reference_id,
    razorpay_payment_link_status,
    razorpay_signature,
  } = data;

  let subscriptionId = null;

  /*
   * Example:
   *
   * razorpay_payment_link_reference_id
   * =
   * SUB_1787557520892_60
   */

  if (razorpay_payment_link_reference_id) {

    const [subscription] =
      await this.dataSource.query(
        `
        SELECT
          id,
          subscription_code,
          status
        FROM user_subscriptions
        WHERE subscription_code = ?
        LIMIT 1
        `,
        [
          razorpay_payment_link_reference_id,
        ],
      );

    if (subscription) {

      subscriptionId =
        subscription.id;

      console.log(
        'Subscription found:',
        subscription,
      );
    }
  }

  return {
    subscription_id:
      subscriptionId,

    payment_id:
      razorpay_payment_id,

    payment_link_id:
      razorpay_payment_link_id,

    status:
      razorpay_payment_link_status ||
      'pending',
  };
}

async processRecurringPayments() {
  const subscriptions =
    await this.dataSource.query(`
      SELECT user_subscriptions.*,p.plan_title 
      FROM user_subscriptions
      LEFT JOIN plans p ON p.id = user_subscriptions.plan_id
      WHERE status = 'active'
        AND auto_renew = 1
        AND next_billing_date IS NOT NULL
        AND next_billing_date <= NOW()
      ORDER BY id ASC
    `);

  let success = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      console.log(
        `Processing recurring subscription: ${subscription.id}`
      );

      await this.processSingleRecurringPayment(
        subscription,
      );

      success++;
    } catch (error) {
      failed++;

      console.error(
        `Recurring payment failed: ${subscription.id}`,
        error,
      );
    }
  }

  return {
    total: subscriptions.length,
    success,
    failed,
  };
}

async processSingleRecurringPayment(
  subscription: any,
) {

  const subscriptionId =
    Number(subscription.id);

  if (
    !Number.isInteger(
      subscriptionId,
    )
  ) {
    throw new BadRequestException(
      'Invalid subscription ID',
    );
  }

  const customerId =
    String(
      subscription.razorpay_customer_id ||
        '',
    ).trim();

  const tokenId =
    String(
      subscription.razorpay_token_id ||
        '',
    ).trim();

  if (!customerId) {
    throw new BadRequestException(
      'Razorpay customer ID missing',
    );
  }

  if (!tokenId) {
    throw new BadRequestException(
      'Razorpay token ID missing',
    );
  }

  const amount =
    Number(
      subscription.total_amount,
    );

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new BadRequestException(
      'Invalid recurring amount',
    );
  }

  const interval = 1;

const currentBillingDate = dayjs(
  subscription.next_billing_date,
);

const nextBillingDate =
  Number(subscription.plan_title) === 2
    ? currentBillingDate
        .add(interval, 'year')
        .format('YYYY-MM-DD HH:mm:ss')
    : currentBillingDate
        .add(interval, 'month')
        .format('YYYY-MM-DD HH:mm:ss');

await this.dataSource.query(
  `
  UPDATE user_subscriptions
  SET
    next_billing_date = ?,
    updated_at = NOW()
  WHERE id = ?
  `,
  [
    nextBillingDate,
    subscriptionId,
  ],
);

  const amountInPaise =
    Math.round(
      amount * 100,
    );

  const receipt =
    `REC_${subscriptionId}_${Date.now()}`;

  // ============================================================
  // CREATE PAYMENT ATTEMPT
  // ============================================================

  const paymentInsert =
    await this.dataSource.query(
      `
      INSERT INTO user_subscription_payments
      (
        subscription_id,
        user_id,

        amount,
        total_amount,

        payment_status,
        payment_method,

        created_at
      )
      VALUES
      (
        ?,
        ?,

        ?,
        ?,

        'processing',
        'razorpay_token',

        NOW()
      )
      `,
      [
        subscriptionId,
        subscription.user_id,

        amount,
        amount,
      ],
    );

  const paymentAttemptId =
    Number(
      paymentInsert?.insertId,
    );

  /*
   * IMPORTANT:
   *
   * This is where you call the Razorpay
   * token-based recurring debit API enabled
   * for your Razorpay account.
   *
   * Do NOT use:
   *
   * razorpay.orders.create()
   *
   * here as a substitute for the recurring
   * debit.
   */

  console.log(
    'Recurring payment should be initiated:',
    {
      subscriptionId,
      customerId,
      tokenId,
      amountInPaise,
      currency: 'INR',
      receipt,
      paymentAttemptId,
    },
  );

  /*
   * After Razorpay accepts the recurring
   * payment request, save its payment/order
   * reference in user_subscription_payments.
   */
}

  
}




function getDatesBetween(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const result: string[] = [];

  while (start <= end) {
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const dd = String(start.getDate()).padStart(2, '0');

    result.push(`${yyyy}-${mm}-${dd}`);

    start.setDate(start.getDate() + 1);
  }

  return result;
}

function parseDate(dateStr: string): Date {
  if (!dateStr) throw new Error('Invalid date input');

  const parts = dateStr.split('-');

  // if format is DD-MM-YYYY
  if (parts[0].length === 2) {
    const [dd, mm, yyyy] = parts.map(Number);
    return new Date(yyyy, mm - 1, dd);
  }

  // if format is YYYY-MM-DD
  const [yyyy, mm, dd] = parts.map(Number);
  return new Date(yyyy, mm - 1, dd);
}

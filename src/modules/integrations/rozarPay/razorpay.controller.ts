import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { RazorpayService } from './razorpay.service';

@Controller('razorpay')
export class RazorpayController {
  constructor(
    private readonly razorpayService: RazorpayService,
  ) {}

  /**
   * Create Order (One Time Payment)
   */
  // @UseGuards(JwtAuthGuard)
  // @Post('create-order')
  // async createOrder(
  //   @Body() body: any,
  //   @CurrentUser() user: any,
  //   @Headers('x-country') country: number,
  // ) {
  //   return this.razorpayService.createOrder(
  //     body,
  //     user.id,
  //     country,
  //   );
  // }

  /**
   * Verify Payment Signature
   */
  @UseGuards(JwtAuthGuard)
  @Post('verify-payment')
  async verifyPayment(
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.razorpayService.verifyPayment(
      body,
      user.id,
    );
  }

  /**
   * Create Subscription
   */
  // @UseGuards(JwtAuthGuard)
  // @Post('subscription')
  // async createSubscription(
  //   @Body() body: any,
  //   @CurrentUser() user: any,
  //   @Headers('x-country') country: number,
  // ) {
  //   return this.razorpayService.createSubscription(
  //     body,
  //     user.id,
  //     country,
  //   );
  // }

  /**
   * Verify Subscription
   */
  @Get('subscription/:subscription_id')
  async verifySubscription(
    @Param('subscription_id')
    subscriptionId: string,
  ) {
    return this.razorpayService.verifySubscription(
      subscriptionId,
    );
  }

  /**
   * Cancel Subscription
   */
  // @UseGuards(JwtAuthGuard)
  // @Post('subscription/cancel')
  // async cancelSubscription(
  //   @Body() body: any,
  // ) {
  //   return this.razorpayService.cancelSubscription(
  //     body.subscription_id,
  //   );
  // }

  /**
   * Payment Details
   */
  // @Get('payment/:payment_id')
  // async paymentDetails(
  //   @Param('payment_id')
  //   paymentId: string,
  // ) {
  //   return this.razorpayService.paymentDetails(
  //     paymentId,
  //   );
  // }

  /**
   * Razorpay Webhook
   */
  // @Post('webhook')
  // async webhook(
  //   @Req() req,
  //   @Headers('x-razorpay-signature')
  //   signature: string,
  // ) {
  //   return this.razorpayService.webhook(
  //     req.body,
  //     signature,
  //   );
  // }
}
import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { CashfreeService } from './cashfree.service';

@Controller('cashfree')
export class CashfreeController {
  constructor(private readonly cashfreeService: CashfreeService) {}

  
 @Post('subscription')
subscription(@Body() body: any) {
  return this.cashfreeService.subscription(body);
}

@Get("verify_subscription/:subscription_id")
async verifySubscription(
  @Param("subscription_id") subscriptionId: string
) {
  
  return this.cashfreeService.verifySubscription(subscriptionId);
}
@Get("cashfree_plans/:category")
async cashfree_plans(
  @Param("category") category_id: string
) {
  
  return this.cashfreeService.cashfree_plans(category_id);
}

}

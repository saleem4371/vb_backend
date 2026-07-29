import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Patch,
  Query,
  Put,
  Req,
  BadRequestException,
  UseGuards,
  Headers,
} from '@nestjs/common';

import { RewardService } from './rewards.service';

import { CurrentUser } from '../../common/decorators/user.decorator';

import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';

@Controller('reward')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}
  @UseGuards(JwtAuthGuard)
  @Get('total_reward_in_your_account')
  async total_reward_in_your_account(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Headers('x-category') category: any,
  ) {
    return this.rewardService.total_reward_in_your_account(user?.id ,category );
  }

}
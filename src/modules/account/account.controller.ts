import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  Body,
  Headers,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import type { FastifyRequest } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @UseGuards(JwtAuthGuard)
  @Get('loadProfileApi')
  loadProfileApi(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.accountService.loadProfileApi(userId);
  } 
   @UseGuards(JwtAuthGuard)
  @Get('rewardsApi')
  rewardsApi(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.accountService.rewardsApi(userId);
  } 
  
  // @UseGuards(JwtAuthGuard)
  // @Post('updateProfile')
  // updateProfile(@CurrentUser() user: any, @Body() body:any) {
  //   const userId = user?.id;
  //   return this.accountService.updateProfile(userId,body);
  // } 

// @UseGuards(JwtAuthGuard)
// @Post('updateProfile')
// async updateProfile(
//   @CurrentUser() user: any,
//   @Req() req: FastifyRequest,
// ) {
//   const parts = req.parts();

//   const body: any = {};
//   let avatar: any = null;

//   for await (const part of parts) {
//     if (part.type === 'file') {
//       avatar = part;
//     } else {
//       body[part.fieldname] = part.value;
//     }
//   }

//   return this.accountService.updateProfile(user.id, body, avatar);
// }
@Post('updateProfile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: any,
    @Req() req: FastifyRequest,
    @Body() body: any,
  ) {
    // JSON Request
    if (!req.isMultipart()) {
      return this.accountService.updateProfile(
        user.id,
        body,
      );
    }

    // Multipart Request
    const parts = req.parts();

    const data: any = {};
    let avatar: MultipartFile | null = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname === 'avatar') {
          avatar = part;
        }
      } else {
        data[part.fieldname] = part.value;
      }
    }

    return this.accountService.updateProfile(
      user.id,
      data,
      avatar,
    );
  }
}

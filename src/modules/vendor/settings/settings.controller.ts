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

import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('get')
  settings(@CurrentUser() user: any, @Param('id') id: string) {
    return this.settingsService.settings(user?.id, id);
  }
 @UseGuards(JwtAuthGuard)
  @Post('saveSettingsAPI')
  saveSettingsAPI(@Body() body:any ,@CurrentUser() user: any) {
    return this.settingsService.saveSettingsAPI(user?.id, body);
  } 
  
  @UseGuards(JwtAuthGuard)
  @Post('loadSettingsAPI')
  loadSettingsAPI(@Body() body:any ,@CurrentUser() user: any) {
    return this.settingsService.loadSettingsAPI(user?.id, body);
  }

  
}

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
} from '@nestjs/common';

import { GlobalService } from './global.service';

@Controller('global')
export class GlobalController {
  constructor(private readonly globalService: GlobalService) {}
  @Get('events')
  findEvent() {
    return this.globalService.findEvent();
  }

  @Get('property')
  findProperty(@Query() query: any) {
    return this.globalService.findProperty(query);
  }
}

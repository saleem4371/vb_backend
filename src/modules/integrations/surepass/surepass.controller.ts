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

import { SurepassService } from './surepass.service';

@Controller('thirdParty')
export class SurepassController {
  constructor(private readonly surepassService: SurepassService) {}

  
 @Get('pan_verify')
pan_verify(@Query('pan') pan: string) {
  return this.surepassService.verifyPan(pan);
}

}

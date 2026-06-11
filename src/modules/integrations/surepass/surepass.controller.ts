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

  
 @Post('verifyPAN')
pan_verify(@Body() body: string) {
  return this.surepassService.verifyPan(body);
}
 @Post('verifyBank')
verifyBank(@Body() body: string) {
  return this.surepassService.verifyBank(body);
} 

@Post('verifyAdhar')
verifyAdhar(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
@Post('digilocker/callback')
callback(@Body() body: string) {
  return this.surepassService.callback(body);
}

}

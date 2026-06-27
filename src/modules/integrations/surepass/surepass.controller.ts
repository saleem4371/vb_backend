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

import { SurepassService } from './surepass.service';

@Controller('thirdParty')
export class SurepassController {
  constructor(private readonly surepassService: SurepassService) {}

    @UseGuards(JwtAuthGuard)
 @Post('verifyPAN')
pan_verify(@Body() body: string,@CurrentUser() user: any) {
  return this.surepassService.verifyPan(body, user?.id );
}
 @UseGuards(JwtAuthGuard)
 @Post('verifyGST')
verifyGST(@Body() body: string,@CurrentUser() user: any) {
  return this.surepassService.verifyGST(body,user?.id);
}  
@UseGuards(JwtAuthGuard)
 @Post('verifyBank')
verifyBank(@Body() body: string,@CurrentUser() user: any) {
  return this.surepassService.verifyBank(body,user?.id);
} 

@Post('verifyAdhar')
verifyAdhar(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
@Get('digilocker/callback')
callback(@Body() body: string) {
  return this.surepassService.callback(body);
}
@Get('initializeDigilocker')
initializeDigilocker(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
 @UseGuards(JwtAuthGuard)
@Post('UploadDocument')
async UploadDocument(
  @Req() req: FastifyRequest,
  @CurrentUser() user: any,
) {
  try {
    const parts = req.parts();

    const body: any = {};
    let document: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILE
      |--------------------------------------------------------------------------
      */
      if (part.type === 'file') {
        if (!part.filename) {
          continue;
        }

        const buffer = await part.toBuffer();

        if (!buffer || buffer.length === 0) {
          continue;
        }

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (part.fieldname === 'file') {
          document = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */
      if (part.type === 'field') {
        body[part.fieldname] = String(part.value);
      }
    }

    return await this.surepassService.UploadDocument(
      document,
      body,
      user?.id,
    );
  } catch (error) {
    console.error(error);

  }
}
}

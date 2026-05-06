import { Body, Controller, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './admin_auth.service';

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Req() req: FastifyRequest,
    @Body() dto: any
  ) {
    console.log(req.ip); // example usage

    return await this.authService.login(dto); 
  }
}
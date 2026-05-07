import { Body, Controller, Post, Req ,UseGuards, Get} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './admin_auth.service';
import { JwtAuthGuard } from './strategies/jwt-auth.guard';

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


   @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@Req() req) {
      return this.authService.findById(req.user.id);
      // return req.user; // 🔥 comes from JwtStrategy
    }
}
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../mail/mail.module';

import { CommonModule } from '../../common/common.module';

@Module({
  providers: [AuthService],
  exports: [AuthService],
  controllers: [AuthController],
   imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '7d' },
    }),
    MailModule,
    CommonModule
  ],
})
export class AuthModule {}

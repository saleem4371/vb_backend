import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { NotificationModule } from '../../notifications/notification.module'

@Module({
   imports: [
      NotificationModule,
    
      ],
  providers: [AccountService],
  exports: [AccountService],
  controllers: [AccountController],
})
export class AccountModule {}


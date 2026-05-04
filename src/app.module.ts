import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { HomeModule } from './modules/home/home.module';
import { CategoryModule } from './modules/category/category.module';
import { VenueModule } from './modules/venue/venue.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { BecomeAHostPartnerModule } from './modules/become_a_host_partner/become_a_host_partner.module';
import { PropertyModule } from './modules/property/property.module';

import { CommonModule } from './common/common.module';
import { LogsModule } from './logs/logs.module';
import { NotificationModule } from './notifications/notification.module';

@Module({
  imports: [
    // 🔥 FIRST LOAD CONFIG
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // DB
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: '56.228.5.223',
      port: 3306,
      username: 'vb_user',
      password: 'Syfte_2020',
      database: 'vb_platform',
      autoLoadEntities: true,
      synchronize: false,
      logging: true,
      connectTimeout: 10000,
    }),

    // MODULES
    HomeModule,
    CategoryModule,
    VenueModule,
    AuthModule,
    BookingModule,
    BecomeAHostPartnerModule,
    PropertyModule,

     CommonModule,
    LogsModule,
    NotificationModule
  ],
})
export class AppModule {}
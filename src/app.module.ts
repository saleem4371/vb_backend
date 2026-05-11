import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from "@nestjs/core";

import { ActivityLogInterceptor } from "./modules/admin/activity-logs/interceptors/activity-log.interceptor";

/* MODULES */
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
import { StorageModule } from "./common/storage/storage.module";

import { AuthAdminModule } from './modules/admin/admin_auth/admin_auth.module';
import { VendorModule } from './modules/admin/vendor/vendor.module';
import { ActivityLogsModule } from './modules/admin/activity-logs/activity-logs.module';
import { CurrencyModule } from './modules/admin/currency/currency.module';
import { CountryModule } from './modules/admin/country/country.module';
import { EventTagsModule } from "./modules/admin/event-tag/event-tag.module";
import { VenueTagsModule } from "./modules/admin/venue-tags/venue-tag.module"

// import { VenueTagsModule } from "./modules/admin/property-tag/property-tag.module";
// import { CategoryPropertyModule } from './modules/admin/property_category/category.module';
import { VenueCategoryModule } from './modules/admin/venue-category/venue-category.module';
import { UnregisteredModule } from './modules/admin/scraped-data/scraped-data.module';
import { GlobalModule } from './modules/global/global.module';

@Module({
  imports: [

    /* CONFIG */
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    /* DATABASE */
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

    /* USER MODULES */
    HomeModule,
    CategoryModule,
    VenueModule,
    AuthModule,
    BookingModule,
    BecomeAHostPartnerModule,
    PropertyModule,

    CommonModule,
    LogsModule,
    NotificationModule,
    StorageModule,

    /* ADMIN MODULES */
    AuthAdminModule,
    ActivityLogsModule,
    VendorModule,
    CurrencyModule,
    CountryModule,
    EventTagsModule,
    VenueTagsModule,
    VenueCategoryModule,
    UnregisteredModule,
    GlobalModule,
    // CategoryPropertyModule
    // VenueTagsModule,
  ],

  /* ✅ FIX IS HERE */
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],

})
export class AppModule {}
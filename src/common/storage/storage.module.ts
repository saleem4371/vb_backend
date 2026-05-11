import {
  Global,
  Module,
} from "@nestjs/common";

import { ConfigModule } from "@nestjs/config";

import { StorageService } from "./storage.service";

import { LocalStorageService } from "./local.storage";

import { S3StorageService } from "./s3.storage";

@Global()
@Module({
  imports: [ConfigModule],

  providers: [
    LocalStorageService,

    S3StorageService,

    {
      provide: StorageService,

      useFactory: (
        localStorage: LocalStorageService,

        s3Storage: S3StorageService,
      ) => {
        const driver =
          process.env
            .STORAGE_DRIVER ||
          "local";

        if (driver === "s3") {
          return s3Storage;
        }

        return localStorage;
      },

      inject: [
        LocalStorageService,
        S3StorageService,
      ],
    },
  ],

  exports: [StorageService],
})
export class StorageModule {}
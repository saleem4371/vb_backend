import { Module } from '@nestjs/common';
import { SurepassService } from './surepass.service';
import { SurepassController } from './surepass.controller';
import { IntegSettingsModule } from '../integSettings/integSettings.module';

@Module({
  imports: [IntegSettingsModule],
  controllers: [SurepassController], // <-- ADD THIS
  providers: [SurepassService],
  exports: [SurepassService],
})
export class SurepassModule {}
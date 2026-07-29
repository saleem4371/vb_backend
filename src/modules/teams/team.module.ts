import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TeamController } from './team.controller';
import { TeamService } from './team.service';

import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { SystemRole } from './entities/system-role.entity';
import { SystemRolePermission } from './entities/system-role-permission.entity';
import { SystemUserVenue } from './entities/system-user-venue.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { LoginHistory } from './entities/login-history.entity';
import { Venue } from './entities/venue.entity';
import { Permission } from './entities/permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRole,
      SystemRole,
      SystemRolePermission,
      SystemUserVenue,
      ActivityLog,
      LoginHistory,
      Venue,
      Permission,
    ]),
  ],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}

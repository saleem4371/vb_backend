import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { QueryMembersDto } from './dto/query-members.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import {
  UpdateMemberPermissionsDto,
  UpdateMaskingRulesDto,
  CreateRolePresetDto,
  UpdateRolePresetInfoDto,
  UpdateRolePresetPermissionsDto,
} from './dto/permissions.dto';

import { CurrentUser } from '../../common/decorators/user.decorator';

import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard';

// import { AuthGuard } from '../auth/auth.guard'; // wire up your existing auth here
// import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';

@Controller('team')
// @UseGuards(AuthGuard) // uncomment once your auth module is in place
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ── Members list (grid/table + tabs + search + filters) ──
   @UseGuards(JwtAuthGuard)
  @Get('members')
  findMembers(@Query() query: QueryMembersDto,@CurrentUser() user: any) {
    return this.teamService.findMembers(query,user?.id);
  }

  // ── Stat cards + tab counts, computed server-side in one pass ──
  @Get('members/stats')
  getStats() {
    return this.teamService.getStats();
  }

  // ── Single member (MemberDrawer: overview/permissions/activity/venues/masked tabs) ──
   @UseGuards(JwtAuthGuard)
  @Get('members/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: any,) {
    return this.teamService.findMemberById(id,user?.id);
  }

  // ── Add Member wizard (5-step) ──
  @Post('members')
  create(@Body() dto: CreateMemberDto) {
    return this.teamService.createMember(dto);
  }

  // ── Edit Member overlay (details / role / venues / access sections) ──
  @Patch('members/:id')
  update(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.teamService.updateMember(id, dto);
  }

  // ── Suspend / Reactivate (row menu, drawer button) ──
  @Patch('members/:id/suspend')
  toggleSuspend(@Param('id') id: string) {
    return this.teamService.toggleSuspend(id);
  }

  // ── Per-member permission overrides (PermissionsOverlay) ──
  @Get('members/:id/permissions')
  getMemberPermissions(@Param('id') id: string) {
    return this.teamService.getMemberPermissions(id);
  }

  @Patch('members/:id/permissions')
  updateMemberPermissions(@Param('id') id: string, @Body() dto: UpdateMemberPermissionsDto) {
    return this.teamService.updateMemberPermissions(id, dto);
  }

  // ── Venues for the venue-access pickers (Add/Edit member, per-member venues tab) ──
  @Get('venues')
  listVenues() {
    return this.teamService.listVenues();
  }

  // ── Role presets (RolePresetOverlay) ──
  @Get('role-presets')
  listRolePresets() {
    return this.teamService.listRolePresets();
  }

  @Get('role-presets/:rid/permissions')
  getRolePresetPermissions(@Param('rid') rid: string) {
    return this.teamService.getRolePresetPermissions(rid);
  }

  @Post('role-presets')
  createRolePreset(@Body() dto: CreateRolePresetDto) {
    return this.teamService.createRolePreset(dto);
  }

  @Patch('role-presets/:rid')
  updateRolePresetInfo(@Param('rid') rid: string, @Body() dto: UpdateRolePresetInfoDto) {
    return this.teamService.updateRolePresetInfo(rid, dto);
  }

  @Patch('role-presets/:rid/permissions')
  updateRolePresetPermissions(@Param('rid') rid: string, @Body() dto: UpdateRolePresetPermissionsDto) {
    return this.teamService.updateRolePresetPermissions(rid, dto);
  }

  @Post('role-presets/:rid/duplicate')
  duplicateRolePreset(@Param('rid') rid: string) {
    return this.teamService.duplicateRolePreset(rid);
  }

  @Delete('role-presets/:rid')
  @HttpCode(HttpStatus.OK)
  deleteRolePreset(@Param('rid') rid: string) {
    return this.teamService.deleteRolePreset(rid);
  }

  // ── Masking control panel (MaskedDataOverlay) ──
  @Get('masking')
  getMaskingRules() {
    return this.teamService.getMaskingRules();
  }

  @Patch('masking')
  updateMaskingRules(@Body() dto: UpdateMaskingRulesDto) {
    return this.teamService.updateMaskingRules(dto);
  }
}

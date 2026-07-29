import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ROLE_IDS } from '../constants/team.constants';
import type { ActionKey, ModuleKey } from '../constants/team.constants';

/** Body for PATCH /team/members/:id/permissions — saved from PermissionsOverlay. */
export class UpdateMemberPermissionsDto {
  @IsObject()
  permissions?: Record<ModuleKey, ActionKey[]>;
}

/** Body for PATCH /team/masking — saved from MaskedDataOverlay ("By Role" tab). */
class RoleMaskingRuleDto {
  @IsBoolean()
  enabled?: boolean;

  @IsArray()
  @IsString({ each: true })
  fields?: string[];
}

/** Body for PATCH /team/masking — saved from MaskedDataOverlay ("By User" tab). */
class UserMaskingRuleDto {
  @IsBoolean()
  enabled?: boolean;

  @IsArray()
  @IsString({ each: true })
  fields?: string[];
}

export class UpdateMaskingRulesDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RoleMaskingRuleDto)
  roleRules?: Record<string, RoleMaskingRuleDto>;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserMaskingRuleDto)
  userRules?: Record<string, UserMaskingRuleDto>;
}

/** Body for POST /team/role-presets — "New Preset" in RolePresetOverlay. */
export class CreateRolePresetDto {
  @IsNotEmpty()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(ROLE_IDS as unknown as string[])
  base?: string;
}

/** Body for PATCH /team/role-presets/:id — name/description edit. */
export class UpdateRolePresetInfoDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/** Body for PATCH /team/role-presets/:id/permissions — the accordion save. */
export class UpdateRolePresetPermissionsDto {
  @IsObject()
  permissions?: Record<ModuleKey, ActionKey[]>;
}
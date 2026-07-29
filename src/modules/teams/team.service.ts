import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets, DataSource } from 'typeorm';

import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { SystemRole } from './entities/system-role.entity';
import { SystemRolePermission } from './entities/system-role-permission.entity';
import { SystemUserVenue } from './entities/system-user-venue.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { LoginHistory } from './entities/login-history.entity';
import { Venue } from './entities/venue.entity';
import { Permission } from './entities/permission.entity';

import { QueryMembersDto } from './dto/query-members.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateMemberPermissionsDto, UpdateMaskingRulesDto, CreateRolePresetDto, UpdateRolePresetInfoDto, UpdateRolePresetPermissionsDto } from './dto/permissions.dto';

import { toTeamMemberDto, TeamMemberDto } from './mappers/team-member.mapper';
import { PERMISSION_MODULES, ROLE_DEFAULT_PERMISSIONS, RoleId, ActionKey, ModuleKey } from './constants/team.constants';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole) private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(SystemRole) private readonly systemRoleRepo: Repository<SystemRole>,
    @InjectRepository(SystemRolePermission) private readonly rolePermRepo: Repository<SystemRolePermission>,
    @InjectRepository(SystemUserVenue) private readonly userVenueRepo: Repository<SystemUserVenue>,
    @InjectRepository(ActivityLog) private readonly activityLogRepo: Repository<ActivityLog>,
    @InjectRepository(LoginHistory) private readonly loginHistoryRepo: Repository<LoginHistory>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Permission) private readonly permissionRepo: Repository<Permission>,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // MEMBERS LIST  (drives the grid/table + stat cards + tab counts)
  // ─────────────────────────────────────────────────────────────
  /**
   * `userId` is the acting/requesting user — used to scope the member list to
   * whichever team(s) they belong to, via `user_team_members`.
   *
   * SCHEMA NOTE: this service was originally written against
   * system_roles/user_roles/system_user_venues tables that don't actually
   * exist in your DB. The real schema (confirmed from your query logs) is:
   *   - users              (id, name, email, phone, status, role_type, ...)
   *   - user_team_members  (id, team_id, user_id, role_id, joined_at)
   *   - user_teams         (id, name, owner_id, type, created_at)
   * findMembers below has been rewritten against the real schema. The rest
   * of this file (permissions/masking/venues/role-presets) still assumes
   * the old tables — tell me if you want those rewritten too, and what the
   * roles/permissions/venues tables actually look like in your DB.
   */
 async findMembers(query: QueryMembersDto, userId: number) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 20);
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const params: any[] = [];

  // Only users in my teams
  where.push(`
    utm.team_id IN (
      SELECT team_id
      FROM user_team_members
      WHERE user_id = ?
    )
  `);

  params.push(userId);

  // Search
  if (query.search) {
    where.push(`
      (
        u.name LIKE ?
        OR u.email LIKE ?
        OR u.phone LIKE ?
      )
    `);

    const search = `%${query.search}%`;
    params.push(search, search, search);
  }

  // Role Filter
  if (query.role) {
    where.push(`sr.rid = ?`);
    params.push(query.role);
  }

  // Status Filter
  if (query.status) {
    where.push(`u.status = ?`);
    params.push(query.status);
  }

  // Masked
  if (query.maskedOnly === "true") {
    where.push(`ur.mask_data = 1`);
  }

  // Tabs
  switch (query.tab) {
    case "admins":
      where.push(`sr.rid IN ('owner','admin')`);
      break;

    case "managers":
      where.push(`sr.rid IN ('manager','operations','sales','finance')`);
      break;

    case "staff":
      where.push(`sr.rid IN ('staff','viewer')`);
      break;

    case "suspended":
      where.push(`u.status='suspended'`);
      break;

    case "pending":
      where.push(`u.status='pending'`);
      break;
  }

  const whereSql = where.length
    ? `WHERE ${where.join(" AND ")}`
    : "";

  const sql = `
      SELECT

          u.id,
          u.name,
          u.email,
          u.phone,
          u.status,
          u.is_online,
          u.last_login,
          u.last_seen,
          u.invite_status,
          u.created_at,

          ur.mask_data,

          ut.id              AS team_id,
          ut.name            AS team_name,

          utm.id             AS team_member_id,
          utm.joined_at,

          sr.id              AS role_id,
          sr.rid,
          sr.name            AS role_name

      FROM users u

      INNER JOIN user_team_members utm
          ON utm.user_id = u.id

      INNER JOIN user_teams ut
          ON ut.id = utm.team_id

      LEFT JOIN system_roles sr
          ON sr.id = utm.role_id

      LEFT JOIN user_roles ur
          ON ur.user_id = u.id

      ${whereSql}

      GROUP BY
          u.id,
          ut.id,
          utm.id,
          sr.id,
          ur.mask_data

      ORDER BY u.created_at DESC

      LIMIT ?,?;
    `;

  const totalSql = `
      SELECT
          COUNT(DISTINCT u.id) total

      FROM users u

      INNER JOIN user_team_members utm
          ON utm.user_id = u.id

      INNER JOIN user_teams ut
          ON ut.id = utm.team_id

      LEFT JOIN system_roles sr
          ON sr.id = utm.role_id

      LEFT JOIN user_roles ur
          ON ur.user_id = u.id

      ${whereSql}
    `;

  const rows = await this.dataSource.query(sql, [
    ...params,
    offset,
    pageSize,
  ]);

  const [{ total }] = await this.dataSource.query(
    totalSql,
    params,
  );

  const members = rows.map((row: any) =>
    this.buildMemberDtoFromRaw(row),
  );

  return {
    data: members,
    page,
    pageSize,
    total: Number(total),
  };
}

  /** Stat cards + tab badge counts — computed in one pass to avoid N queries from the client. */
  async getStats() {
    const users = await this.userRepo.find({ relations: ['userRole', 'userRole.role'] });

    const isRecentlyOnline = (u: User) => u.isOnline || (u.lastSeen && Date.now() - new Date(u.lastSeen).getTime() < 15 * 60 * 1000);
    return {
      total: users.length,

      admins: users.filter((u) =>
        ['owner', 'admin'].includes(u.userRole?.role?.rid ?? '')
      ).length,

      managers: users.filter((u) =>
        ['manager', 'operations', 'sales', 'finance'].includes(
          u.userRole?.role?.rid ?? ''
        )
      ).length,

      staff: users.filter((u) =>
        ['staff', 'viewer'].includes(u.userRole?.role?.rid ?? '')
      ).length,

      activeToday: users.filter(isRecentlyOnline).length,

      restricted: users.filter((u) => !!u.userRole?.maskData).length,

      pending: users.filter((u) => u.status === 'pending').length,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // MEMBER DETAIL  (drives the MemberDrawer — all 5 tabs in one call)
  // ─────────────────────────────────────────────────────────────
  async findMemberById(id: string, user_id: any): Promise<TeamMemberDto> {
    const user = await this.userRepo.findOne({
      where: { id: Number(id) },
      relations: ['userRole', 'userRole.role'],
    });
    if (!user) throw new NotFoundException(`Member ${id} not found`);
    return this.buildMemberDto(user);
  }

  private async buildMemberDto(user: User): Promise<TeamMemberDto> {
    if (!user.id) {
      throw new Error("User id is required");
    }

    const [userRole, venues, recentActions, loginHistory] =
      await Promise.all([
        user.userRole ??
          this.userRoleRepo.findOne({
            where: { userId: user.id },
            relations: ["role"],
          }),

        this.userVenueRepo.find({
          where: { userId: user.id },
          relations: ["venue"],
        }),

        this.activityLogRepo.find({
          where: { userId: user.id },
          order: { createdAt: "DESC" },
          take: 10,
        }),

        this.loginHistoryRepo.find({
          where: { userId: user.id },
          order: { loginTime: "DESC" },
          take: 10,
        }),
      ]);

    const maskedFields =
      userRole?.maskData
        ? await this.resolveMaskedFields(user.id)
        : [];

    return toTeamMemberDto({
      user,
      userRole: userRole
        ? {
            ...userRole,
            role: userRole.role ? { rid: userRole.role.rid ?? '' } : undefined,
          }
        : undefined,
      venues: venues.map((v) => ({
        ...v,
        venue: v.venue ? { name: v.venue.name ?? '' } : undefined,
      })),
      recentActions,
      loginHistory,
      maskedFields,
    });
  }
  /**
   * ASSUMPTION: which specific fields are masked for a user is resolved from
   * a masking-rules store (role-level default + per-user override). Wire this
   * up to wherever those rules persist — a `masking_rules` table, or reuse
   * system_role_permissions with a synthetic "mask:<field>" permission.
   */
  private async resolveMaskedFields(_userId: number): Promise<string[]> {
    return []; // TODO: replace with real lookup
  }

  // ─────────────────────────────────────────────────────────────
  // CREATE / UPDATE / SUSPEND
  // ─────────────────────────────────────────────────────────────
  async createMember(dto: CreateMemberDto): Promise<TeamMemberDto> {
  const runner = this.dataSource.createQueryRunner();

  await runner.connect();
  await runner.startTransaction();

  try {
    // -------------------------------------------------------
    // Find Role
    // -------------------------------------------------------
    const roles = await runner.query(
      `
      SELECT id,rid,name
      FROM system_roles
      WHERE rid=? OR name=?
      LIMIT 1
      `,
      [dto.role, dto.role],
    );

    if (!roles.length) {
      throw new BadRequestException(`Unknown role "${dto.role}"`);
    }

    const role = roles[0];

    // -------------------------------------------------------
    // Email Exists
    // -------------------------------------------------------
    if (dto.email) {
      const exists = await runner.query(
        `
        SELECT id
        FROM users
        WHERE email=?
        LIMIT 1
        `,
        [dto.email],
      );

      if (exists.length) {
        throw new BadRequestException(
          "A member with this email already exists",
        );
      }
    }

    // -------------------------------------------------------
    // Create User
    // -------------------------------------------------------
    const userResult = await runner.query(
      `
      INSERT INTO users
      (
        name,
        email,
        phone,
        status,
        invite_status,
        password,
        created_at,
        updated_at
      )
      VALUES
      (
        ?,?,?,?,
        ?,?,
        NOW(),
        NOW()
      )
      `,
      [
        dto.name,
        dto.email,
        dto.phone,
        "pending",
        "invited",
        "",
      ],
    );

    const userId = userResult.insertId;

    // -------------------------------------------------------
    // User Role
    // -------------------------------------------------------
    await runner.query(
      `
      INSERT INTO user_roles
      (
        user_id,
        role_id,
        auto_role,
        mask_data,
        created_at,
        updated_at
      )
      VALUES
      (
        ?,?,
        0,
        0,
        NOW(),
        NOW()
      )
      `,
      [
        userId,
        role.id,
      ],
    );

    // -------------------------------------------------------
    // Find Existing Team
    // -------------------------------------------------------
    let teamId: number;

    const teams = await runner.query(
      `
      SELECT id
      FROM user_teams
      WHERE owner_id=?
      LIMIT 1
      `,
      [userId],
    );

    if (teams.length) {
      teamId = teams[0].id;
    } else {
      const teamResult = await runner.query(
        `
        INSERT INTO user_teams
        (
            name,
            owner_id,
            type,
            created_at
        )
        VALUES
        (
            ?,?,
            ?,
            NOW()
        )
        `,
        [
          `${dto.name} Team`,
          userId,
          "vendor",
        ],
      );

      teamId = teamResult.insertId;
    }

    // -------------------------------------------------------
    // Team Member
    // -------------------------------------------------------
    await runner.query(
      `
      INSERT INTO user_team_members
      (
        team_id,
        user_id,
        role_id,
        joined_at
      )
      VALUES
      (
        ?,?,
        ?,
        NOW()
      )
      `,
      [
        teamId,
        userId,
        role.id,
      ],
    );

    // -------------------------------------------------------
    // Venue Access
    // -------------------------------------------------------
    if (
      dto.venueAccess === "selected" &&
      dto.venueIds?.length
    ) {
      for (const venueId of dto.venueIds) {
        await runner.query(
          `
          INSERT INTO system_user_venues
          (
            user_id,
            venue_id
          )
          VALUES
          (
            ?,?
          )
          `,
          [
            userId,
            Number(venueId),
          ],
        );
      }
    }

    if (dto.venueAccess === "all") {
      const venues = await runner.query(
        `
        SELECT child_venue_id
        FROM venue_child
        `,
      );

      for (const venue of venues) {
        await runner.query(
          `
          INSERT INTO system_user_venues
          (
            user_id,
            venue_id
          )
          VALUES
          (
            ?,?
          )
          `,
          [
            userId,
            venue.child_venue_id,
          ],
        );
      }
    }

    await runner.commitTransaction();

    const rows = await this.dataSource.query(
      `
      SELECT
          u.id,
          u.name,
          u.email,
          u.phone,
          u.status,
          u.is_online,
          u.last_login,
          u.last_seen,
          u.invite_status,
          u.created_at,
          ur.mask_data,
          sr.rid
      FROM users u
      LEFT JOIN user_roles ur
          ON ur.user_id=u.id
      LEFT JOIN system_roles sr
          ON sr.id=ur.role_id
      WHERE u.id=?
      `,
      [userId],
    );

    return this.buildMemberDtoFromRaw(rows[0]);

  } catch (error) {

    await runner.rollbackTransaction();
    throw error;

  } finally {

    await runner.release();

  }
}

  async updateMember(
  id: string,
  dto: UpdateMemberDto,
): Promise<TeamMemberDto> {
  const runner = this.dataSource.createQueryRunner();

  await runner.connect();
  await runner.startTransaction();

  try {
    // -----------------------------------------
    // Check User
    // -----------------------------------------
    const users = await runner.query(
      `
      SELECT id
      FROM users
      WHERE id=?
      LIMIT 1
      `,
      [id],
    );

    if (!users.length) {
      throw new NotFoundException(`Member ${id} not found`);
    }

    // -----------------------------------------
    // Update User
    // -----------------------------------------
    await runner.query(
      `
      UPDATE users
      SET
          name = COALESCE(?, name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          status = COALESCE(?, status),
          updated_at = NOW()
      WHERE id=?
      `,
      [
        dto.name ?? null,
        dto.email ?? null,
        dto.phone ?? null,
        dto.status ?? null,
        id,
      ],
    );

    // -----------------------------------------
    // Update Role
    // -----------------------------------------
    if (dto.role) {
      const roles = await runner.query(
        `
        SELECT id
        FROM system_roles
        WHERE rid=? OR name=?
        LIMIT 1
        `,
        [dto.role, dto.role],
      );

      if (!roles.length) {
        throw new BadRequestException(
          `Unknown role "${dto.role}"`,
        );
      }

      await runner.query(
        `
        UPDATE user_roles
        SET
            role_id=?,
            updated_at=NOW()
        WHERE user_id=?
        `,
        [
          roles[0].id,
          id,
        ],
      );

      // update team member role also
      await runner.query(
        `
        UPDATE user_team_members
        SET role_id=?
        WHERE user_id=?
        `,
        [
          roles[0].id,
          id,
        ],
      );
    }

    // -----------------------------------------
    // Update Mask Data
    // -----------------------------------------
    if (dto.masked !== undefined) {
      await runner.query(
        `
        UPDATE user_roles
        SET
            mask_data=?,
            updated_at=NOW()
        WHERE user_id=?
        `,
        [
          dto.masked ? 1 : 0,
          id,
        ],
      );
    }

    // -----------------------------------------
    // Update Venues
    // -----------------------------------------
    // if (dto.venueIds) {
    //   await runner.query(
    //     `
    //     DELETE
    //     FROM system_user_venues
    //     WHERE user_id=?
    //     `,
    //     [id],
    //   );

    //   if (dto.venueAccess === "selected") {
    //     for (const venueId of dto.venueIds) {
    //       await runner.query(
    //         `
    //         INSERT INTO system_user_venues
    //         (
    //             user_id,
    //             venue_id
    //         )
    //         VALUES
    //         (
    //             ?,?
    //         )
    //         `,
    //         [
    //           id,
    //           Number(venueId),
    //         ],
    //       );
    //     }
    //   }

    //   if (dto.venueAccess === "all") {
    //     const venues = await runner.query(
    //       `
    //       SELECT child_venue_id
    //       FROM venue_child
    //       `,
    //     );

    //     for (const venue of venues) {
    //       await runner.query(
    //         `
    //         INSERT INTO system_user_venues
    //         (
    //             user_id,
    //             venue_id
    //         )
    //         VALUES
    //         (
    //             ?,?
    //         )
    //         `,
    //         [
    //           id,
    //           venue.child_venue_id,
    //         ],
    //       );
    //     }
    //   }
    // }

    await runner.commitTransaction();

    // -----------------------------------------
    // Return Updated Member
    // -----------------------------------------
    const rows = await this.dataSource.query(
      `
      SELECT
          u.id,
          u.name,
          u.email,
          u.phone,
          u.status,
          u.is_online,
          u.last_login,
          u.last_seen,
          u.invite_status,
          u.created_at,
          ur.mask_data,
          sr.rid
      FROM users u
      LEFT JOIN user_roles ur
          ON ur.user_id=u.id
      LEFT JOIN system_roles sr
          ON sr.id=ur.role_id
      WHERE u.id=?
      `,
      [id],
    );

    return this.buildMemberDtoFromRaw(rows[0]);

  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

  async toggleSuspend(id: string): Promise<TeamMemberDto> {
    const user = await this.userRepo.findOne({ where: { id: Number(id) } });
    if (!user) throw new NotFoundException(`Member ${id} not found`);
    user.status = user.status === 'suspended' ? 'active' : 'suspended';
    await this.userRepo.save(user);
    return this.buildMemberDto(user);
  }

  // ─────────────────────────────────────────────────────────────
  // PERMISSIONS  (per-member overrides — PermissionsOverlay)
  // ─────────────────────────────────────────────────────────────
  async getMemberPermissions(id: string): Promise<Record<ModuleKey, ActionKey[]>> {
    const userRole = await this.userRoleRepo.findOne({ where: { userId: Number(id) }, relations: ['role'] });
    if (!userRole) throw new NotFoundException(`Member ${id} has no assigned role`);
    if (!userRole.role) throw new NotFoundException(`Member ${id}'s role could not be resolved`);
    if (userRole.role.id === undefined) throw new Error(`Member ${id}'s role is missing a database id`);
    return this.getRolePermissions(userRole.role.id, userRole.role.rid as RoleId);
  }

  async updateMemberPermissions(id: string, dto: UpdateMemberPermissionsDto) {
    // NOTE: if member-level overrides are meant to diverge from the role's
    // shared permission set, store them on a `user_permissions` table instead
    // of mutating system_role_permissions (which is shared by every member
    // with that role). Left as a TODO since it wasn't in the schema given.
    throw new BadRequestException(
      'Per-member permission overrides require a user_permissions table — not present in the given schema. Wire this up before enabling.',
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ROLE PRESETS  (RolePresetOverlay — reads/writes system_roles + system_role_permissions)
  // ─────────────────────────────────────────────────────────────
  async listRolePresets() {
    const roles = await this.systemRoleRepo.find({ order: { level: 'DESC' } });
    return roles.map((r) => ({
      id: r.rid,
      label: r.name,
      desc: r.description,
      level: r.level,
      builtin: !(r.rid ?? '').startsWith('custom_'),
      custom: (r.rid ?? '').startsWith('custom_'),
    }));
  }

  async getRolePresetPermissions(rid: string): Promise<Record<ModuleKey, ActionKey[]>> {
    const role = await this.systemRoleRepo.findOne({ where: { rid } });
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);
    if (role.id === undefined) throw new Error(`Role "${rid}" is missing a database id`);
    return this.getRolePermissions(role.id, rid as RoleId);
  }

  private async getRolePermissions(roleDbId: number, rid: RoleId): Promise<Record<ModuleKey, ActionKey[]>> {
    const rows = await this.rolePermRepo.find({
      where: { roleId: roleDbId, isAllowed: true },
      relations: ['permission'],
    });

    if (rows.length > 0) {
      const result: Record<string, ActionKey[]> = {};
      for (const mod of PERMISSION_MODULES) result[mod.key] = [];
      for (const row of rows) {
        const mod = row.permission?.module;
        const action = row.permission?.action;
        if (mod && action && result[mod]) result[mod].push(action);
      }
      return result as Record<ModuleKey, ActionKey[]>;
    }

    // Fallback to the hardcoded role defaults if no rows are seeded yet.
    const defaults = ROLE_DEFAULT_PERMISSIONS[rid] ?? {};
    const result: Record<string, ActionKey[]> = {};
    for (const mod of PERMISSION_MODULES) {
      result[mod.key] = (defaults['*'] ?? defaults[mod.key] ?? []).filter((a) => (mod.actions as readonly string[]).includes(a));
    }
    return result as Record<ModuleKey, ActionKey[]>;
  }

  async createRolePreset(dto: CreateRolePresetDto) {
    if (!dto.base) throw new BadRequestException('A base role must be specified to create a preset from');

    const rid = `custom_${Date.now()}`;
    const role = this.systemRoleRepo.create({
      rid,
      name: dto.label,
      description: dto.description,
      level: 0,
      status: 'active',
    });
    const saved = await this.systemRoleRepo.save(role);
    if (saved.id === undefined) throw new Error('Failed to persist new role preset');

    // seed permissions from the chosen base role
    const basePerms = await this.getRolePresetPermissions(dto.base);
    await this.savePresetPermissions(saved.id, basePerms);

    return { id: saved.rid, label: saved.name, desc: saved.description };
  }

  async updateRolePresetInfo(rid: string, dto: UpdateRolePresetInfoDto) {
    const role = await this.systemRoleRepo.findOne({ where: { rid } });
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);
    if (dto.label !== undefined) role.name = dto.label;
    if (dto.description !== undefined) role.description = dto.description;
    await this.systemRoleRepo.save(role);
    return { id: role.rid, label: role.name, desc: role.description };
  }

  async updateRolePresetPermissions(rid: string, dto: UpdateRolePresetPermissionsDto) {
    const role = await this.systemRoleRepo.findOne({ where: { rid } });
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);
    if (role.id === undefined) throw new Error(`Role "${rid}" is missing a database id`);
    if (!dto.permissions) throw new BadRequestException('permissions is required');
    await this.savePresetPermissions(role.id, dto.permissions);
    return { success: true };
  }

  async duplicateRolePreset(rid: string) {
    const role = await this.systemRoleRepo.findOne({ where: { rid } });
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);
    const perms = await this.getRolePresetPermissions(rid);
    const dupRid = `custom_${Date.now()}`;
    const dup = await this.systemRoleRepo.save(
      this.systemRoleRepo.create({ rid: dupRid, name: `${role.name} (Copy)`, description: role.description, level: role.level, status: 'active' }),
    );
    if (dup.id === undefined) throw new Error('Failed to persist duplicated role preset');
    await this.savePresetPermissions(dup.id, perms);
    return { id: dup.rid, label: dup.name, desc: dup.description };
  }

  async deleteRolePreset(rid: string) {
    const role = await this.systemRoleRepo.findOne({ where: { rid } });
    if (!role) throw new NotFoundException(`Role "${rid}" not found`);
    if (!rid.startsWith('custom_')) throw new BadRequestException('Built-in roles cannot be deleted');

    const inUse = await this.userRoleRepo.count({ where: { roleId: role.id } });
    if (inUse > 0) throw new BadRequestException(`${inUse} member(s) still have this role assigned`);

    await this.rolePermRepo.delete({ roleId: role.id });
    await this.systemRoleRepo.delete({ id: role.id });
    return { success: true };
  }

  private async savePresetPermissions(roleDbId: number, perms: Record<ModuleKey, ActionKey[]>) {
    await this.rolePermRepo.delete({ roleId: roleDbId });
    const rows: SystemRolePermission[] = [];
    for (const [moduleKey, actions] of Object.entries(perms)) {
      for (const action of actions) {
        const permission = await this.findOrCreatePermission(moduleKey as ModuleKey, action);
        rows.push(this.rolePermRepo.create({ roleId: roleDbId, permissionId: permission.id, isAllowed: true }));
      }
    }
    if (rows.length) await this.rolePermRepo.save(rows);
  }

  private async findOrCreatePermission(module: ModuleKey, action: ActionKey): Promise<Permission> {
    let permission = await this.permissionRepo.findOne({ where: { module, action } });
    if (!permission) {
      permission = await this.permissionRepo.save(this.permissionRepo.create({ module, action }));
    }
    return permission;
  }

  // ─────────────────────────────────────────────────────────────
  // MASKING CONTROL PANEL  (MaskedDataOverlay)
  // ─────────────────────────────────────────────────────────────
  async getMaskingRules() {
    const roles = await this.systemRoleRepo.find();
    const users = await this.userRoleRepo.find({ relations: ['user'] });

    return {
      roleRules: Object.fromEntries(
        roles.map((r) => [r.rid, { enabled: !['owner', 'admin'].includes(r.rid ?? ''), fields: [] as string[] }]),
      ),
      userRules: Object.fromEntries(
        users.map((ur) => [String(ur.userId), { enabled: !!ur.maskData, fields: [] as string[] }]),
      ),
    };
  }

  async updateMaskingRules(dto: UpdateMaskingRulesDto) {
    if (dto.userRules) {
      for (const [userId, rule] of Object.entries(dto.userRules)) {
        await this.userRoleRepo.update({ userId: Number(userId) }, { maskData: rule.enabled });
        // TODO: persist rule.fields to your masking-rules store (see resolveMaskedFields)
      }
    }
    // TODO: persist dto.roleRules to the same masking-rules store, keyed by role rid
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────
  // VENUES  (used by the "Venue Access" pickers)
  // ─────────────────────────────────────────────────────────────
  async listVenues() {
    return this.venueRepo.find();
  }

  /**
   * Maps a raw row from findMembers' joined SQL to the TeamMemberDto shape.
   * SCHEMA NOTE: `role` now comes from `u.role_type` (string on `users`),
   * not a joined roles table — team_id/team_name/team_role_id are included
   * from user_team_members/user_teams in case the UI needs them, but aren't
   * part of TeamMemberDto yet. Add them there if you want to surface them.
   */
  private buildMemberDtoFromRaw(row: any): TeamMemberDto {
    return {
      id: String(row.id),
      name: row.name,
      email: row.email,
      phone: row.phone ?? "",
      role: row.role_type ?? "viewer",
      status: row.status,
      isOnline: Boolean(row.is_online),
      masked: false, // no masking column in the real schema yet — see ASSUMPTION above
      venues: [],
      lastActive: row.last_seen ?? row.last_login,
      loginDevice: "—",
      loginLocation: "—",
      joinedAt: String(new Date(row.created_at)),
      loginAccess:
        row.status !== "suspended" &&
        row.invite_status === "accepted",
      maskedFields: [],
      recentActions: [],
      loginHistory: [],
      inviteStatus: row.invite_status ?? "accepted",
    };
  }
}
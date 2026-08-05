import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import axios from 'axios';

import { MailService } from '../../mail/mail.service';
import { ActivityLoggerService } from '../../common/activity-logger.service';
import { emailVerifyTemplate } from '../../common/email/templates/email-verify.template';

import { OAuth2Client } from 'google-auth-library';
import { SocketService } from '../socket/socket.service';

import { TwilioService } from '../integrations/twilio/twilio.service';

import DeviceDetector from "device-detector-js";
import { v4 as uuid } from "uuid";
import * as geoip from "geoip-lite";

const detector = new DeviceDetector();


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============================================================
// SESSION CONFIG
// ============================================================
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
const REFRESH_TOKEN_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class AuthService {
  constructor(
    private dataSource: DataSource,
    private readonly jwtService: JwtService,
    private mailService: MailService,
    private activityLogger: ActivityLoggerService,
    private socketService: SocketService,
    private twilioService: TwilioService
  ) {}

  // ============================================================
  // ✅ SESSION / LOGIN HISTORY HELPERS (NEW)
  // ============================================================

  /**
   * Extracts ip address from a Fastify request object.
   */
  private extractIp(req: any): string {
    if (!req) return '';
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return forwarded.toString().split(',')[0].trim();
    }
    return req.ip || req.raw?.socket?.remoteAddress || '';
  }

  /**
   * Refresh tokens are already high-entropy signed JWTs — unlike passwords,
   * there's nothing low-entropy here for bcrypt's slow hashing to protect
   * against. SHA-256 (constant-time compared) is the standard approach for
   * hashing tokens/API keys before storage, and costs <1ms instead of the
   * ~70-200ms bcrypt.hash() was costing on every single login.
   */
  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private compareRefreshToken(token: string, hash: string): boolean {
    const tokenHash = Buffer.from(this.hashRefreshToken(token));
    const storedHash = Buffer.from(hash || '');
    if (tokenHash.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(tokenHash, storedHash);
  }

  /**
   * Generates a signed refresh token (separate from the short-lived access token).
   */
  private generateRefreshToken(userId: number): string {
    return this.jwtService.sign(
      { id: userId, type: 'refresh' },
      {
        secret: REFRESH_TOKEN_SECRET,
        // `expiresIn` is typed by @nestjs/jwt as a branded `StringValue` (from `ms`),
        // not a plain string, so an env-derived string needs an explicit cast here.
        expiresIn: REFRESH_TOKEN_EXPIRES_IN as any,
      },
    );
  }

  /**
   * FAST PATH — call this synchronously from login/auto_login/etc.
   * Just generates the session id; costs microseconds. This is the only
   * part of "session creation" the client actually needs before it can
   * use the response (it needs a sessionId to pass to refresh/logout).
   */
  private newSessionId(): string {
    return uuid();
  }

  /**
   * SLOW PATH — device parsing, geoip lookup, and the DB writes for
   * user_sessions/login_history. None of this affects what we return to
   * the client, so callers must NOT `await` this — fire it after building
   * the response and let it finish in the background. Errors are caught
   * internally so a failure here can never surface as a failed login.
   */
  private async recordSessionInBackground(
    user: { id: number },
    req: any,
    refreshToken: string,
    sessionId: string,
  ): Promise<void> {
    try {
      const userAgent = req?.headers?.['user-agent'] || '';
      const ip = this.extractIp(req);

      let device: any = {};
      try {
        device = detector.parse(userAgent) || {};
      } catch {
        device = {};
      }

      const geo = ip ? geoip.lookup(ip) : null;

      const refreshTokenHash = this.hashRefreshToken(refreshToken);

      const now = new Date();
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

      // demote any other active sessions from "current"
      await this.dataSource.query(
        `UPDATE user_sessions SET is_current = 0 WHERE user_id = ? AND is_active = 1`,
        [user.id],
      );

      await this.dataSource.query(
        `INSERT INTO user_sessions (
          session_id, user_id, refresh_token_hash,
          device_type, device_name, browser, browser_version,
          os, os_version, ip_address, country, state, city,
          user_agent, is_current, is_active, login_at, last_activity, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`,
        [
          sessionId,
          user.id,
          refreshTokenHash,
          device?.device?.type || null,
          device?.device?.model || null,
          device?.client?.name || null,
          device?.client?.version || null,
          device?.os?.name || null,
          device?.os?.version || null,
          ip || null,
          geo?.country || null,
          geo?.region || null,
          geo?.city || null,
          userAgent || null,
          now,
          now,
          expiresAt,
        ],
      );

      await this.recordLoginHistory(user.id, sessionId, 'login', ip, geo, device);
    } catch (err) {
      // Never let background session bookkeeping break/crash the request
      // that already responded to the client.
      console.error('recordSessionInBackground failed:', err);
    }
  }

  /**
   * Writes a row to login_history. Used for login, logout, password_changed, etc.
   */
  private async recordLoginHistory(
    userId: number,
    sessionId: string | null,
    action: 'login' | 'logout' | 'password_changed' | '2fa_enabled' | '2fa_disabled',
    ip?: string,
    geo?: any,
    device?: any,
  ) {
    await this.dataSource.query(
      `INSERT INTO login_history (user_id, session_id, action, ip_address, city, country, browser, os)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        sessionId,
        action,
        ip || null,
        geo?.city || null,
        geo?.country || null,
        device?.client?.name || null,
        device?.os?.name || null,
      ],
    );
  }

  /**
   * FAST PATH callers use this instead of awaiting the UPDATE directly.
   * The client doesn't need this row's result to use its token/session,
   * so it's fired after we've already decided to log the user in, and
   * runs in the background like the session bookkeeping.
   */
  private markUserOnline(userId: number): void {
    this.dataSource
      .query(
        `
        UPDATE users
        SET
          is_online = 1,
          last_login = NOW(),
          last_seen = NOW()
        WHERE id = ?
        `,
        [userId],
      )
      .catch((err) => {
        console.error('markUserOnline failed:', err);
      });
  }

  // ✅ REGISTER
  async register(dto,country_id) {
    if (!dto?.email || !dto?.password) {
      throw new BadRequestException(
        'Username, email and password are required',
      );
    }

    const rows = await this.dataSource.query(
      `SELECT id FROM users WHERE email = ?`,
      [dto.email],
    );

    if (rows?.length) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const result = await this.dataSource.query(
      `INSERT INTO users (name, email, password,country)
     VALUES (?, ?, ? , ?)`,
      [dto.name, dto.email, hashedPassword,country_id],
    );

    // Role Created
    await this.dataSource.query(
      `INSERT INTO user_roles (user_id, role_id)
     VALUES (?, ? )`,
      [result.insertId, 3],
    );
    

    return {
      success: true,
      userId: result.insertId,
    };
  }

  // ✅ LOGIN
  // NOTE (NEW): now accepts `req` (Fastify request) as 2nd param so we can
  // capture device/ip/geo info for the session + login_history rows.
  // Existing behavior/queries are unchanged; only session creation is added.
  async login(dto, req?: any) {
    const users = await this.dataSource.query(
      // `SELECT * FROM users WHERE email = ?`,
      `SELECT users.* FROM users LEFT JOIN user_roles ON user_roles.user_id = users.id WHERE email = ? AND user_roles.role_id = 3`,
      [dto.email],
    );

    const user = users[0];

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

  this.markUserOnline(user.id);
 this.socketService.online(user.id); //socket

    const token = this.jwtService.sign({
      id: user.id,
    });

    // ---------------- NEW: session + login history ----------------
    const refreshToken = this.generateRefreshToken(user.id);
    const sessionId = this.newSessionId();
    // Fire-and-forget: device parsing, geoip lookup, and the session/
    // login_history inserts happen after the response is sent. The
    // client only needs the sessionId itself, not the DB writes.
    this.recordSessionInBackground(user, req, refreshToken, sessionId);
    // -----------------------------------------------------------------

    return {
      token: token,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async forgot_password(dto, otp: string) {
    if (!dto?.email) {
      throw new BadRequestException('Email are required');
    }

    const rows = await this.dataSource.query(
      `SELECT id FROM users WHERE email = ?`,
      [dto.email],
    );

    if (rows?.length == 0) {
      throw new ConflictException('Email Not Registered');
    }
    const hash = await bcrypt.hash(otp, 10);

    //`user_id`, `otp`, `expires_at`, `attempts`, `created_at` FROM `user_otps`
    const expire = new Date(Date.now() + 5 * 60 * 1000);
    const now = new Date();
    const result = await this.dataSource.query(
      `INSERT INTO user_otps (identifier, otp, expires_at, attempts,created_at)
     VALUES (?, ?, ?, ? , ? )`,
      [dto.email, hash, expire, 0, now],
    );
    const verifyLink = otp;
    const html = emailVerifyTemplate(verifyLink, dto.email);

    await this.mailService.sendMail(dto.email, 'Reset Your password', html);

    return {
      success: true,
      message: 'Password link send to mail',
    };
  }

  async update_password(dto) {
    const { email, otp, password } = dto;

    // 1. Get user
    const users = await this.dataSource.query(
      `SELECT * FROM users WHERE email = ?`,
      [email],
    );

    const user = users[0];

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 2. Validate OTP
    if (!user.otp || user.otp !== otp) {
      throw new BadRequestException('Invalid OTP');
    }

    // 3. Check expiry
    if (new Date() > new Date(user.otp_expiry)) {
      throw new BadRequestException('OTP expired');
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Update password + clear OTP
    await this.dataSource.query(
      `UPDATE users 
     SET password = ?, otp = NULL, otp_expiry = NULL 
     WHERE email = ?`,
      [hashedPassword, email],
    );
    const rows = await this.dataSource.query(
      `SELECT id FROM users WHERE email = ?`,
      [email],
    );

    // ---------------- NEW: audit trail for password change ----------------
    await this.recordLoginHistory(rows[0]?.id, null, 'password_changed');
    // ------------------------------------------------------------------------

    return {
      user: rows[0],
      success: true,
      message: 'Password updated successfully',
    };
  }

  async auto_login(dto, req?: any) {
    const users = await this.dataSource.query(
      // `SELECT * FROM users WHERE id = ?`,
      `SELECT * FROM users LEFT JOIN user_roles ON user_roles.user_id = users.id WHERE id = ? AND user_roles.role_id = 3`,
      [dto.id],
    );

    const user = users[0];

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
  this.markUserOnline(user.id);
    const token = this.jwtService.sign({
      id: user.id,
    });

    // ---------------- NEW: session + login history ----------------
    const refreshToken = this.generateRefreshToken(user.id);
    const sessionId = this.newSessionId();
    // Fire-and-forget: device parsing, geoip lookup, and the session/
    // login_history inserts happen after the response is sent. The
    // client only needs the sessionId itself, not the DB writes.
    this.recordSessionInBackground(user, req, refreshToken, sessionId);
    // -----------------------------------------------------------------

    return {
      token: token,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async googleLogin(data: any, req?: any) {
  try {
    const token = data.token;

    // ==============================
    // 1. VERIFY GOOGLE TOKEN
    // ==============================
    const googleRes = await axios.get(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const googleUser = googleRes.data;

    if (!googleUser?.email) {
      throw new Error('Google email not found');
    }

    // ==============================
    // 2. CHECK USER EXISTS
    // ==============================
    const existingUsers = await this.dataSource.query(
      `
      SELECT users.*, user_roles.role_id
      FROM users
      LEFT JOIN user_roles 
        ON user_roles.user_id = users.id
      WHERE users.email = ?
      LIMIT 1
      `,
      [googleUser.email],
    );

    let user: any;
    let isNewUser = false;

    // ==============================
    // 3. REGISTER NEW USER
    // ==============================
    if (existingUsers.length === 0) {
      isNewUser = true;

      const insertResult = await this.dataSource.query(
        `
        INSERT INTO users (
          name,
          email,
          logo,
          is_online,
          last_login,
          last_seen
        )
        VALUES (?, ?, ?, ?, NOW(), NOW())
        `,
        [
          googleUser.name || '',
          googleUser.email,
          googleUser.picture || '',
          1,
        ],
      );

      const userId = insertResult.insertId;

      // DEFAULT ROLE = CUSTOMER
      await this.dataSource.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
        `,
        [userId, 3],
      );

      // FETCH CREATED USER
      const newUser = await this.dataSource.query(
        `
        SELECT users.*, user_roles.role_id
        FROM users
        LEFT JOIN user_roles 
          ON user_roles.user_id = users.id
        WHERE users.id = ?
        LIMIT 1
        `,
        [userId],
      );

      user = newUser[0];
    } else {
      // ==============================
      // 4. EXISTING USER LOGIN
      // ==============================
      user = existingUsers[0];

      this.markUserOnline(user.id);
    }

    // ==============================
    // 5. SOCKET ONLINE STATUS
    // ==============================
    this.socketService.online(user.id);

    // ==============================
    // 6. GENERATE JWT TOKEN
    // ==============================
    const jwtToken = this.jwtService.sign({
      id: user.id,
      email: user.email,
    });

    // ---------------- NEW: session + login history ----------------
    const refreshToken = this.generateRefreshToken(user.id);
    const sessionId = this.newSessionId();
    // Fire-and-forget: device parsing, geoip lookup, and the session/
    // login_history inserts happen after the response is sent. The
    // client only needs the sessionId itself, not the DB writes.
    this.recordSessionInBackground(user, req, refreshToken, sessionId);
    // -----------------------------------------------------------------

    // ==============================
    // 7. RETURN RESPONSE
    // ==============================
    return {
      success: true,
      message: isNewUser
        ? 'Registration successful'
        : 'Login successful',

      isNewUser,

      token: jwtToken,
      refreshToken,
      sessionId,

      user,
    };
  } catch (error) {
    console.error('GOOGLE LOGIN ERROR:', error);

    throw new HttpException(
      error || 'Google login failed',
      HttpStatus.BAD_REQUEST,
    );
  }
}

  // async findById(id: string) {
  //   const newUser = await this.dataSource.query(
  //     `SELECT * FROM users WHERE id = ? `,
  //     [id],
  //   );

  //   return newUser[0];
  // }
//  async findById(id: string) {
//   const user = await this.dataSource.query(
//     `
//     SELECT
//       u.id,
//       u.name,
//       u.email,

//       EXISTS (
//         SELECT 1
//         FROM user_roles ur
//         WHERE ur.user_id = u.id
//           AND ur.role_id = 2
//       ) AS is_vendor,

//       EXISTS (
//         SELECT 1
//         FROM venue_parent vp
//         WHERE vp.created_by = u.id
//       ) AS is_parent
       
//       EXISTS (
//         SELECT 1
//         FROM user_subscriptions us
//         WHERE us.user_id = u.id
//       ) AS subscribe_status

//     FROM users u
//     WHERE u.id = ?
//     LIMIT 1
//     `,
//     [id],
//   );

//   return user[0];
// }
async findById(id: string) {
  const [user] = await this.dataSource.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,

      EXISTS (
        SELECT 1
        FROM user_roles ur
        WHERE ur.user_id = u.id
          AND ur.role_id = 2
      ) AS is_vendor,

      EXISTS (
        SELECT 1
        FROM venue_parent vp
        WHERE vp.created_by = u.id
      ) AS is_parent,

      CASE
        WHEN us.id IS NOT NULL THEN 1
        ELSE 0
      END AS subscribe_status,

      us.status,
      us.plan_id,
      us.end_date,
      us.next_billing_date,

      p.plan_name,
      p.plan_title,
      p.min_venue,
      p.max_venue

    FROM users u

    LEFT JOIN (
      SELECT
        user_id,
        id,
        status,
        plan_id,
        end_date,
        next_billing_date
      FROM user_subscriptions
      WHERE status = 1
    ) us ON us.user_id = u.id

    LEFT JOIN plans p ON p.id = us.plan_id

    WHERE u.id = ?
    LIMIT 1
    `,
    [id],
  );

  if (user) {
    if (user.max_venue === 1) {
      user.plan_category = 'starter';
    } else if (user.max_venue >= 2 && user.max_venue <= 4) {
      user.plan_category = 'professional';
    } else if (user.max_venue >= 5) {
      user.plan_category = 'business';
    } else {
      user.plan_category = null;
    }
    if(user.plan_title==1) {
      user.plan_type = 'Monthly';
    }
    else{
      user.plan_type = 'Yearly';
    }
  }

  return user;
}
  async send_otp(identifier: string, otp: string) {
    const hash = await bcrypt.hash(otp, 10);

    //`user_id`, `otp`, `expires_at`, `attempts`, `created_at` FROM `user_otps`
    const expire = new Date(Date.now() + 5 * 60 * 1000);
    const now = new Date();
    const result = await this.dataSource.query(
      `INSERT INTO user_otps (identifier, otp, expires_at, attempts,created_at)
     VALUES (?, ?, ?, ? , ? )`,
      [identifier, hash, expire, 0, now],
    );


//send Whatsapp

// await this.twilioService.sendWhatsApp({
//   to: identifier,
//   body: `OTP sent successfully - Your OTP is ${otp}`
// });

  }

  async verifyOtp(identifier: string, otp: string, req?: any) {
    const records = await this.dataSource.query(
      `SELECT * FROM user_otps WHERE identifier = ? ORDER BY id DESC LIMIT 1`,
      [identifier],
    );

    if (!records || records.length === 0) {
      throw new Error('OTP not found');
    }

    const record = records[0];

    // ✅ Validate input
    if (!otp) {
      throw new Error('OTP is required');
    }

    if (!record.otp) {
      throw new Error('Stored OTP hash missing');
    }

    // ✅ Expiry check
    if (new Date(record.expires_at) < new Date()) {
      throw new Error('OTP expired');
    }

    // ✅ Attempts check
    if (record.attempts >= 5) {
      throw new Error('Too many attempts');
    }

    // ✅ Compare OTP
    const isValid = await bcrypt.compare(String(otp), String(record.otp));

    if (!isValid) {
      await this.dataSource.query(
        `UPDATE user_otps SET attempts = attempts + 1 WHERE id = ?`,
        [record.id],
      );

      throw new Error('Invalid OTP');
    }

    // ✅ Delete OTP after success
    await this.dataSource.query(`DELETE FROM user_otps WHERE id = ?`, [
      record.id,
    ]);
const phone = identifier.replace(/\D/g, '').slice(-10);
    // ✅ Get user
    let users = await this.dataSource.query(
      //`SELECT id, name, email FROM users WHERE phone = ? LIMIT 1`,
      `SELECT * FROM users  WHERE phone = ? `,
      [phone],
    );

    let user;

    if (!users || users.length === 0) {
      // ✅ Create user
      const insertResult = await this.dataSource.query(
        `INSERT INTO users (name, email, phone)
       VALUES (?, ?, ?)`,
        [null, null, phone],
      );

      // Role Created
      await this.dataSource.query(
        `INSERT INTO user_roles (user_id, role_id)
     VALUES (?, ? )`,
        [insertResult.insertId, 3],
      );

      user = {
        id: insertResult.insertId,
        name: null,
        email: null,
      };
    } else {
      user = users[0];
    }

    // ✅ JWT (minimal payload recommended)
    const jwtToken = this.jwtService.sign({
      id: user.id,
    });

    // ---------------- NEW: session + login history ----------------
    const refreshToken = this.generateRefreshToken(user.id);
    const sessionId = this.newSessionId();
    // Fire-and-forget: device parsing, geoip lookup, and the session/
    // login_history inserts happen after the response is sent. The
    // client only needs the sessionId itself, not the DB writes.
    this.recordSessionInBackground(user, req, refreshToken, sessionId);
    // -----------------------------------------------------------------

    return {
      message: 'OTP verified',
      token: jwtToken,
      refreshToken,
      sessionId,
      user,
    };
  }

  // ============================================================
  // ✅ REFRESH TOKEN (NEW)
  // ============================================================
  async refreshToken(dto: { refreshToken: string; sessionId: string }) {
    if (!dto?.refreshToken || !dto?.sessionId) {
      throw new BadRequestException('refreshToken and sessionId are required');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: REFRESH_TOKEN_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const sessions = await this.dataSource.query(
      `SELECT * FROM user_sessions WHERE session_id = ? AND user_id = ? AND is_active = 1`,
      [dto.sessionId, payload.id],
    );
    const session = sessions[0];

    if (!session) {
      throw new UnauthorizedException('Session not found or revoked');
    }

    if (new Date(session.expires_at) < new Date()) {
      await this.dataSource.query(
        `UPDATE user_sessions SET is_active = 0 WHERE session_id = ?`,
        [dto.sessionId],
      );
      throw new UnauthorizedException('Session expired, please login again');
    }

    const isMatch = this.compareRefreshToken(
      dto.refreshToken,
      session.refresh_token_hash,
    );
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccessToken = this.jwtService.sign({ id: payload.id });

    await this.dataSource.query(
      `UPDATE user_sessions SET last_activity = NOW() WHERE session_id = ?`,
      [dto.sessionId],
    );

    return { token: newAccessToken };
  }

  // ============================================================
  // ✅ LIST / MANAGE SESSIONS (NEW)
  // ============================================================
  async getUserSessions(userId: number) {
    return this.dataSource.query(
      `SELECT session_id, device_type, device_name, browser, browser_version,
              os, os_version, ip_address, country, state, city,
              is_current, is_active, login_at, last_activity, expires_at
       FROM user_sessions
       WHERE user_id = ? AND is_active = 1
       ORDER BY last_activity DESC`,
      [userId],
    );
  }

  async revokeSession(userId: number, sessionId: string) {
    const result = await this.dataSource.query(
      `UPDATE user_sessions
       SET is_active = 0, is_current = 0, logout_at = NOW()
       WHERE session_id = ? AND user_id = ?`,
      [sessionId, userId],
    );

    await this.recordLoginHistory(userId, sessionId, 'logout');

    return { success: true, message: 'Session revoked' };
  }

  async logout(userId: number, sessionId?: string) {
    console.log(userId)
  await this.dataSource.query(
    `
    UPDATE users
    SET
      is_online = 0,
      last_logout = NOW()
    WHERE id = ?
    `,
    [userId],
  );

  // ---------------- NEW: close session(s) + login history ----------------
  if (sessionId) {
    await this.dataSource.query(
      `UPDATE user_sessions
       SET is_active = 0, is_current = 0, logout_at = NOW()
       WHERE session_id = ? AND user_id = ?`,
      [sessionId, userId],
    );
  } else {
    await this.dataSource.query(
      `UPDATE user_sessions
       SET is_active = 0, is_current = 0, logout_at = NOW()
       WHERE user_id = ? AND is_active = 1`,
      [userId],
    );
  }

  await this.recordLoginHistory(userId, sessionId || null, 'logout');
  // ---------------------------------------------------------------------------

  return {
    message: 'Logged out',
  };
}
}
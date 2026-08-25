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

import { SocketService } from '../socket/socket.service';
import { TwilioService } from '../integrations/twilio/twilio.service';

import { UAParser } from 'ua-parser-js';
import { v4 as uuid } from 'uuid';
import * as geoip from 'geoip-lite';

// ============================================================
// REFRESH TOKEN CONFIG
// ============================================================

const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  process.env.JWT_SECRET;

const REFRESH_TOKEN_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN ||
  '30d';

const REFRESH_TOKEN_TTL_MS =
  30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly activityLogger: ActivityLoggerService,
    private readonly socketService: SocketService,
    private readonly twilioService: TwilioService,
  ) {}

  // ============================================================
  // IP ADDRESS
  // ============================================================

  private normalizeIp(ip: string): string {
    if (!ip) {
      return '';
    }

    ip = ip.trim();

    // IPv4 mapped IPv6
    // ::ffff:192.168.1.10
    // becomes
    // 192.168.1.10

    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }

    // IPv6 localhost
    if (ip === '::1') {
      return '127.0.0.1';
    }

    return ip;
  }

  // ============================================================
  // GET CLIENT IP
  // ============================================================

  private extractIp(req: any): string {
    if (!req) {
      return '';
    }

    const headers = req.headers || {};

    // ============================================================
    // CLOUDFLARE
    // ============================================================

    const cloudflareIp =
      headers['cf-connecting-ip'] ||
      headers['CF-Connecting-IP'];

    if (cloudflareIp) {
      return this.normalizeIp(
        String(cloudflareIp),
      );
    }

    // ============================================================
    // X-FORWARDED-FOR
    // NGINX / ALB / LOAD BALANCER
    // ============================================================

    const forwardedFor =
      headers['x-forwarded-for'] ||
      headers['X-Forwarded-For'];

    if (forwardedFor) {
      const ips = String(forwardedFor)
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);

      if (ips.length > 0) {
        return this.normalizeIp(
          ips[0],
        );
      }
    }

    // ============================================================
    // X-REAL-IP
    // ============================================================

    const realIp =
      headers['x-real-ip'] ||
      headers['X-Real-IP'];

    if (realIp) {
      return this.normalizeIp(
        String(realIp),
      );
    }

    // ============================================================
    // FASTIFY
    // ============================================================

    if (req.ip) {
      return this.normalizeIp(
        String(req.ip),
      );
    }

    // ============================================================
    // SOCKET
    // ============================================================

    const socketIp =
      req.raw?.socket?.remoteAddress;

    if (socketIp) {
      return this.normalizeIp(
        String(socketIp),
      );
    }

    return '';
  }

  // ============================================================
  // CHECK PRIVATE IP
  // ============================================================

  private isPrivateIp(ip: string): boolean {
    if (!ip) {
      return true;
    }

    // localhost
    if (
      ip === '127.0.0.1' ||
      ip === '::1'
    ) {
      return true;
    }

    // 10.0.0.0/8
    if (ip.startsWith('10.')) {
      return true;
    }

    // 192.168.0.0/16
    if (ip.startsWith('192.168.')) {
      return true;
    }

    // 172.16.0.0 - 172.31.255.255
    const parts = ip.split('.');

    if (parts.length === 4) {
      const first = Number(parts[0]);
      const second = Number(parts[1]);

      if (
        first === 172 &&
        second >= 16 &&
        second <= 31
      ) {
        return true;
      }
    }

    return false;
  }

  // ============================================================
  // GEOIP
  // ============================================================

  private getGeoLocation(ip: string): any {
    try {
      if (
        !ip ||
        this.isPrivateIp(ip)
      ) {
        return null;
      }

      return geoip.lookup(ip) || null;
    } catch (error) {
      console.error(
        'GeoIP lookup failed:',
        error,
      );

      return null;
    }
  }

  // ============================================================
  // DEVICE / BROWSER / OS
  // ============================================================

  private getDeviceInformation(
    userAgent: string,
  ) {
    try {
      if (!userAgent) {
        return {
          browser: null,
          browserVersion: null,
          os: null,
          osVersion: null,
          deviceType: 'desktop',
          deviceName: null,
          raw: null,
        };
      }

      const parser =
        new UAParser(userAgent);

      const result =
        parser.getResult();

      console.log(
        '================ USER AGENT ================',
      );

      console.log(userAgent);

      console.log(
        '================ UA RESULT =================',
      );

      console.dir(result, {
        depth: null,
      });

      console.log(
        '=============================================',
      );

      // Desktop normally doesn't have device.type
      const deviceType =
        result.device.type ||
        'desktop';

      const deviceName =
        result.device.model ||
        result.device.vendor ||
        null;

      const browser =
        result.browser.name ||
        null;

      const browserVersion =
        result.browser.version ||
        null;

      const os =
        result.os.name ||
        null;

      const osVersion =
        result.os.version ||
        null;

      return {
        browser,
        browserVersion,
        os,
        osVersion,
        deviceType,
        deviceName,
        raw: result,
      };
    } catch (error) {
      console.error(
        'UA parser failed:',
        error,
      );

      return {
        browser: null,
        browserVersion: null,
        os: null,
        osVersion: null,
        deviceType: 'desktop',
        deviceName: null,
        raw: null,
      };
    }
  }

  // ============================================================
  // HASH REFRESH TOKEN
  // ============================================================

  private hashRefreshToken(
    token: string,
  ): string {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  // ============================================================
  // COMPARE REFRESH TOKEN
  // ============================================================

  private compareRefreshToken(
    token: string,
    hash: string,
  ): boolean {
    try {
      const tokenHash =
        Buffer.from(
          this.hashRefreshToken(token),
        );

      const storedHash =
        Buffer.from(hash || '');

      if (
        tokenHash.length !==
        storedHash.length
      ) {
        return false;
      }

      return crypto.timingSafeEqual(
        tokenHash,
        storedHash,
      );
    } catch {
      return false;
    }
  }

  // ============================================================
  // GENERATE REFRESH TOKEN
  // ============================================================

  private generateRefreshToken(
    userId: number,
  ): string {
    return this.jwtService.sign(
      {
        id: userId,
        type: 'refresh',
      },
      {
        secret:
          REFRESH_TOKEN_SECRET,

        expiresIn:
          REFRESH_TOKEN_EXPIRES_IN as any,
      },
    );
  }

  // ============================================================
  // SESSION ID
  // ============================================================

  private newSessionId(): string {
    return uuid();
  }

  // ============================================================
  // RECORD SESSION
  // ============================================================

  private async recordSessionInBackground(
    user: { id: number },
    req: any,
    refreshToken: string,
    sessionId: string,
  ): Promise<void> {
    try {
      // ============================================================
      // USER AGENT
      // ============================================================

      const userAgent =
        req?.headers?.['user-agent'] ||
        req?.headers?.['User-Agent'] ||
        '';

      // ============================================================
      // IP
      // ============================================================

      const ip =
        this.extractIp(req);

      // ============================================================
      // DEVICE
      // ============================================================

      const device =
        this.getDeviceInformation(
          userAgent,
        );

      // ============================================================
      // GEO
      // ============================================================

      const geo =
        this.getGeoLocation(ip);

      // ============================================================
      // TOKEN HASH
      // ============================================================

      const refreshTokenHash =
        this.hashRefreshToken(
          refreshToken,
        );

      // ============================================================
      // DATE
      // ============================================================

      const now =
        new Date();

      const expiresAt =
        new Date(
          Date.now() +
            REFRESH_TOKEN_TTL_MS,
        );

      // ============================================================
      // DEBUG
      // ============================================================

      console.log(
        '========== SESSION DATA ==========',
      );

      console.log({
        userId: user.id,
        sessionId,

        ip,

        deviceType:
          device.deviceType,

        deviceName:
          device.deviceName,

        browser:
          device.browser,

        browserVersion:
          device.browserVersion,

        os:
          device.os,

        osVersion:
          device.osVersion,

        country:
          geo?.country || null,

        state:
          geo?.region || null,

        city:
          geo?.city || null,
      });

      console.log(
        '==================================',
      );

      // ============================================================
      // OLD SESSION CURRENT = 0
      // ============================================================

      await this.dataSource.query(
        `
        UPDATE user_sessions
        SET is_current = 0
        WHERE user_id = ?
          AND is_active = 1
        `,
        [user.id],
      );

      // ============================================================
      // INSERT SESSION
      // ============================================================

      await this.dataSource.query(
        `
        INSERT INTO user_sessions (
          session_id,
          user_id,
          refresh_token_hash,

          device_type,
          device_name,

          browser,
          browser_version,

          os,
          os_version,

          ip_address,

          country,
          state,
          city,

          user_agent,

          is_current,
          is_active,

          login_at,
          last_activity,
          expires_at
        )
        VALUES (
          ?, ?, ?,

          ?, ?,

          ?, ?,

          ?, ?,

          ?,

          ?, ?, ?,

          ?,

          1,
          1,

          ?, ?, ?
        )
        `,
        [
          sessionId,
          user.id,
          refreshTokenHash,

          device.deviceType,
          device.deviceName,

          device.browser,
          device.browserVersion,

          device.os,
          device.osVersion,

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

      // ============================================================
      // LOGIN HISTORY
      // ============================================================

      await this.recordLoginHistory(
        user.id,
        sessionId,
        'login',
        ip,
        geo,
        device.raw,
      );

      console.log(
        'SESSION SAVED SUCCESSFULLY',
      );
    } catch (error) {
      console.error(
        'recordSessionInBackground failed:',
        error,
      );
    }
  }

  // ============================================================
  // LOGIN HISTORY
  // ============================================================

  private async recordLoginHistory(
    userId: number,
    sessionId: string | null,
    action:
      | 'login'
      | 'logout'
      | 'password_changed'
      | '2fa_enabled'
      | '2fa_disabled',
    ip?: string,
    geo?: any,
    device?: any,
  ) {
    try {
      await this.dataSource.query(
        `
        INSERT INTO login_history (
          user_id,
          session_id,
          action,
          ip_address,
          city,
          country,
          browser,
          os
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          sessionId,
          action,

          ip || null,

          geo?.city || null,
          geo?.country || null,

          device?.browser?.name ||
            device?.client?.name ||
            null,

          device?.os?.name ||
            null,
        ],
      );
    } catch (error) {
      console.error(
        'recordLoginHistory failed:',
        error,
      );
    }
  }

  // ============================================================
  // MARK USER ONLINE
  // ============================================================

  private markUserOnline(
    userId: number,
  ): void {
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
      .catch((error) => {
        console.error(
          'markUserOnline failed:',
          error,
        );
      });
  }

  // ============================================================
  // REGISTER
  // ============================================================

  async register(
    dto: any,
    country_id: number,
  ) {
    if (
      !dto?.email ||
      !dto?.password
    ) {
      throw new BadRequestException(
        'Username, email and password are required',
      );
    }

    const rows =
      await this.dataSource.query(
        `
        SELECT id
        FROM users
        WHERE email = ?
        `,
        [dto.email],
      );

    if (rows?.length) {
      throw new ConflictException(
        'Email already exists',
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        dto.password,
        10,
      );

    const result =
      await this.dataSource.query(
        `
        INSERT INTO users (
          name,
          email,
          password,
          country
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          dto.name,
          dto.email,
          hashedPassword,
          country_id,
        ],
      );

    // CUSTOMER ROLE
    await this.dataSource.query(
      `
      INSERT INTO user_roles (
        user_id,
        role_id
      )
      VALUES (?, ?)
      `,
      [
        result.insertId,
        3,
      ],
    );

    return {
      success: true,
      userId: result.insertId,
    };
  }

  // ============================================================
  // LOGIN
  // ============================================================

  async login(
    dto: any,
    req?: any,
  ) {
    const users =
      await this.dataSource.query(
        `
        SELECT users.*
        FROM users
        LEFT JOIN user_roles
          ON user_roles.user_id =
             users.id
        WHERE users.email = ?
          AND user_roles.role_id = 3
        LIMIT 1
        `,
        [dto.email],
      );

    const user =
      users[0];

    if (!user) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    const isMatch =
      await bcrypt.compare(
        dto.password,
        user.password,
      );

    if (!isMatch) {
      throw new UnauthorizedException(
        'Invalid credentials',
      );
    }

    // ONLINE
    this.markUserOnline(
      user.id,
    );

    // SOCKET
    this.socketService.online(
      user.id,
    );

    // ACCESS TOKEN
    const token =
      this.jwtService.sign({
        id: user.id,
      });

    // REFRESH TOKEN
    const refreshToken =
      this.generateRefreshToken(
        user.id,
      );

    // SESSION ID
    const sessionId =
      this.newSessionId();

    // BACKGROUND SESSION
    void this.recordSessionInBackground(
      user,
      req,
      refreshToken,
      sessionId,
    );

    return {
      token,
      refreshToken,
      sessionId,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  async forgot_password(
    dto: any,
    otp: string,
  ) {
    if (!dto?.email) {
      throw new BadRequestException(
        'Email is required',
      );
    }

    const rows =
      await this.dataSource.query(
        `
        SELECT id
        FROM users
        WHERE email = ?
        `,
        [dto.email],
      );

    if (!rows?.length) {
      throw new ConflictException(
        'Email Not Registered',
      );
    }

    const hash =
      await bcrypt.hash(
        otp,
        10,
      );

    const expire =
      new Date(
        Date.now() +
          5 * 60 * 1000,
      );

    const now =
      new Date();

    await this.dataSource.query(
      `
      INSERT INTO user_otps (
        identifier,
        otp,
        expires_at,
        attempts,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        dto.email,
        hash,
        expire,
        0,
        now,
      ],
    );

    const html =
      emailVerifyTemplate(
        otp,
        dto.email,
      );

    await this.mailService.sendMail(
      dto.email,
      'Reset Your password',
      html,
    );

    return {
      success: true,
      message:
        'Password link sent to mail',
    };
  }

  // ============================================================
  // UPDATE PASSWORD
  // ============================================================

  async update_password(
    dto: any,
  ) {
    const {
      email,
      otp,
      password,
    } = dto;

    if (
      !email ||
      !otp ||
      !password
    ) {
      throw new BadRequestException(
        'Email, OTP and password are required',
      );
    }

    // ============================================================
    // GET LATEST OTP
    // ============================================================

    const otpRecords =
      await this.dataSource.query(
        `
        SELECT *
        FROM user_otps
        WHERE identifier = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [email],
      );

    if (
      !otpRecords ||
      otpRecords.length === 0
    ) {
      throw new BadRequestException(
        'OTP not found',
      );
    }

    const otpRecord =
      otpRecords[0];

    if (
      new Date(
        otpRecord.expires_at,
      ) < new Date()
    ) {
      throw new BadRequestException(
        'OTP expired',
      );
    }

    const otpValid =
      await bcrypt.compare(
        String(otp),
        String(otpRecord.otp),
      );

    if (!otpValid) {
      throw new BadRequestException(
        'Invalid OTP',
      );
    }

    // ============================================================
    // GET USER
    // ============================================================

    const users =
      await this.dataSource.query(
        `
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
        [email],
      );

    const user =
      users[0];

    if (!user) {
      throw new BadRequestException(
        'User not found',
      );
    }

    // ============================================================
    // PASSWORD
    // ============================================================

    const hashedPassword =
      await bcrypt.hash(
        password,
        10,
      );

    await this.dataSource.query(
      `
      UPDATE users
      SET password = ?
      WHERE email = ?
      `,
      [
        hashedPassword,
        email,
      ],
    );

    // DELETE OTP
    await this.dataSource.query(
      `
      DELETE FROM user_otps
      WHERE id = ?
      `,
      [otpRecord.id],
    );

    // ============================================================
    // HISTORY
    // ============================================================

    await this.recordLoginHistory(
      user.id,
      null,
      'password_changed',
    );

    return {
      success: true,
      user,
      message:
        'Password updated successfully',
    };
  }

  // ============================================================
  // AUTO LOGIN
  // ============================================================

  async auto_login(
    dto: any,
    req?: any,
  ) {
    const users =
      await this.dataSource.query(
        `
        SELECT users.*
        FROM users
        LEFT JOIN user_roles
          ON user_roles.user_id =
             users.id
        WHERE users.id = ?
          AND user_roles.role_id = 3
        LIMIT 1
        `,
        [dto.id],
      );

    const user =
      users[0];

    if (!user) {
      throw new UnauthorizedException(
        'User not found',
      );
    }

    this.markUserOnline(
      user.id,
    );

    const token =
      this.jwtService.sign({
        id: user.id,
      });

    const refreshToken =
      this.generateRefreshToken(
        user.id,
      );

    const sessionId =
      this.newSessionId();

    void this.recordSessionInBackground(
      user,
      req,
      refreshToken,
      sessionId,
    );

    return {
      token,
      refreshToken,
      sessionId,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  // ============================================================
  // GOOGLE LOGIN
  // ============================================================

  async googleLogin(
    data: any,
    req?: any,
  ) {
    try {
      const token =
        data?.token;

      if (!token) {
        throw new BadRequestException(
          'Google token is required',
        );
      }

      // ============================================================
      // GOOGLE USER INFO
      // ============================================================

      const googleRes =
        await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const googleUser =
        googleRes.data;

      if (!googleUser?.email) {
        throw new BadRequestException(
          'Google email not found',
        );
      }

      // ============================================================
      // EXISTING USER
      // ============================================================

      const existingUsers =
        await this.dataSource.query(
          `
          SELECT
            users.*,
            user_roles.role_id
          FROM users
          LEFT JOIN user_roles
            ON user_roles.user_id =
               users.id
          WHERE users.email = ?
          LIMIT 1
          `,
          [googleUser.email],
        );

      let user: any;

      let isNewUser =
        false;

      // ============================================================
      // NEW USER
      // ============================================================

      if (
        existingUsers.length === 0
      ) {
        isNewUser = true;

        const insertResult =
          await this.dataSource.query(
            `
            INSERT INTO users (
              name,
              email,
              logo,
              is_online,
              last_login,
              last_seen
            )
            VALUES (
              ?, ?, ?, ?, NOW(), NOW()
            )
            `,
            [
              googleUser.name || '',
              googleUser.email,
              googleUser.picture || '',
              1,
            ],
          );

        const userId =
          insertResult.insertId;

        await this.dataSource.query(
          `
          INSERT INTO user_roles (
            user_id,
            role_id
          )
          VALUES (?, ?)
          `,
          [
            userId,
            3,
          ],
        );

        const newUsers =
          await this.dataSource.query(
            `
            SELECT
              users.*,
              user_roles.role_id
            FROM users
            LEFT JOIN user_roles
              ON user_roles.user_id =
                 users.id
            WHERE users.id = ?
            LIMIT 1
            `,
            [userId],
          );

        user =
          newUsers[0];
      } else {
        // ============================================================
        // EXISTING USER
        // ============================================================

        user =
          existingUsers[0];

        this.markUserOnline(
          user.id,
        );
      }

      // ============================================================
      // SOCKET
      // ============================================================

      this.socketService.online(
        user.id,
      );

      // ============================================================
      // ACCESS TOKEN
      // ============================================================

      const jwtToken =
        this.jwtService.sign({
          id: user.id,
          email: user.email,
        });

      // ============================================================
      // REFRESH TOKEN
      // ============================================================

      const refreshToken =
        this.generateRefreshToken(
          user.id,
        );

      // ============================================================
      // SESSION
      // ============================================================

      const sessionId =
        this.newSessionId();

      void this.recordSessionInBackground(
        user,
        req,
        refreshToken,
        sessionId,
      );

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
    } catch (error: any) {
      console.error(
        'GOOGLE LOGIN ERROR:',
        error,
      );

      if (
        error instanceof HttpException
      ) {
        throw error;
      }

      throw new HttpException(
        'Google login failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ============================================================
  // FIND USER BY ID
  // ============================================================

  async findById(
    id: string,
  ) {
    const [user] =
      await this.dataSource.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.logo AS avatar,

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
            WHEN us.id IS NOT NULL
            THEN 1
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
        ) us
          ON us.user_id = u.id

        LEFT JOIN plans p
          ON p.id = us.plan_id

        WHERE u.id = ?

        LIMIT 1
        `,
        [id],
      );

    if (user) {
      if (
        Number(user.max_venue) === 1
      ) {
        user.plan_category =
          'starter';
      } else if (
        Number(user.max_venue) >= 2 &&
        Number(user.max_venue) <= 4
      ) {
        user.plan_category =
          'professional';
      } else if (
        Number(user.max_venue) >= 5
      ) {
        user.plan_category =
          'business';
      } else {
        user.plan_category =
          null;
      }

      if (
        Number(user.plan_title) === 1
      ) {
        user.plan_type =
          'Monthly';
      } else {
        user.plan_type =
          'Yearly';
      }
    }

    return user;
  }

  // ============================================================
  // SEND OTP
  // ============================================================

  async send_otp(
    identifier: string,
    otp: string,
  ) {
    if (
      !identifier ||
      !otp
    ) {
      throw new BadRequestException(
        'Identifier and OTP are required',
      );
    }

    const hash =
      await bcrypt.hash(
        otp,
        10,
      );

    const expire =
      new Date(
        Date.now() +
          5 * 60 * 1000,
      );

    const now =
      new Date();

    await this.dataSource.query(
      `
      INSERT INTO user_otps (
        identifier,
        otp,
        expires_at,
        attempts,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        identifier,
        hash,
        expire,
        0,
        now,
      ],
    );

    // /*
    // // WhatsApp
    // await this.twilioService.sendWhatsApp({
    //   to: identifier,
    //   otp: otp,
    // });

    // await this.twilioService.sendWhatsApp(identifier,otp)
const phone = String(identifier).replace(/\D/g, "");

const phoneWithCountryCode = phone.startsWith("91")
  ? `+${phone}`
  : `+91${phone}`;

await this.twilioService.sendWhatsApp(phoneWithCountryCode, otp);
    
    // */

    return {
      success: true,
      message:
        'OTP sent successfully',
    };
  }

  // ============================================================
  // VERIFY OTP
  // ============================================================

async verifyOtp(
  identifier: string,
  otp: string,
  req?: any,
) {
  // ============================================================
  // NORMALIZE PHONE
  // ============================================================

  const phone = String(identifier)
    .replace(/\D/g, '')
    .slice(-10);

  // ============================================================
  // FIND OTP
  // ============================================================

  const records = await this.dataSource.query(
    `
    SELECT *
    FROM user_otps
    WHERE identifier = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [phone],
  );

  if (!records || records.length === 0) {
    throw new BadRequestException('OTP not found');
  }

  const record = records[0];

  // ============================================================
  // INPUT
  // ============================================================

  if (!otp) {
    throw new BadRequestException('OTP is required');
  }

  if (!record.otp) {
    throw new BadRequestException('Stored OTP hash missing');
  }

  // ============================================================
  // EXPIRY
  // ============================================================

  if (new Date(record.expires_at) < new Date()) {
    throw new BadRequestException('OTP expired');
  }

  // ============================================================
  // ATTEMPTS
  // ============================================================

  if (Number(record.attempts) >= 5) {
    throw new BadRequestException('Too many attempts');
  }

  // ============================================================
  // COMPARE
  // ============================================================

  const isValid = await bcrypt.compare(
    String(otp),
    String(record.otp),
  );

  if (!isValid) {
    await this.dataSource.query(
      `
      UPDATE user_otps
      SET attempts = attempts + 1
      WHERE id = ?
      `,
      [record.id],
    );

    throw new BadRequestException('Invalid OTP');
  }

  // ============================================================
  // DELETE OTP
  // ============================================================

  await this.dataSource.query(
    `
    DELETE FROM user_otps
    WHERE id = ?
    `,
    [record.id],
  );

  // ============================================================
  // USER
  // ============================================================

  const users = await this.dataSource.query(
    `
    SELECT *
    FROM users
    WHERE phone = ?
    LIMIT 1
    `,
    [phone],
  );

  let user: any;

  if (!users || users.length === 0) {
    const insertResult = await this.dataSource.query(
      `
      INSERT INTO users (
        name,
        email,
        phone,
        is_online,
        last_login,
        last_seen
      )
      VALUES (?, ?, ?, 1, NOW(), NOW())
      `,
      [null, null, phone],
    );

    await this.dataSource.query(
      `
      INSERT INTO user_roles (
        user_id,
        role_id
      )
      VALUES (?, ?)
      `,
      [insertResult.insertId, 3],
    );

    user = {
      id: insertResult.insertId,
      name: null,
      email: null,
      phone,
    };
  } else {
    user = users[0];

    this.markUserOnline(user.id);
  }

  // ============================================================
  // SOCKET
  // ============================================================

  this.socketService.online(user.id);

  // ============================================================
  // ACCESS TOKEN
  // ============================================================

  const jwtToken = this.jwtService.sign({
    id: user.id,
  });

  // ============================================================
  // REFRESH TOKEN
  // ============================================================

  const refreshToken = this.generateRefreshToken(user.id);

  // ============================================================
  // SESSION
  // ============================================================

  const sessionId = this.newSessionId();

  void this.recordSessionInBackground(
    user,
    req,
    refreshToken,
    sessionId,
  );

  return {
    message: 'OTP verified',
    token: jwtToken,
    refreshToken,
    sessionId,
    user,
  };
}

  // ============================================================
  // REFRESH TOKEN
  // ============================================================

  async refreshToken(
    dto: {
      refreshToken: string;
      sessionId: string;
    },
  ) {
    if (
      !dto?.refreshToken ||
      !dto?.sessionId
    ) {
      throw new BadRequestException(
        'refreshToken and sessionId are required',
      );
    }

    let payload: any;

    try {
      payload =
        this.jwtService.verify(
          dto.refreshToken,
          {
            secret:
              REFRESH_TOKEN_SECRET,
          },
        );

      if (
        payload.type !==
        'refresh'
      ) {
        throw new Error(
          'Invalid token type',
        );
      }
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
      );
    }

    const sessions =
      await this.dataSource.query(
        `
        SELECT *
        FROM user_sessions
        WHERE session_id = ?
          AND user_id = ?
          AND is_active = 1
        LIMIT 1
        `,
        [
          dto.sessionId,
          payload.id,
        ],
      );

    const session =
      sessions[0];

    if (!session) {
      throw new UnauthorizedException(
        'Session not found or revoked',
      );
    }

    // ============================================================
    // EXPIRY
    // ============================================================

    if (
      new Date(
        session.expires_at,
      ) < new Date()
    ) {
      await this.dataSource.query(
        `
        UPDATE user_sessions
        SET is_active = 0
        WHERE session_id = ?
        `,
        [dto.sessionId],
      );

      throw new UnauthorizedException(
        'Session expired, please login again',
      );
    }

    // ============================================================
    // TOKEN
    // ============================================================

    const isMatch =
      this.compareRefreshToken(
        dto.refreshToken,
        session.refresh_token_hash,
      );

    if (!isMatch) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    // ============================================================
    // ACCESS TOKEN
    // ============================================================

    const newAccessToken =
      this.jwtService.sign({
        id: payload.id,
      });

    // ============================================================
    // ACTIVITY
    // ============================================================

    await this.dataSource.query(
      `
      UPDATE user_sessions
      SET last_activity = NOW()
      WHERE session_id = ?
      `,
      [dto.sessionId],
    );

    return {
      token:
        newAccessToken,
    };
  }

  // ============================================================
  // GET USER SESSIONS
  // ============================================================

  async getUserSessions(
    userId: number,
  ) {
    return this.dataSource.query(
      `
      SELECT
        session_id,

        device_type,
        device_name,

        browser,
        browser_version,

        os,
        os_version,

        ip_address,

        country,
        state,
        city,

        user_agent,

        is_current,
        is_active,

        login_at,
        last_activity,
        expires_at,
        logout_at

      FROM user_sessions

      WHERE user_id = ?
        AND is_active = 1

      ORDER BY
        last_activity DESC
      `,
      [userId],
    );
  }

  // ============================================================
  // REVOKE SESSION
  // ============================================================

  async revokeSession(
    userId: number,
    sessionId: string,
  ) {
    await this.dataSource.query(
      `
      UPDATE user_sessions
      SET
        is_active = 0,
        is_current = 0,
        logout_at = NOW()
      WHERE session_id = ?
        AND user_id = ?
      `,
      [
        sessionId,
        userId,
      ],
    );

    await this.recordLoginHistory(
      userId,
      sessionId,
      'logout',
    );

    return {
      success: true,
      message:
        'Session revoked',
    };
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async logout(
    userId: number,
    sessionId?: string,
  ) {
    console.log(
      'Logout:',
      {
        userId,
        sessionId,
      },
    );

    // ============================================================
    // USER OFFLINE
    // ============================================================

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

    // ============================================================
    // CLOSE SESSION
    // ============================================================

    if (sessionId) {
      await this.dataSource.query(
        `
        UPDATE user_sessions
        SET
          is_active = 0,
          is_current = 0,
          logout_at = NOW()
        WHERE session_id = ?
          AND user_id = ?
        `,
        [
          sessionId,
          userId,
        ],
      );
    } else {
      await this.dataSource.query(
        `
        UPDATE user_sessions
        SET
          is_active = 0,
          is_current = 0,
          logout_at = NOW()
        WHERE user_id = ?
          AND is_active = 1
        `,
        [userId],
      );
    }

    // ============================================================
    // HISTORY
    // ============================================================

    await this.recordLoginHistory(
      userId,
      sessionId || null,
      'logout',
    );

    return {
      message:
        'Logged out',
    };
  }
}

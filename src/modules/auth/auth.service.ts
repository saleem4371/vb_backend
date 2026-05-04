import { Injectable, UnauthorizedException ,BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import axios from "axios";

import { MailService } from '../../mail/mail.service';
import { ActivityLoggerService } from '../../common/activity-logger.service';
import { emailVerifyTemplate } from '../../common/email/templates/email-verify.template';




@Injectable()
export class AuthService {
  constructor(
    private dataSource: DataSource,
    private readonly jwtService: JwtService,
     private mailService: MailService,
     private activityLogger: ActivityLoggerService
  ) {}

  // ✅ REGISTER
  async register(dto) {
  if (!dto?.email || !dto?.password) {
    throw new BadRequestException('Username, email and password are required');
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
    `INSERT INTO users (name, email, password, role_type)
     VALUES (?, ?, ?, ?)`,
    [dto.name, dto.email, hashedPassword, 3],
  );



  return {
    success: true,
    userId: result.insertId,
  };
}

  // ✅ LOGIN
  async login(dto) {
    const users = await this.dataSource.query(
      `SELECT * FROM users WHERE email = ?`,
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

    const token = this.jwtService.sign({
      id: user.id,
      name: user.name,
      email: user.email,
    });

    return {
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }


  
async forgot_password(dto) {
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
const verifyLink = "bcd.com";
  const html = emailVerifyTemplate(dto.email, verifyLink);

   await this.mailService.sendMail(dto.email, 'Reset Your password', html);

    return {
      success: true,
      message: 'Password link send to mail',
    };

}

async update_password(dto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

  await this.dataSource.query(
    `UPDATE users SET password = ? WHERE email = ? `,
    [hashedPassword, dto.email],
  );

  const result = await this.dataSource.query(
    `SELECT * from users WHERE email = ? `,
    [dto.email],
  );

  return {
    success: true,
    user: result[0],
  };
    
}
async auto_login(dto) {
  const users = await this.dataSource.query(
    `SELECT * FROM users WHERE id = ?`,
    [dto.id],
  );

  const user = users[0];

  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  const token = this.jwtService.sign({
     id: user.id,
      name: user.name,
      email: user.email
    
  });

  return {
    access_token: token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}

  
async googleLogin(token: string) {
  // 1. Get user from Google
  const googleRes = await axios.get(
    `https://www.googleapis.com/oauth2/v3/userinfo`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const googleUser = googleRes.data;

  // 2. Check user exists
  const existingUser = await this.dataSource.query(
    `SELECT * FROM users WHERE email = ? LIMIT 1`,
    [googleUser.email],
  );

  let user;

  if (existingUser.length === 0) {
    // 3. Insert user if not exists
    await this.dataSource.query(
      `INSERT INTO users (name, email, logo, role_type)
       VALUES (?, ?, ?, ?)`,
      [googleUser.name, googleUser.email, googleUser.picture, 3],
    );

    // 4. Re-fetch inserted user
    const newUser = await this.dataSource.query(
      `SELECT * FROM users WHERE email = ? LIMIT 1`,
      [googleUser.email],
    );

    user = newUser[0];
  } else {
    user = existingUser[0];
  }

  // 5. Create JWT using DB user id
  const jwtToken = this.jwtService.sign({
     id: user.id,
      name: user.name,
      email: user.email
  });

  return {
    token: jwtToken,
    user,
  };
}
async findById(id: string) {
  const newUser = await this.dataSource.query(
      `SELECT * FROM users WHERE id = ? `,
      [id],
    );

    return newUser[0];
}

  async send_otp(identifier: string, otp: string) {
  const hash = await bcrypt.hash(otp, 10);

    //`user_id`, `otp`, `expires_at`, `attempts`, `created_at` FROM `user_otps` 
    const expire = new Date(Date.now() + 5 * 60 * 1000);
    const now = new Date();
 const result = await this.dataSource.query(
    `INSERT INTO user_otps (identifier, otp, expires_at, attempts,created_at)
     VALUES (?, ?, ?, ? , ? )`,
    [identifier, hash, expire, 0 , now ],
  );
}

async verifyOtp(identifier: string, otp: string) {
  const records = await this.dataSource.query(
    `SELECT * FROM user_otps WHERE identifier = ? ORDER BY id DESC LIMIT 1`,
    [identifier],
  );

  if (!records || records.length === 0) {
    throw new Error('OTP not found');
  }

  const record = records[0];

  // 🔴 DEBUG (important)
  console.log('OTP INPUT:', otp);
  console.log('DB RECORD:', record);

  // ✅ Validate inputs before bcrypt
  if (!otp) {
    throw new Error('OTP is required');
  }

  if (!record.otp_hash) {
    throw new Error('Stored OTP hash missing');
  }

  // ✅ Expiry check
  if (new Date(record.expires_at) < new Date()) {
    throw new Error('OTP expired');
  }

  // ✅ Attempt check
  if (record.attempts >= 5) {
    throw new Error('Too many attempts');
  }

  // ✅ Compare
  const isValid = await bcrypt.compare(String(otp), String(record.otp_hash));

  if (!isValid) {
    await this.dataSource.query(
      `UPDATE user_otps SET attempts = attempts + 1 WHERE id = ?`,
      [record.id],
    );

    throw new Error('Invalid OTP');
  }

  // ✅ Delete used OTP
  await this.dataSource.query(
    `DELETE FROM user_otps WHERE id = ?`,
    [record.id],
  );

  return {
    message: 'OTP verified',
    token: this.jwtService.sign({ identifier }),
  };
}

}

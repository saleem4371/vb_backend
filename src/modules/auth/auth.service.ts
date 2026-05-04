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

  
async googleLogin(token: string) {
  const googleRes = await axios.get(
    `https://www.googleapis.com/oauth2/v3/userinfo`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const user = googleRes.data;

 
  const existingUser = await this.dataSource.query(
    `SELECT * FROM users WHERE email = ?`,
    [ user.email],
  );

  if (!existingUser) {


    await this.dataSource.query(
    `INSERT INTO users (name, email, logo , role_type)
     VALUES (?, ?, ?, ?)`,
    [user.name, user.email,user.picture, 3],
  );
  }

  return {
    token: this.jwt.sign({ email: user.email }),
    user,
  };
}

}

import {
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../../user/services/user.service';
import * as crypto from 'crypto';
import { UserDTO } from 'src/modules/user/models/user.dto';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from 'src/modules/user/services/admin.service';
import { AdminDto } from 'src/modules/user/models/admin/admin.dto';
import { PayloadToken } from '../models/payload-token';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from 'src/modules/common';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private admin: AdminService,
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.getUserByEmail(email);
    if (!user) {
      throw Error('No email match');
    }

    const hashedInputPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
    const isPasswordValid = hashedInputPassword === user.password;
    if (!isPasswordValid) {
      throw Error('Wrong password');
    }

    const verification = await this.prismaService.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    const isBanned = await this.isUserBanned({
      id: user.id,
      email: user.email,
      role: 'user',
    });
    if (isBanned) {
      throw new HttpException('User is banned', 403);
    }

    return {
      ...user,
      isVerified: verification?.isVerified ?? false,
    } as UserDTO;
  }

  async validateAdmin(email: string, password: string): Promise<any> {
    const admin = await this.admin.getAdminByEmail(email);
    if (!admin) {
      throw Error('No email match');
    }
    const hashedInputPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
    const isPasswordValid = hashedInputPassword === admin.password;
    if (!isPasswordValid) {
      throw Error('Wrong password');
    }
    return admin;
  }

  loginUser(user: UserDTO) {
    return {
      token: this.jwtService.sign({
        payload: {
          id: user.id,
          email: user.email,
          role: 'user',
        },
      }),
      user,
    };
  }

  loginAdmin(admin: AdminDto) {
    return {
      token: this.jwtService.sign({
        payload: {
          id: admin.id,
          email: admin.email,
          role: 'admin',
        },
      }),
      user: admin,
    };
  }

  async validateJwtAdmin(payload: PayloadToken) {
    if (!payload) {
      throw new HttpException('Invalid token', 401);
    }
    if (payload.role !== 'admin') {
      throw new HttpException('Unauthorized', 401);
    }
    const admin = await this.admin.getAdminById(payload.id);
    if (!admin) {
      throw new HttpException('Wrong token', 401);
    }
    if (admin.email !== payload.email) {
      throw new HttpException('Wrong token', 401);
    }
    return true;
  }

  async isUserBanned(payload: PayloadToken) {
    const user = await this.prismaService.users.findUnique({
      where: { email: payload.email },
    });
    if (!user) {
      throw new HttpException('Wrong token', 401);
    }
    if (user.email !== payload.email) {
      throw new HttpException('Wrong token', 401);
    }
    return user?.isBanned ?? false;
  }

  async validateJwtUser(payload: PayloadToken) {
    if (!payload) {
      throw new HttpException('Invalid token', 401);
    }
    if (payload.role !== 'user') {
      throw new HttpException('Unauthorized', 401);
    }
    const user = await this.usersService.getUserById(payload.id);
    if (!user) {
      throw new HttpException('Wrong token', 401);
    }
    if (user.email !== payload.email) {
      throw new HttpException('Wrong token', 401);
    }

    const verification = await this.prismaService.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...user,
      isVerified: verification?.isVerified ?? false,
    } as UserDTO;
  }

  async validateGoogleToken(token: string) {
    try {
      const client = new OAuth2Client();
      const ticket = await client.verifyIdToken({
        idToken: token,
        // You might want to add your Google Client ID here for additional security
        // audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google ID token');
      }

      const { email, given_name, family_name, picture } = payload;

      return {
        email: email || '',
        firstName: given_name || '',
        lastName: family_name || '',
        picture: picture || '',
        dob: '', // Note: Google ID tokens don't typically include date of birth
      };
    } catch (error) {
      console.error('Google OAuth token validation failed:', error);
      throw new UnauthorizedException('Invalid Google ID token');
    }
  }
}

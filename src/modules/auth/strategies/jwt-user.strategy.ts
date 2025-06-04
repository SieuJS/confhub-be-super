import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { HttpException, Injectable } from '@nestjs/common';
import { PayloadToken } from '../models/payload-token';
import { AuthService } from '../services/auth.service';
import { Request } from 'express';

type ExtractJwtType = {
  fromAuthHeaderAsBearerToken: () => (req: Request) => string | null;
};

@Injectable()
export class JwtUserStrategy extends PassportStrategy(Strategy, 'jwt-user') {
  constructor(private authService: AuthService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      jwtFromRequest: (
        ExtractJwt as ExtractJwtType
      ).fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(extractedToken: {
    payload: PayloadToken;
    iat: number;
    exp: number;
  }): Promise<PayloadToken> {
    const { payload } = extractedToken;
    try {
      await this.authService.validateJwtUser(payload);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new HttpException(error.message, 403);
      }
      throw new HttpException('Authentication failed', 403);
    }
    const isBanned = await this.authService.isUserBanned(payload);
    if (isBanned) {
      throw new HttpException('User is banned', 403);
    }

    return payload;
  }
}

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
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
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
      const isValid = await this.authService.validateJwtAdmin(payload);
      if (!isValid) {
        throw new HttpException('Invalid admin token', 403);
      }
      return payload;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new HttpException(error.message, 403);
      }
      throw new HttpException('Authentication failed', 403);
    }
  }
}

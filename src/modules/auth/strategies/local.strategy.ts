import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { Request } from 'express';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, email: string, password: string): Promise<any> {
    const mode = req.body.mode;
    let user;
    try {
      if (mode === 'admin') {
        user = await this.authService.validateAdmin(email, password);
      } else if (mode === 'user') {
        user = await this.authService.validateUser(email, password);
      } else {
        throw new UnauthorizedException('Invalid mode');
      }
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    } else {
      return user;
    }
  }
}

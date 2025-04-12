
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { HttpException, Injectable } from '@nestjs/common';
import { PayloadToken } from '../models/payload-token';
import { AuthService } from '../services/auth.service';
@Injectable()
export class JwtUserStrategy extends PassportStrategy(Strategy, 'jwt-user') {
  constructor(private authService : AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(extractedToken : {payload : PayloadToken , iat : number , exp : number}) : Promise<PayloadToken> {
    const {payload} = extractedToken; 
    try{
        const isValid = await this.authService.validateJwtUser(payload);
    }
    catch (error) {
        throw new HttpException(error.message, 403);
    }
    
    return payload;
  }
}

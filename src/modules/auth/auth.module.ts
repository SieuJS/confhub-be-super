import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './services/auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { LocalAuthGuard } from './guards/local.guard';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller';
import { JwtAdminStrategy } from './strategies/jwt-admin.strategy';
import { JwtUserStrategy } from './strategies/jwt-user.strategy';
import { NotifyModule } from '../notify/notify.module';
import { EmailVerifyModule } from '../email-verify/email-verify.module';
import { GoogleStrategy } from './strategies/google.strategy';
import { CommonModule } from '../common';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    CommonModule,
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '6h',
      },
    }),
    NotifyModule,
    EmailVerifyModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    LocalAuthGuard,
    JwtAdminStrategy,
    JwtUserStrategy,
    GoogleStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}

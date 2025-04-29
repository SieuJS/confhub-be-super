import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LocalAuthGuard } from '../guards/local.guard';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiTags } from '@nestjs/swagger';
import { LoginInput } from '../models/login.input';
import { JWTGuardAdmin, JWTGuardUser } from '../guards/jwt.guard';
import { UserInput } from 'src/modules/user/models/user.input';
import { SignUpPipe } from 'src/modules/user/pipes/signup.pipe';
import { Transactional } from '@nestjs-cls/transactional';
import { UserService } from 'src/modules/user/services/user.service';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import * as crypto from 'crypto';
import { UserVerifyService } from 'src/modules/email-verify/services/user-verify.service';
import { EmailService } from 'src/modules/email-verify/services/email.service';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { VerifyCodeBody } from 'src/modules/user/models/verify-code-body';
import { JwtService } from '@nestjs/jwt';
import { GoogleOAuthGuard } from '../guards/google-auth.guard';
@ApiTags('auth')
@Controller('/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly userVerifyService: UserVerifyService,
    private readonly emailService: EmailService,
    private readonly jwtService : JwtService
  ) {}

  @Post('/login')
  @ApiBody({
    type: LoginInput,
  })
  @UseGuards(LocalAuthGuard)
  async login(@Req() req) {
    const user = req.user;
    return await this.authService.loginUser(user);
  }

  @Post('/logout')
  async logout() {
    return {
      message: 'Logout successful',
    };
  }

  @Post('/admin/login')
  @ApiBody({
    type: LoginInput,
  })
  @UseGuards(LocalAuthGuard)
  async loginAdmin(@Req() req) {
    const admin = req.user;
    return await this.authService.loginAdmin(admin);
  }

  @Post('/admin/logout')
  async logoutAdmin() {
    return {
      message: 'Logout successful',
    };
  }

  @Get('/admin/me')
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer token',
  })
  @UseGuards(JWTGuardAdmin)
  async getMe(@Req() req) {
    const user = req.user;
    return user;
  }

  @Get('/me')
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer token',
  })
  @UseGuards(JWTGuardUser)
  async getMeUser(@Req() req) {
    const user = req.user;
    return user;
  }

  @Post('/signup')
  @ApiBody({
    type: UserInput,
  })
  @UsePipes(new SignUpPipe())
  @Transactional()
  async signup(@Body() input: UserInput) {
    const user = await this.userService.getUserByEmail(input.email);
    if (user) {
      throw new HttpException('User already exists', 400);
    }
    const hashedPassword = crypto
      .createHash('sha256')
      .update(input.password)
      .digest('hex');
    const newUser = await this.userService.createUser({
      ...input,
      password: hashedPassword,
    });

    await this.notificationService.setDefaultNotificationSettingForUser(
      newUser.id,
    );

    const verifyCode = await this.userVerifyService.createVerifyCode(
      newUser.id,
    );
    await this.emailService.sendEmailVerification(
      newUser.email,
      verifyCode.verificationCode,
      newUser.firstName,
    );

    const loginPayLoad = this.authService.loginUser(newUser);

    return {
      message: 'User created',
      verifyCode: verifyCode.verificationCode,
       ...loginPayLoad
    };
  }
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @Get('re-send-verify')
  async resendVerify(@Req() req) {
    const userId = req.user.id;
    const verificationCode =
      await this.userVerifyService.createVerifyCode(userId);
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    await this.emailService.sendEmailVerification(
      user.email,
      verificationCode.verificationCode,
      user.firstName,
    );
    return {
      code: verificationCode.verificationCode,
    };
  }

  @UseGuards(JWTGuardUser)
  @Post('/verify')
  @ApiBearerAuth('access-token')
  @ApiBody({
    type: VerifyCodeBody,
  })
  @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
  async verify(@Body() body: { code: string }, @Req() req) {
    const userId = req.user.id;
    const code = body.code;
    try {
      const verifyCode = await this.userVerifyService.verifyCode(userId, code);
      const t = await this.userVerifyService.verifyUser(verifyCode.id);

      await this.userVerifyService.disableVerifyCode(verifyCode.id);
      return {
        message: 'User verified',
      };
    } catch (error) {
      throw new HttpException('Invalid verification code', 400);
    }
  }

  @Get('/google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(@Req() req) {}

  @Get('google-redirect')
  @UseGuards(GoogleOAuthGuard)
  async googleAuthRedirect(@Req() req) {
    if (!req.user) {
      return 'No user from google';
    }
    const user = req.user;
    let existUser = await this.userService.getUserByEmail(user.email);
    if (!existUser) {
      existUser = this.userService.createUser({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        password: `${user.email}google`,
        avatar: user.picture,
        dob: user.dob || null,
        aboutMe: '',
        background: '',
      })
    }

    const loginPayload = this.authService.loginUser(user);

    return {
      message: 'User information from google',
      ...loginPayload
    };
  }
}

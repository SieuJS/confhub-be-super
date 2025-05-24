import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LocalAuthGuard } from '../guards/local.guard';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiTags } from '@nestjs/swagger';
import { LoginInput } from '../models/login.input';
import { JWTGuardAdmin, JWTGuardUser } from '../guards/jwt.guard';
import { UserInput } from 'src/modules/user/models/user.input';
import { Transactional } from '@nestjs-cls/transactional';
import { UserService } from 'src/modules/user/services/user.service';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import * as crypto from 'crypto';
import { UserVerifyService } from 'src/modules/email-verify/services/user-verify.service';
import { EmailService } from 'src/modules/email-verify/services/email.service';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { VerifyCodeBody } from 'src/modules/user/models/verify-code-body';
import { Request, Response } from 'express';
import { PayloadToken } from '../models/payload-token';
import { UserDTO } from 'src/modules/user/models/user.dto';
import { AdminService } from 'src/modules/user/services/admin.service';
import { AdminDto } from 'src/modules/user/models/admin/admin.dto';
import { GoogleOAuthGuard } from '../guards/google-auth.guard';
import { UserPropertyTransformPipe } from 'src/modules/user/pipes/user-property-transform.pipe';

interface GoogleUser {
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  dob?: string;
}

interface RequestWithUser extends Request {
  user: PayloadToken;
}

@ApiTags('auth')
@Controller('/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly adminService: AdminService,
    private readonly notificationService: NotificationService,
    private readonly userVerifyService: UserVerifyService,
    private readonly emailService: EmailService,
  ) {}

  @Post('/login')
  @ApiBody({
    type: LoginInput,
  })
  @UseGuards(LocalAuthGuard)
  async login(@Req() req: RequestWithUser) {
    const user = (await this.userService.getUserById(req.user.id)) as UserDTO;
    if (!user) {
      throw new HttpException('User not found', 404);
    }

    return this.authService.loginUser(user);
  }

  @Post('/logout')
  logout() {
    return {
      message: 'Logout successful',
    };
  }

  @Post('/admin/login')
  @ApiBody({
    type: LoginInput,
  })
  @UseGuards(LocalAuthGuard)
  async loginAdmin(@Req() req: RequestWithUser) {
    const admin = await this.adminService.getAdminById(req.user.id);
    if (!admin) {
      throw new HttpException('Admin not found', 404);
    }
    return this.authService.loginAdmin(admin as AdminDto);
  }

  @Post('/admin/logout')
  logoutAdmin() {
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
  getMe(@Req() req: RequestWithUser) {
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
  async getMeUser(@Req() req: RequestWithUser) {
    const user = (await this.userService.getUserById(req.user.id)) as UserDTO;
    const verificationStatus = await (
      this.userVerifyService.getUserVerificationStatus as (
        id: string,
      ) => Promise<{ isVerified: boolean } | null>
    )(user.id);
    return {
      ...user,
      isVerified: verificationStatus?.isVerified ?? false,
    };
  }

  @Post('/signup')
  @ApiBody({
    type: UserInput,
  })
  @UsePipes(UserPropertyTransformPipe)
  @Transactional()
  async signup(@Body(UserPropertyTransformPipe) input: UserInput) {
    const user = (await this.userService.getUserByEmail(
      input.email,
    )) as UserDTO | null;
    if (user) {
      throw new HttpException('User already exists', 400);
    }
    const hashedPassword = crypto
      .createHash('sha256')
      .update(input.password)
      .digest('hex');
    const newUser = (await this.userService.createUser({
      ...input,
      password: hashedPassword,
    })) as UserDTO;

    await this.notificationService.setDefaultNotificationSettingForUser(
      newUser.id,
    );

    const verifyCode = await this.userVerifyService.createVerifyCode(
      newUser.id,
    );
    await this.emailService.sendEmailVerification(
      newUser.email,
      newUser.firstName,
      verifyCode.verificationCode,
    );

    const loginPayLoad = this.authService.loginUser(newUser);

    return {
      message: 'User created',
      verifyCode: verifyCode.verificationCode,
      ...loginPayLoad,
    };
  }
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @Get('re-send-verify')
  async resendVerify(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    const verificationCode =
      await this.userVerifyService.createVerifyCode(userId);
    const user = (await this.userService.getUserById(userId)) as UserDTO;
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
  async verify(@Body() body: { code: string }, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    const code = body.code;
    try {
      const verifyCode = (await this.userVerifyService.verifyCode(
        userId,
        code,
      )) as { id: string };
      await this.userVerifyService.verifyUser(verifyCode.id);
      await this.userVerifyService.disableVerifyCode(verifyCode.id);
      return {
        message: 'User verified',
      };
    } catch {
      throw new HttpException('Invalid verification code', 400);
    }
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleLoginRedirect() {
    // The redirectUrl is saved by the middleware
    // The GoogleOAuthGuard will handle the redirection
    return { message: 'Redirecting to Google login...' };
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleLoginCallback(
    @Req() req: Request & { user: GoogleUser },
    @Res() res: Response,
  ) {
    // Check if the request contains error parameters (user cancelled or denied access)
    const redirectUrl = req.session?.redirectUrl || '/en/dashboard';

    if (req.query.error) {
      return res.redirect(`${redirectUrl}?error=true`);
    }

    const user = req.user;
    if (!user) {
      return res.redirect(`${redirectUrl}?error=true`);
    }
    let existUser = (await this.userService.getUserByEmail(
      user.email,
    )) as UserDTO | null;
    if (!existUser) {
      existUser = (await this.userService.createUser({
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName,
        password: `${user.email}google`,
        avatar: user.picture || null,
        dob: user.dob ? new Date(user.dob) : new Date('2000-01-01'),
        aboutMe: '',
        background: '',
      })) as UserDTO;
    }
    const verificationStatus = await (
      this.userVerifyService.getUserVerificationStatus as (
        id: string,
      ) => Promise<{ isVerified: boolean } | null>
    )(existUser.id);
    if (!verificationStatus?.isVerified) {
      const verifyCode = await this.userVerifyService.createVerifyCode(
        existUser.id,
      );
      await this.userVerifyService.verifyUser(verifyCode.id);
    }

    const loginPayload = this.authService.loginUser(existUser);

    // Clear the session redirectUrl after use
    if (req.session) {
      delete req.session.redirectUrl;
    }

    return res.redirect(`${redirectUrl}?token=${loginPayload.token}`);
  }

  @Post('google')
  async googleLogin(@Body('access_token') token: string) {
    const user = (await this.authService.validateGoogleToken(
      token,
    )) as GoogleUser;
    if (!user || !user.email) {
      throw new HttpException('Invalid token', 401);
    }
    let existUser = (await this.userService.getUserByEmail(
      user.email,
    )) as UserDTO | null;
    if (!existUser) {
      existUser = (await this.userService.createUser({
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName,
        password: `${user.email}google`,
        avatar: user.picture || null,
        dob: user.dob ? new Date(user.dob) : new Date('2000-01-01'),
        aboutMe: '',
        background: '',
      })) as UserDTO;
    }
    const verificationStatus = await (
      this.userVerifyService.getUserVerificationStatus as (
        id: string,
      ) => Promise<{ isVerified: boolean } | null>
    )(existUser.id);
    if (!verificationStatus?.isVerified) {
      const verifyCode = await this.userVerifyService.createVerifyCode(
        existUser.id,
      );
      await this.userVerifyService.verifyUser(verifyCode.id);
    }

    const loginPayload = this.authService.loginUser(existUser);
    return {
      message: 'Login successful',
      ...loginPayload,
    };
  }

  @Post('/forgot-password')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
      },
    },
  })
  async forgotPassword(@Body('email') email: string) {
    const user = (await this.userService.getUserByEmail(email)) as UserDTO;
    if (!user) {
      // Don't reveal that the user doesn't exist for security
      return {
        message:
          'If your email is registered, you will receive a password reset code.',
      };
    }
    const verificationStatus = await (
      this.userVerifyService.getUserVerificationStatus as (
        id: string,
      ) => Promise<{ isVerified: boolean } | null>
    )(user.id);
    if (!verificationStatus?.isVerified) {
      throw new HttpException(
        'Please verify your email before logging in',
        403,
      );
    }

    const verifyCode = await this.userVerifyService.createVerifyCode(user.id);
    await (
      this.emailService.sendPasswordResetEmail as (
        email: string,
        code: string,
        name: string,
      ) => Promise<void>
    )(user.email, verifyCode.verificationCode, user.firstName);

    return {
      message:
        'If your email is registered, you will receive a password reset code.',
    };
  }

  @Post('/reset-password')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        code: { type: 'string' },
        newPassword: { type: 'string', minLength: 6 },
      },
    },
  })
  async resetPassword(
    @Body('email') email: string,
    @Body('code') code: string,
    @Body('newPassword') newPassword: string,
  ) {
    const user = (await this.userService.getUserByEmail(email)) as UserDTO;
    if (!user) {
      throw new HttpException('Invalid request', 400);
    }

    try {
      const verifyCode = (await this.userVerifyService.verifyCode(
        user.id,
        code,
      )) as { id: string };
      const hashedPassword = crypto
        .createHash('sha256')
        .update(newPassword)
        .digest('hex');

      await this.userService.updateUser(user.id, { password: hashedPassword });
      await this.userVerifyService.disableVerifyCode(verifyCode.id);

      return { message: 'Password has been reset successfully' };
    } catch (error) {
      console.log(error);
      throw new HttpException('Invalid or expired verification code', 400);
    }
  }

  @Post('change-password')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        oldPassword: { type: 'string' },
        newPassword: { type: 'string', minLength: 6 },
      },
    },
  })
  async changePassword(
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string,
    @Req() req: RequestWithUser,
  ) {
    const user = (await this.userService.getUserById(req.user.id)) as UserDTO;
    if (!user) {
      throw new HttpException('User not found', 404);
    }

    const hashedOldPassword = crypto
      .createHash('sha256')
      .update(oldPassword)
      .digest('hex');

    if (hashedOldPassword !== user.password) {
      throw new HttpException('Current password is incorrect', 400);
    }

    const hashedNewPassword = crypto
      .createHash('sha256')
      .update(newPassword)
      .digest('hex');

    await this.userService.updateUser(user.id, { password: hashedNewPassword });

    return { message: 'Password changed successfully' };
  }
}

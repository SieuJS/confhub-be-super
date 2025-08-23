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
import { PrismaService } from 'src/modules/common';
import { PasswordService } from '../services/password.service';
import { PasswordValidationPipe } from '../pipes/password-validation.pipe';
import { CacheManagementService } from '../services/cache-management.service';

interface GoogleUser {
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  dob?: string;
  oauthState?: string;
  customOauthState?: string;
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
    private readonly prismaService: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly cacheManagementService: CacheManagementService,
  ) {}

  private async getUserWithVerification(userId: string): Promise<UserDTO> {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new HttpException('User not found', 404);
    }

    const verification = await this.prismaService.userVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...user,
      isVerified: verification?.isVerified ?? false,
    } as unknown as UserDTO;
  }

  @Post('/login')
  @ApiBody({
    type: LoginInput,
  })
  @UseGuards(LocalAuthGuard)
  async login(@Req() req: RequestWithUser) {
    const user = await this.getUserWithVerification(req.user.id);

    // Invalidate user-specific cache on login
    try {
      await this.cacheManagementService.invalidateUserCache(user.id);
    } catch (error) {
      console.error('Failed to invalidate user cache on login:', error);
    }

    return this.authService.loginUser(user);
  }

  @Post('/logout')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  async logout(@Req() req: RequestWithUser) {
    // Invalidate user-specific cache on logout
    try {
      await this.cacheManagementService.invalidateUserCache(req.user.id);
    } catch (error) {
      console.error('Failed to invalidate user cache on logout:', error);
    }

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

    // Invalidate admin-specific cache on login
    try {
      await this.cacheManagementService.invalidateUserCache(req.user.id);
    } catch (error) {
      console.error('Failed to invalidate admin cache on login:', error);
    }

    return this.authService.loginAdmin(admin as AdminDto);
  }

  @Post('/admin/logout')
  @UseGuards(JWTGuardAdmin)
  @ApiBearerAuth('access-token')
  async logoutAdmin(@Req() req: RequestWithUser) {
    // Invalidate admin-specific cache on logout
    try {
      await this.cacheManagementService.invalidateUserCache(req.user.id);
    } catch (error) {
      console.error('Failed to invalidate admin cache on logout:', error);
    }

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
    return this.getUserWithVerification(req.user.id);
  }

  @Post('/signup')
  @ApiBody({
    type: UserInput,
  })
  @UsePipes(UserPropertyTransformPipe)
  @Transactional<TransactionalAdapterPrisma>({
    timeout: 30000,
    isolationLevel: 'read committed',
  })
  async signup(@Body(UserPropertyTransformPipe) input: UserInput) {
    const user = (await this.userService.getUserByEmail(
      input.email,
    )) as unknown as UserDTO | null;
    if (user) {
      throw new HttpException('User already exists', 400);
    }
    const hashedPassword = this.passwordService.hashPassword(input.password);
    const newUser = (await this.userService.createUser({
      ...input,
      password: hashedPassword,
    })) as unknown as UserDTO;

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

    const userWithVerification = await this.getUserWithVerification(newUser.id);
    const loginPayLoad = this.authService.loginUser(userWithVerification);

    // Invalidate cache after user signup and login
    try {
      await this.cacheManagementService.invalidateUserCache(newUser.id);
    } catch (error) {
      console.error('Failed to invalidate cache after signup:', error);
    }

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
    const user = await this.getUserWithVerification(userId);
    await this.emailService.sendEmailVerification(
      user.email,
      user.firstName,
      verificationCode.verificationCode,
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
    console.log('Google OAuth callback started');
    console.log('Request query:', req.query);
    console.log('User from OAuth:', req.user);

    // Check if the request contains error parameters (user cancelled or denied access)
    if (req.query.error) {
      console.log('OAuth error detected:', req.query.error);
      const defaultErrorUrl =
        process.env.REDIRECT_URL || "https://easyconf.ddns.net/apis/auth/google-callback?error=true";
      return res.redirect(defaultErrorUrl);
    }

    const user = req.user;
    if (!user) {
      console.log('No user found in OAuth callback');
      const defaultErrorUrl =
        process.env.REDIRECT_URL || "https://easyconf.ddns.net/apis/auth/google-callback?error=true";
      return res.redirect(defaultErrorUrl);
    }

    // Determine redirect URL with queue-based approach (simpler and more reliable)
    let redirectUrl = process.env.REDIRECT_URL || "https://easyconf.ddns.net/apis/auth/google-callback"; // Default fallback

    try {
      console.log('Attempting to get redirect URL from queue...');

      // Try queue-based approach first (FIFO - First In, First Out)
      const queueRedirectUrl =
        await this.cacheManagementService.getRedirectUrlFromQueue();

      if (queueRedirectUrl) {
        redirectUrl = queueRedirectUrl;
        console.log('Retrieved redirect URL from queue:', redirectUrl);
      } else {
        console.log('No redirect URL found in queue, trying fallback methods');

        // Fallback to the multi-strategy approach if queue is empty
        const fallbackUrl =
          await this.cacheManagementService.getOAuthRedirectUrlWithFallback(
            req.query.state as string,
            req.user?.customOauthState,
            req.ip,
          );

        if (fallbackUrl) {
          redirectUrl = fallbackUrl;
          console.log('Retrieved redirect URL from fallback:', redirectUrl);
        } else {
          console.log('No redirect URL found, using default');
        }
      }
    } catch (error) {
      console.error('Error retrieving redirect URL from Redis:', error);
      // Continue with default URL
    }

    console.log('Final redirectUrl:', redirectUrl);

    // Process user login/registration
    let existUser = await this.userService.getUserByEmail(user.email);
    if (!existUser) {
      console.log('Creating new user from Google OAuth');
      existUser = await this.userService.createUser({
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName,
        password: `${user.email}google`,
        avatar: user.picture || null,
        dob: user.dob ? new Date(user.dob) : new Date('2000-01-01'),
        aboutMe: '',
        background: '',
      });
    } else {
      console.log('Found existing user:', existUser.email);
    }

    // Handle user verification
    const verificationStatus = await (
      this.userVerifyService.getUserVerificationStatus as (
        id: string,
      ) => Promise<{ isVerified: boolean } | null>
    )(existUser.id);

    if (!verificationStatus?.isVerified) {
      console.log('Verifying user automatically for Google OAuth');
      const verifyCode = await this.userVerifyService.createVerifyCode(
        existUser.id,
      );
      await this.userVerifyService.verifyUser(verifyCode.id);
    }

    const loginPayload = this.authService.loginUser(existUser);

    // Invalidate user cache for Google OAuth login
    try {
      await this.cacheManagementService.invalidateUserCache(existUser.id);
      console.log('Cache invalidated for user:', existUser.id);
    } catch (error) {
      console.error(
        'Failed to invalidate user cache on Google OAuth login:',
        error,
      );
    }

    // Redirect with token
    const finalRedirectUrl = `${redirectUrl}?token=${loginPayload.token}`;
    console.log('Redirecting to:', finalRedirectUrl);

    return res.redirect(finalRedirectUrl);
  }

  @Post('google')
  async googleLogin(@Body('access_token') token: string) {
    console.log('Google OAuth login started with token:', token);
    const user = (await this.authService.validateGoogleToken(
      token,
    )) as GoogleUser;
    if (!user || !user.email) {
      throw new HttpException('Invalid token', 401);
    }
    let existUser = await this.userService.getUserByEmail(user.email);
    if (!existUser) {
      existUser = await this.userService.createUser({
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName,
        password: `${user.email}google`,
        avatar: user.picture || null,
        dob: user.dob ? new Date(user.dob) : new Date('2000-01-01'),
        aboutMe: '',
        background: '',
      });
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

    // Invalidate user cache for Google OAuth login
    try {
      await this.cacheManagementService.invalidateUserCache(existUser.id);
    } catch (error) {
      console.error(
        'Failed to invalidate user cache on Google OAuth login:',
        error,
      );
    }

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
    const user = (await this.userService.getUserByEmail(
      email,
    )) as unknown as UserDTO;
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
    @Body('newPassword', PasswordValidationPipe) newPassword: string,
  ) {
    const user = (await this.userService.getUserByEmail(
      email,
    )) as unknown as UserDTO;
    if (!user) {
      throw new HttpException('Invalid request', 400);
    }

    try {
      const verifyCode = (await this.userVerifyService.verifyCode(
        user.id,
        code,
      )) as { id: string };
      const hashedPassword = this.passwordService.hashPassword(newPassword);

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
    @Body('newPassword', PasswordValidationPipe) newPassword: string,
    @Req() req: RequestWithUser,
  ) {
    const user = await this.getUserWithVerification(req.user.id);

    if (!this.passwordService.comparePasswords(oldPassword, user.password)) {
      throw new HttpException('Current password is incorrect', 400);
    }

    const hashedNewPassword = this.passwordService.hashPassword(newPassword);

    await this.userService.updateUser(user.id, {
      password: hashedNewPassword,
    });

    return { message: 'Password changed successfully' };
  }
}

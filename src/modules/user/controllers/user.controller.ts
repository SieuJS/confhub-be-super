import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { UserInput, UserSigninInput } from '../models/user.input';
import * as crypto from 'crypto';
import { LocalAuthGuard } from '../../auth/guards/local.guard';
import { AuthGuard } from '@nestjs/passport';
import { UserVerifyService } from 'src/modules/email-verify/services/user-verify.service';
import { EmailService } from 'src/modules/email-verify/services/email.service';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { Transactional } from '@nestjs-cls/transactional';
import { VerifyCodeBody } from '../models/verify-code-body';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { SignUpPipe } from '../pipes/signup.pipe';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from '../../notify/services/notification.service';

@ApiTags('user')
@Controller('/user')
export class UserController {
  constructor(
    private userService: UserService,
    private userVerifyService: UserVerifyService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private readonly notificationService: NotificationService,
  ) {}
  @Get()
  async getAllUsers() {
    return await this.userService.getAllUsers();
  }

  @UseGuards(AuthGuard('local'))
  @Post('/signin')
  @ApiBody({
    type: UserSigninInput,
  })
  async signin(@Req() req) {
    const user = req.user;
    const token = await this.userService.generateToken(user.id);
    // If password is valid, return user or token
    return {
      message: 'Login successful',
      user,
      token,
    };
  }

  @Post('/signup')
  @UsePipes(new ValidationPipe({ transform: true }))
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

    const token = await this.jwtService.signAsync({
      payload: {
        id: newUser.id,
        email: newUser.email,
        role: 'user',
      },
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

    return {
      message: 'User created',
      user: newUser,
      verifyCode: verifyCode.verificationCode,
      token,
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

  @UseGuards(LocalAuthGuard)
  @Post('/signout')
  async signout(@Req() req) {
    req.logout();
  }

  @UseGuards(JWTGuardUser)
  @Get('/me')
  @ApiBearerAuth('access-token')
  async me(@Req() req) {
    return req.user;
  }

  @UseGuards(JWTGuardUser)
  @Post('/follow-conference')
  @ApiBearerAuth('access-token')
  async followConference(@Body() body: { conferenceId: string }, @Req() req) {
    const userId = req.user.id;
    const conferenceId = body.conferenceId;
    const result = await this.userService.followConference(
      userId,
      conferenceId,
    );

    const notifiConference =
      await this.notificationService.createFollowConferenceNotification(
        userId,
        conferenceId,
      );
    await this.notificationService.sendNotificationToUser(
      notifiConference,
      userId,
    );
    const followedConference = await this.userService.getFollowedConferencesByUserId(
      userId);
    
    return followedConference
  }

  @UseGuards(JWTGuardUser)
  @Post('/unfollow-conference')
  @ApiBearerAuth('access-token')
  @ApiBody({})
  @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
  async unfollowConference(@Body() body: { conferenceId: string }, @Req() req) {
    const userId = req.user.id;
    const conferenceId = body.conferenceId;
    console.log('conferenceId', conferenceId);
    const result = await this.userService.unfollowConference(
      userId,
      conferenceId,
    );
    const notifiConference =
      await this.notificationService.createNotificationUnFollowConference(
        userId,
        conferenceId,
      );
    await this.notificationService.sendNotificationToUser(
      notifiConference,
      userId,
    );
    if (!result) {
      throw new HttpException('Conference not found', 404);
    }
    const followedConference =
      await this.userService.getFollowedConferencesByUserId(userId);
    if (!followedConference) {
      throw new HttpException('Conference not found', 404);
    }
    return followedConference;
  }

  @Get('/notificationSetting')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  async getNotificationSetting(@Req() req) {
    const userId = req.user.id;
    const notificationSetting =
      await this.notificationService.getNotificationSettingsByUserId(userId);
    return notificationSetting;
  }

  @Get('/follow-conferences') 
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  async getNotificationByUserId(@Req() req) {
    const userId = req.user.id;
    const conferences =
      await this.userService.getFollowedConferencesByUserId(userId);
    return conferences;
  }


}

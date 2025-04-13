import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { LocalAuthGuard } from '../../auth/guards/local.guard';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { NotificationService } from '../../notify/services/notification.service';

@ApiTags('user')
@Controller('/user')
export class UserController {
  constructor(
    private userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}
  @Get()
  async getAllUsers() {
    return await this.userService.getAllUsers();
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

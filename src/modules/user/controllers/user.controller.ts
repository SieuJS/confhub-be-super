import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LocalAuthGuard } from '../../auth/guards/local.guard';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { NotificationService } from '../../notify/services/notification.service';
import { UserVerifyService } from '../../email-verify/services/user-verify.service';

@ApiTags('user')
@Controller('/user')
export class UserController {
  constructor(
    private userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly userVerifyService: UserVerifyService,
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
    const userInfo = await this.userService.getUserByEmail(req.user.email);

    if (!userInfo) {
      return null;
    }

    const verificationStatus =
      await this.userVerifyService.getUserVerificationStatus(userInfo.id);
    return {
      id: userInfo.id,
      email: userInfo.email,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      dob: userInfo.dob,
      avatar: userInfo.avatar,
      aboutMe: userInfo.aboutMe,
      background: userInfo.background,
      isVerified: verificationStatus?.isVerified || false,
    };
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
}

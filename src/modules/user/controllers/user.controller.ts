import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocalAuthGuard } from '../../auth/guards/local.guard';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { NotificationService } from '../../notify/services/notification.service';
import { UserVerifyService } from '../../email-verify/services/user-verify.service';
import { UpdateUserDto } from '../models/update-user.dto';
import { Request } from 'express';
import { UserPropertyTransformPipe } from '../pipes/user-property-transform.pipe';

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
  async signout(@Req() req: Request) {
    if (req.logout) {
      await new Promise<void>((resolve) => req.logout!(() => resolve()));
    }
  }

  @UseGuards(JWTGuardUser)
  @Get('/me')
  @ApiBearerAuth('access-token')
  async me(@Req() req: Request) {
    const user = req.user as { email: string };
    const userInfo = await this.userService.getUserByEmail(user.email);

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
  async getNotificationSetting(@Req() req: Request) {
    const user = req.user as { id: string };
    const userId = user.id;
    const notificationSetting =
      await this.notificationService.getNotificationSettingsByUserId(userId);
    return notificationSetting;
  }

  @Patch('/update')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update user profile information' })
  async updateUser(
    @Req() req: Request,
    @Body(UserPropertyTransformPipe) updateUserDto: UpdateUserDto
  ) {
    const user = req.user as { id: string };
    const userId = user.id;
    const updatedUser = await this.userService.updateUser(
      userId,
      updateUserDto,
    );
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      dob: updatedUser.dob,
      avatar: updatedUser.avatar,
      aboutMe: updatedUser.aboutMe,
      background: updatedUser.background,
    };
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  HttpException,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NotificationService } from '../services/notification.service';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { Req } from '@nestjs/common';
import { NotificationResponseDTO } from '../models/notification-reponse.dto';
import { NotificationSettingResponseDTO } from '../models/notification-setting-response.dto';
import { DEFAULT_TYPE } from '../constants/default-type';
import { Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';

@Controller('/notification')
@ApiTags('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {
    this.notificationService.initNotification();
  }

  @Get('/user')
  @UseGuards(JWTGuardUser)
  @ApiQuery({
    name: 'take',
    type: Number,
    required: false,
  })
  @ApiBearerAuth('access-token')
  async getNotificationByUserId(@Req() req, @Query() take: number = 21) {
    const userId = req.user.id;
    const { conferenceNotifications } =
      await this.notificationService.getNotificationByUserId(userId, take);
    return conferenceNotifications;
  }

  @Put('mark-all-as-read')
  @UseGuards(JWTGuardUser)
  async markAllAsRead(@Req() req) {
    const userId = req.user.id;
    await this.notificationService.markAllAsRead(userId);
    return {
      message: 'Mark all as read successfully',
    };
  }

  @Put('/user')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  async upDateNotification(
    @Req() req,
    @Body('notifications') notifications: NotificationResponseDTO[],
  ) {
    console.log('Update notifications:', notifications);
    const userId = req.user.id;
    return await Promise.all(
      notifications.map(
        async (notify) =>
          await this.notificationService.updateNotification({
            ...notify,
            userId,
          }),
      ),
    );
  }

  @Get('/user/setting')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @Transactional<TransactionalAdapterPrisma>({
    timeout: 10000,
    isolationLevel: 'read committed',
  })
  async getNotificationSetting(@Req() req) {
    const userId = req.user.id;

    // Check and create settings if they don't exist
    await this.notificationService.checkAndCreateNotificationSettings(userId);

    const settings =
      await this.notificationService.getNotificationSettingsByUserId(userId);

    const defaultSetting = new NotificationSettingResponseDTO();

    settings.forEach((setting) => {
      switch (setting.type) {
        case DEFAULT_TYPE.CONFERENCE_BLACKLISTED:
          defaultSetting.notificationWhenAddToBlacklist = setting.isEnabled;
          break;
        case DEFAULT_TYPE.CONFERENCE_FOLLOWED:
          defaultSetting.notificationWhenFollow = setting.isEnabled;
          break;
        case DEFAULT_TYPE.CONFERENCE_CALENDAR_ADDED:
          defaultSetting.notificationWhenAddTocalendar = setting.isEnabled;
          break;
        case DEFAULT_TYPE.ON_NOTIFICATION:
          defaultSetting.receiveNotifications = setting.isEnabled;
          break;
        case DEFAULT_TYPE.UP_COMING_CONFERENCE:
          defaultSetting.upComingEvent = setting.isEnabled;
          break;
        case DEFAULT_TYPE.SEND_THROUGH_EMAIL:
          defaultSetting.notificationThroughEmail = setting.isEnabled;
          break;
        case DEFAULT_TYPE.CONFERENCE_UPDATED:
          defaultSetting.notificationWhenConferencesChanges = setting.isEnabled;
          break;
        case DEFAULT_TYPE.PROFILE_UPDATED:
          defaultSetting.notificationWhenUpdateProfile = setting.isEnabled;
          break;
      }
    });

    return defaultSetting;
  }

  @Put('/user/setting')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @Transactional<TransactionalAdapterPrisma>()
  async updateNotificationSetting(
    @Req() req,
    @Body('settings') settings: Partial<NotificationSettingResponseDTO>,
  ) {
    const userId = req.user.id as string;

    // Check and create settings if they don't exist
    await this.notificationService.checkAndCreateNotificationSettings(userId);

    // Get the first (and only) key-value pair from the settings object
    const [key, value] = Object.entries(settings)[0];
    let typeSetting;

    switch (key) {
      case 'notificationWhenAddToBlacklist':
        typeSetting = DEFAULT_TYPE.CONFERENCE_BLACKLISTED;
        break;
      case 'notificationWhenFollow':
        typeSetting = DEFAULT_TYPE.CONFERENCE_FOLLOWED;
        break;
      case 'notificationWhenAddTocalendar':
        typeSetting = DEFAULT_TYPE.CONFERENCE_CALENDAR_ADDED;
        break;
      case 'upComingEvent':
        typeSetting = DEFAULT_TYPE.UP_COMING_CONFERENCE;
        break;
      case 'notificationThroughEmail':
        typeSetting = DEFAULT_TYPE.SEND_THROUGH_EMAIL;
        break;
      case 'notificationWhenConferencesChanges':
        typeSetting = DEFAULT_TYPE.CONFERENCE_UPDATED;
        break;
      case 'notificationWhenUpdateProfile':
        typeSetting = DEFAULT_TYPE.PROFILE_UPDATED;
        break;
      case 'receiveNotifications':
        typeSetting = DEFAULT_TYPE.ON_NOTIFICATION;
        break;
      case 'autoAddFollowToCalendar':
        // This is a frontend-only setting, no need to update in backend
        return {
          message: 'Update notification setting successfully',
          settings: settings,
        };
      default:
        throw new HttpException('Invalid notification setting type', 400);
    }

    if (value !== undefined) {
      await this.notificationService.updateNotificationSetting({
        userId,
        type: typeSetting,
        enable: value,
      });
    }

    // Get the updated settings
    const updatedSettings =
      await this.notificationService.getNotificationSettingsByUserId(userId);
    const defaultSetting = new NotificationSettingResponseDTO();

    updatedSettings.forEach((setting) => {
      switch (setting.type) {
        case DEFAULT_TYPE.CONFERENCE_BLACKLISTED:
          defaultSetting.notificationWhenAddToBlacklist = setting.isEnabled;
          break;
        case DEFAULT_TYPE.CONFERENCE_FOLLOWED:
          defaultSetting.notificationWhenFollow = setting.isEnabled;
          break;
        case DEFAULT_TYPE.CONFERENCE_CALENDAR_ADDED:
          defaultSetting.notificationWhenAddTocalendar = setting.isEnabled;
          break;
        case DEFAULT_TYPE.ON_NOTIFICATION:
          defaultSetting.receiveNotifications = setting.isEnabled;
          break;
        case DEFAULT_TYPE.UP_COMING_CONFERENCE:
          defaultSetting.upComingEvent = setting.isEnabled;
          break;
        case DEFAULT_TYPE.SEND_THROUGH_EMAIL:
          defaultSetting.notificationThroughEmail = setting.isEnabled;
          break;
        case DEFAULT_TYPE.CONFERENCE_UPDATED:
          defaultSetting.notificationWhenConferencesChanges = setting.isEnabled;
          break;
        case DEFAULT_TYPE.PROFILE_UPDATED:
          defaultSetting.notificationWhenUpdateProfile = setting.isEnabled;
          break;
      }
    });

    return {
      message: 'Update notification setting successfully',
      settings: defaultSetting,
    };
  }

  @Get('all-type')
  async getAllType() {
    return this.notificationService.getAllNotificationTypes();
  }

  @Put('/clean-duplicates')
  @Transactional<TransactionalAdapterPrisma>()
  async cleanDuplicateSettings() {
    await this.notificationService.removeDuplicateSettings();
    return {
      message: 'Duplicate settings cleaned successfully',
    };
  }

  @Delete('/all-notifications')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  async deleteAllNotifications(@Req() req) {
    const userId = req.user.id as string;
    await this.notificationService.removeAllNotificationsOfUser(userId);
    return {
      message: 'All notifications deleted successfully',
    };
  }
}

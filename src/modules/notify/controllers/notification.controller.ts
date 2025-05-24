import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly notificationService: NotificationService) {}

  @Get('/user')
  @UseGuards(JWTGuardUser)
  async getNotificationByUserId(@Req() req) {
    const userId = req.user.id;
    const notifications =
      await this.notificationService.getNotificationByUserId(userId);
    return notifications.map((notification) =>
      this.notificationService.transformNotification({
        id: notification.id,
        message: notification.message,
        isRead: notification.isRead,
        userId: userId,
        type: notification.belongToNotify.name || '',
        typeId: notification.belongToNotify.id,
        isDeleted: notification.isDeleted,
        conferenceId: notification.conferenceId || '',
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      }),
    );
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
    const userId = req.user.id;
    const t = Promise.all(
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
  async getNotificationSetting(@Req() req) {
    const userId = req.user.id;
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
      }
    });

    return defaultSetting;
  }

  @Put('/user/setting')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
  async updateNotificationSetting(
    @Req() req,
    @Body('settings') settings: NotificationSettingResponseDTO,
  ) {
    const userId = req.user.id;
    for (const key in settings) {
      const value = settings[key as keyof NotificationSettingResponseDTO];
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
        default:
          continue; // Skip if the key doesn't match any known setting
      }
      if (value !== undefined) {
        await this.notificationService.updateNotificationSetting({
          userId,
          type: typeSetting,
          enable: value,
        });
      }
    }
    return {
      message: 'Update notification setting successfully',
    };
  }

  @Get('all-type')
  async getAllType() {
    return this.notificationService.getAllNotificationTypes();
  }
}

import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import {  TransactionHost } from '@nestjs-cls/transactional';
import { NotificationDTO } from '../models/notification-dto';
import { NotificationResponseDTO } from '../models/notification-reponse.dto';
import { DEFAULT_TYPE } from '../constants/default-type';
import { MessageService } from 'src/modules/socket-gateway/services/message.service';
import { NotificationInput } from '../models/notification.input';
@Injectable()
export class NotificationService {
  constructor(
    private prismaService: PrismaService,
    private txHost: TransactionHost<TransactionalAdapterPrisma>,
    private messageService : MessageService
  ) {
    this.initNotification();
  }

  async getNotificationByUserId(userId: string) {
    return await this.prismaService.notifications.findMany({
      where: {
        userId,
      },
      include: {
        belongToNotify: true,
      },
    });
  }

  transformNotification(
    notification: NotificationDTO,
  ): NotificationResponseDTO {
    return {
      id: notification.id,
      message: notification.message,
      seenAt: notification.isRead ? notification.updatedAt : null,
      type: notification.type || '',
      deletedAt: notification.isDeleted ? notification.updatedAt : null,
      conferenceId: notification.conferenceId || '',
      createdAt: notification.createdAt,
      isImportant: !notification.isDeleted,
    };
  }
  async initNotification() {
    for (const type of Object.keys(DEFAULT_TYPE)) {
      const notificationType = await this.prismaService.notificationsTypes.findFirst({
        where: {
          name: type,
        },
      });
      if (!notificationType) {
        await this.prismaService.notificationsTypes.create({
          data: {
            name: type,
          },
        });
        console.log('Notification type created:', type);
      }
    } 
  }

  async createConferenceNotification (
    input : NotificationInput
  ){
    const { conferenceId, message, type } = input;
    if(!type){
      throw new HttpException('Notification type is required', 400);
    }
    const notificationType = await this.prismaService.notificationsTypes.findFirst({
      where: {
        name: type,
      },
    });
    if (!notificationType) {
      throw new HttpException('Notification type not found', 400);
    }
    const notification = await this.txHost.tx.notifications.create({
      data: {
        userId : input.userId,
        message : message,
        conferenceId : conferenceId,
        isRead : input.isRead,
        isDeleted : input.isDeleted,
        notificationId : notificationType.id,
      }
    });
    return this.transformNotification({
      ...notification,
      type : type ,
      typeId : notificationType.id,
    });
  }

  async setDefaultNotificationSettingForUser(userId: string) {
    const notificationTypes = await this.txHost.tx.notificationsTypes.findMany();
    for(const type of notificationTypes) {
      await this.txHost.tx.notificationSettings.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId: type.id,
          },
        },
        update: {
          isEnabled : true,
        },
        create: {
          userId,
          notificationId: type.id,
          isEnabled: true,
        },
      })
    }
  }

  async getNotificationSettingsByUserId(userId: string) {
    return await this.prismaService.notificationSettings.findMany({
      where: {
        userId,
      },
      include : {
        belongToNotify : {
          select : {
            name : true
          }
        }
      }
    });
  }

   async sendNotificationToUser(
    notifyInput : NotificationResponseDTO , userId : string
   ){
    const { conferenceId, message, type } = notifyInput;
    const notificationType = await this.txHost.tx.notificationsTypes.findFirst({
      where: {
        name: type,
      },
    });
    if (!notificationType) {
      throw new HttpException('Notification type not found', 400);
    }
    const inSetting = await this.txHost.tx.notificationSettings.findFirst({
      where: {
        userId,
        notificationId: notificationType.id,
      },
    })
    if (!inSetting) {
      throw new HttpException ('User turn off the notification', 400);
    }
    const notification = await this.txHost.tx.notifications.create({
      data: {
        message,
        userId,
        conferenceId,
        notificationId : notificationType.id
      },
    });
    this.messageService.sendMessageToUser({
      userId,
      payload: notifyInput ,
      channel : 'notification', 
    })
   }

  async markAllAsRead(userId: string) {
    return await this.prismaService.notifications.updateMany({
      where: {
        userId,
        isRead: false,
        isDeleted: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  async updateNotification(noty : NotificationResponseDTO & {userId : string}) {
    const { id, seenAt , deletedAt } = noty;
    return await this.prismaService.notifications.update({
      where: {
        id,
      },
      data: {
        isRead: !!seenAt,
        isDeleted: !!deletedAt,
        updatedAt: new Date(),
      },
    });
  }

  async createCalendarNotification() {}
}

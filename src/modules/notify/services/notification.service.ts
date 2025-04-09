import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { notificationDTO } from '../models/notification-dto';
import { NotificationResponseDTO } from '../models/notification-reponse.dto';
import { DEFAULT_TYPE } from '../constants/default-type';
import { connect } from 'http2';
@Injectable()
export class NotificationService {
  constructor(
    private prismaService: PrismaService,
    private txHost: TransactionHost<TransactionalAdapterPrisma>,
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
    notification: notificationDTO,
  ): NotificationResponseDTO {
    return {
      id: notification.id,
      message: notification.message,
      seenAt: notification.isRead ? notification.updatedAt : null,
      type: notification.type,
      deletedAt: notification.isDelted ? notification.updatedAt : null,
      conferenceId: notification.conferenceId,
      createdAt: notification.createdAt,
      isImportant: !notification.isDelted,
    };
  }

  async initNotification() {
    const notificationTypes =
      await this.prismaService.notificationsTypes.findFirst();
    if (!notificationTypes) {
      await this.prismaService.notificationsTypes.createMany({
        data: DEFAULT_TYPE.map((item) => ({
          name: item,
        })),
      });
      console.log('Notification types created');
    }
  }

  async createFollowConferenceNotification(
    userId: string,
    conferenceId: string,
  ) {
    const notificationTypeID = await this.prismaService.notificationsTypes.findUnique({
        where: {
            name: DEFAULT_TYPE[0],
        },
    })
    if(!notificationTypeID) {
        throw new Error('Notification type not found')
    }
    const notification = await this.prismaService.notifications.create({
      data: {
        message: `You have followed the conference ${conferenceId}`,
        userId,
        conferenceId,
        notificationId : notificationTypeID?.id,
        }
      },
    );
    return this.transformNotification({
        id: notification.id,
        message: notification.message,
        isRead: notification.isRead,
        type: DEFAULT_TYPE[0],
        isDelted: notification.isDeleted,
        conferenceId: notification.conferenceId || '',
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
    });
  }
}

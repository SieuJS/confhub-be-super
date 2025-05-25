import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { NotificationDTO } from '../models/notification-dto';
import { NotificationResponseDTO } from '../models/notification-reponse.dto';
import { DEFAULT_TYPE } from '../constants/default-type';
import { MessageService } from 'src/modules/socket-gateway/services/message.service';
import { NotificationInput } from '../models/notification.input';
import { PrismaClient } from 'generated/prisma_client';
import { EmailService } from 'src/modules/email-verify/services/email.service';
@Injectable()
export class NotificationService {
  constructor(
    private prismaService: PrismaService,
    private txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    private emailService: EmailService,
    private messageService: MessageService,
  ) {}

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

  async resetAllUserNotificationSetting() {
    const users = await this.prismaService.users.findMany();
    for (const user of users) {
      await this.setDefaultNotificationSettingForUser(user.id);
    }
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
      const notificationType =
        await this.txHost.tx.notificationsTypes.findFirst({
          where: {
            name: type,
          },
        });
      if (!notificationType) {
        await this.txHost.tx.notificationsTypes.create({
          data: {
            name: type,
          },
        });
        console.log('Notification type created:', type);
      }
    }
    // Remove duplicate settings after initialization
    await this.removeDuplicateSettings();
  }

  async removeDuplicateSettings() {
    // Get all notification settings
    const allSettings = await this.txHost.tx.notificationSettings.findMany({
      include: {
        belongToNotify: true,
      },
    });

    // Group settings by userId and notificationId
    const groupedSettings = allSettings.reduce(
      (acc, setting) => {
        const key = `${setting.userId}-${setting.notificationId}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(setting);
        return acc;
      },
      {} as Record<string, typeof allSettings>,
    );

    // For each group, keep only the most recent setting and delete others
    for (const [key, settings] of Object.entries(groupedSettings)) {
      if (settings.length > 1) {
        // Sort by updatedAt in descending order
        const sortedSettings = settings.sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );

        // Keep the most recent one, delete others
        const [keepSetting, ...duplicates] = sortedSettings;

        // Delete duplicate settings
        await Promise.all(
          duplicates.map((duplicate) =>
            this.txHost.tx.notificationSettings.delete({
              where: {
                id: duplicate.id,
              },
            }),
          ),
        );

        console.log(
          `Removed ${duplicates.length} duplicate settings for ${key}`,
        );
      }
    }
  }

  async createConferenceNotification(input: NotificationInput) {
    const { conferenceId, message, type } = input;
    if (!type) {
      throw new HttpException('Notification type is required', 400);
    }
    const notificationType = await this.txHost.tx.notificationsTypes.findFirst({
      where: {
        name: type,
      },
    });
    if (!notificationType) {
      throw new HttpException('Notification type not found', 400);
    }
    const setting = await this.txHost.tx.notificationSettings.findFirst({
      where: {
        userId: input.userId,
        notificationId: notificationType.id,
        isEnabled: true,
      },
    });
    if (!setting) {
      throw new HttpException('User turn off the notification', 400);
    }

    const notification = await this.txHost.tx.notifications.create({
      data: {
        userId: input.userId,
        message: message,
        conferenceId: conferenceId,
        isRead: input.isRead,
        isDeleted: input.isDeleted,
        notificationId: notificationType.id,
      },
    });
    return this.transformNotification({
      ...notification,
      type: type,
      typeId: notificationType.id,
    });
  }

  async setDefaultNotificationSettingForUser(userId: string) {
    const notificationTypes =
      await this.txHost.tx.notificationsTypes.findMany();
    for (const type of notificationTypes) {
      await this.txHost.tx.notificationSettings.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId: type.id,
          },
        },
        update: {},
        create: {
          userId,
          notificationId: type.id,
          isEnabled: true,
        },
      });
    }
  }

  async getNotificationSettingsByUserId(userId: string) {
    const setting = await this.txHost.tx.notificationSettings.findMany({
      where: {
        userId,
      },
      include: {
        belongToNotify: {
          select: {
            name: true,
          },
        },
      },
    });
    return setting.map((setting) => ({
      type: setting.belongToNotify.name,
      isEnabled: setting.isEnabled,
    }));
  }

  async sendNotificationToUser(
    notifyInput: NotificationResponseDTO,
    userId: string,
  ) {
    const { type } = notifyInput;
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
        isEnabled: true,
      },
    });
    if (!inSetting) {
      throw new HttpException('User turn off the notification', 400);
    }
    this.messageService.sendMessageToUser({
      userId,
      payload: notifyInput,
      channel: 'notification',
    });
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

  async updateNotification(noty: NotificationResponseDTO & { userId: string }) {
    const { id, seenAt, deletedAt } = noty;
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

  async getAllNotificationTypes() {
    return await this.prismaService.notificationsTypes.findMany();
  }

  async updateNotificationSetting({
    userId,
    type,
    enable,
  }: {
    userId: string;
    type: string;
    enable: boolean;
  }) {
    const notificationType = await this.txHost.tx.notificationsTypes.findFirst({
      where: {
        name: type,
      },
    });
    if (!notificationType) {
      console.log('Notification type not found', type);
      throw new HttpException('Notification type not found', 400);
    }
    const setting = await this.txHost.tx.notificationSettings.findFirst({
      where: {
        userId,
        notificationId: notificationType.id,
      },
    });
    if (!setting) {
      throw new HttpException('Notification setting not found', 400);
    }
    return await this.txHost.tx.notificationSettings.update({
      where: {
        id: setting.id,
      },
      data: {
        isEnabled: enable,
      },
    });
  }

  async turnOffAllNotification(userId: string) {
    const notificationTypes =
      await this.txHost.tx.notificationsTypes.findMany();
    for (const type of notificationTypes) {
      await this.txHost.tx.notificationSettings.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId: type.id,
          },
        },
        update: {
          isEnabled: false,
        },
        create: {
          userId,
          notificationId: type.id,
          isEnabled: false,
        },
      });
    }
  }

  async turnOnAllNotification(userId: string) {
    const notificationTypes =
      await this.txHost.tx.notificationsTypes.findMany();
    for (const type of notificationTypes) {
      await this.txHost.tx.notificationSettings.upsert({
        where: {
          userId_notificationId: {
            userId,
            notificationId: type.id,
          },
        },
        update: {
          isEnabled: true,
        },
        create: {
          userId,
          notificationId: type.id,
          isEnabled: true,
        },
      });
    }
  }

  async turnOnNofificationOption(userID: string, type: string) {
    const notificationType = await this.txHost.tx.notificationsTypes.findFirst({
      where: {
        name: type,
      },
    });
    if (!notificationType) {
      throw new HttpException('Notification type not found', 400);
    }
    const setting = await this.txHost.tx.notificationSettings.findFirst({
      where: {
        userId: userID,
        notificationId: notificationType.id,
      },
    });
    if (!setting) {
      throw new HttpException('Notification setting not found', 400);
    }
    return await this.txHost.tx.notificationSettings.update({
      where: {
        id: setting.id,
      },
      data: {
        isEnabled: true,
      },
    });
  }

  async sendUpdateConferenceNotification(conferenceId: string) {
    const notificationType = await this.txHost.tx.notificationsTypes.findFirst({
      where: {
        name: DEFAULT_TYPE.CONFERENCE_UPDATED,
      },
    });
    if (!notificationType) {
      throw new HttpException('Notification type not found', 400);
    }
    const conference = await this.prismaService.conferences.findUnique({
      where: {
        id: conferenceId,
      },
    });
    if (!conference) {
      throw new HttpException('Conference not found', 400);
    }
    const users = await this.prismaService.users.findMany({
      where: {
        notificationSettings: {
          some: {
            isEnabled: true,
            notificationId: notificationType.id,
          },
        },
      },
    });
    for (const user of users) {
      await this.createConferenceNotification({
        userId: user.id,
        conferenceId: conferenceId,
        message: `${conference.title} has been updated`,
        isDeleted: false,
        isRead: false,
        type: DEFAULT_TYPE.CONFERENCE_UPDATED,
      });
    }
  }

  async sendEmailNotification(userId: string, content: string) {
    const emailType = DEFAULT_TYPE.SEND_THROUGH_EMAIL;
    const notificationType = await this.txHost.tx.notificationsTypes.findFirst({
      where: {
        name: emailType,
      },
    });
    if (!notificationType) {
      throw new HttpException('Notification type not found', 400);
    }
    const userSetting = await this.txHost.tx.notificationSettings.findFirst({
      where: {
        userId,
        notificationId: notificationType.id,
        isEnabled: true,
      },
    });
    if (!userSetting) {
      throw new HttpException('User turn off the notification', 400);
    }
    const user = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      throw new HttpException('User not found', 400);
    }
    const emailService = await this.emailService.sendUpcomingEventEmail(
      user.email,
      user.firstName,
      content,
    );
    return emailService;
  }

  async checkAndCreateNotificationSettings(userId: string) {
    const notificationTypes =
      await this.txHost.tx.notificationsTypes.findMany();
    const userSettings = await this.txHost.tx.notificationSettings.findMany({
      where: { userId },
    });

    const missingTypes = notificationTypes.filter(
      (type) =>
        !userSettings.some((setting) => setting.notificationId === type.id),
    );

    if (missingTypes.length > 0) {
      await Promise.all(
        missingTypes.map((type) =>
          this.txHost.tx.notificationSettings.create({
            data: {
              userId,
              notificationId: type.id,
              isEnabled: true,
            },
          }),
        ),
      );
    }

    return true;
  }
}

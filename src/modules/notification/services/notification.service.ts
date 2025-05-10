import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';
import { ConferenceDTO } from '../../conference/models/conference/conference.dto';
import { INotification } from '../interfaces/notification.interface';
import { EmailService } from '../../email-verify/services/email.service';
import * as crypto from 'crypto';
import { DEFAULT_TYPE } from 'src/modules/notify/constants/default-type';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async sendUpcomingEventNotification(
    conference: ConferenceDTO,
  ): Promise<INotification[]> {
    const notificationTypes =
      await this.prismaService.notificationsTypes.findFirst({
        where: {
          name: DEFAULT_TYPE.UP_COMING_CONFERENCE,
        },
      });
    if (!notificationTypes) {
      throw new HttpException('Notification type not found', 404);
    }
    // Get all users who follow this conference
    const followers = await this.prismaService.conferenceFollows.findMany({
      where: {
        conferenceId: conference.id,
        byUser: {
          notificationSettings: {
            some: {
              notificationId: notificationTypes.id,
              isEnabled: true,
            },
          },
        },
      },
      include: {
        byUser: true,
      },
    });

    // Create notifications for each follower
    const notifications = followers.map((follower) => ({
      id: crypto.randomUUID(),
      userId: follower.userId,
      conferenceId: conference.id,
      journalId: null,
      message: `The conference "${conference.title}" is starting in ${this.getDaysUntilEvent(conference.dates?.fromDate || new Date())} days`,
      notificationId: notificationTypes.id,
      isImportant: false,
      isDeleted: false,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Save notifications to database
    await this.prismaService.notifications.createMany({
      data: notifications,
    });

    // Send email notifications
    for (const follower of followers) {
      try {
        const daysUntilEvent = this.getDaysUntilEvent(
          conference.dates?.fromDate || new Date(),
        );
        const emailContent = `
          <html>
            <body>
              <h1>Upcoming Conference Reminder</h1>
              <p>Hello ${follower.byUser.firstName},</p>
              <p>This is a reminder that the conference "${conference.title}" is starting in ${daysUntilEvent} days.</p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Conference Details:</h3>
                <p><strong>Title:</strong> ${conference.title}</p>
                <p><strong>Acronym:</strong> ${conference.acronym}</p>
                ${
                  conference.location
                    ? `
                <p><strong>Location:</strong> ${conference.location.cityStateProvince}, ${conference.location.country}</p>
                `
                    : ''
                }
                ${
                  conference.dates?.fromDate
                    ? `
                <p><strong>Start Date:</strong> ${conference.dates.fromDate.toLocaleDateString()}</p>
                `
                    : ''
                }
                ${
                  conference.dates?.toDate
                    ? `
                <p><strong>End Date:</strong> ${conference.dates.toDate.toLocaleDateString()}</p>
                `
                    : ''
                }
              </div>

              <p>You can view more details and manage your conference preferences by visiting your dashboard.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply directly to this email.</p>
              </div>
            </body>
          </html>
        `;

        // Use the existing email service to send the notification
        await this.emailService.sendUpcomingEventEmail(
          follower.byUser.email,
          follower.byUser.firstName,
          emailContent,
        );
      } catch (error) {
        // Log error but continue with other notifications
        console.error(
          `Failed to send email to ${follower.byUser.email}:`,
          error,
        );
      }
    }

    return notifications;
  }

  async getUserNotifications(userId: string): Promise<INotification[]> {
    return this.prismaService.notifications.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.prismaService.notifications.update({
      where: {
        id: notificationId,
      },
      data: {
        isRead: true,
        updatedAt: new Date(),
      },
    });
  }

  private getDaysUntilEvent(eventDate: Date): number {
    const today = new Date();
    const diffTime = eventDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

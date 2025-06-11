import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from 'generated/prisma_client';
import { NotificationService } from './notification.service';
import { TransactionHost } from '@nestjs-cls/transactional';
import { DEFAULT_TYPE } from '../constants/default-type';
@Injectable()
export class UpcomingEventsCronService {
  private readonly logger = new Logger(UpcomingEventsCronService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkUpcomingEvents() {
    try {
      this.logger.log('Starting daily check for upcoming events...');

      const upcomingEvents = await this.txHost.tx.conferences.findMany({
        where: {
          organizations: {
            some: {
              conferenceDates: {
                some: {
                  fromDate: {
                    gte: new Date(),
                    lte: new Date(new Date().setDate(new Date().getDate() + 7)),
                  },
                },
              },
            },
          },
        },
        include: {
          organizations: {
            include: {
              conferenceDates: true,
              locations: true,
              topics: {
                include: {
                  inTopic: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Found ${upcomingEvents.length} upcoming events`);

      // Send notifications for each upcoming event
      for (const event of upcomingEvents) {
        if (!event.organizations || event.organizations.length === 0) {
          this.logger.warn(
            `Event ${event.id} has no associated organizations, skipping notification.`,
          );
          continue;
        }
        try {
          const followers = await this.txHost.tx.conferenceFollows.findMany({
            where: {
              conferenceId: event.id,
            },
          });
          for (const follower of followers) {
            const notification =
              await this.notificationService.createConferenceNotification({
                type: DEFAULT_TYPE.CONFERENCE_UPDATED,
                conferenceId: event.id,
                userId: follower.userId,
                message: `The event ${event.title} is coming soon`,
                isDeleted: false,
                isImportant: true,
                isRead: false,
              });
            await this.notificationService.sendNotificationToUser(
              notification,
              follower.userId,
            );

            const emailContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Conference Notification</title>
                <style>
                  body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    line-height: 1.6;
                    color: #2c3e50;
                    margin: 0;
                    padding: 0;
                    background-color: #f8f9fa;
                  }
                  .container {
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                  }
                  .header {
                    background-color: #2c3e50;
                    padding: 30px 20px;
                    text-align: center;
                    border-radius: 8px 8px 0 0;
                  }
                  .header h1 {
                    color: #ffffff;
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                  }
                  .content {
                    padding: 40px 30px;
                  }
                  .event-title {
                    color: #2c3e50;
                    font-size: 22px;
                    margin-bottom: 25px;
                    font-weight: 600;
                  }
                  .event-details {
                    background-color: #f8f9fa;
                    padding: 25px;
                    border-radius: 6px;
                    margin: 25px 0;
                    border: 1px solid #e9ecef;
                  }
                  .event-detail {
                    margin: 15px 0;
                    color: #495057;
                  }
                  .event-detail strong {
                    color: #2c3e50;
                    font-weight: 600;
                  }
                  .button {
                    display: inline-block;
                    padding: 14px 28px;
                    background-color: #2c3e50;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 25px 0;
                    font-weight: 500;
                    transition: background-color 0.3s ease;
                  }
                  .button:hover {
                    background-color: #34495e;
                  }
                  .footer {
                    text-align: center;
                    padding: 25px;
                    font-size: 13px;
                    color: #6c757d;
                    border-top: 1px solid #e9ecef;
                    background-color: #f8f9fa;
                    border-radius: 0 0 8px 8px;
                  }
                  .footer p {
                    margin: 5px 0;
                  }
                  .greeting {
                    font-size: 16px;
                    color: #495057;
                    margin-bottom: 20px;
                  }
                  .closing {
                    margin-top: 30px;
                    color: #495057;
                  }
                  .highlight {
                    color: #2c3e50;
                    font-weight: 500;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Conference Notification</h1>
                  </div>
                  <div class="content">
                    <div class="greeting">Dear Valued Conference Participant,</div>
                    
                    <p>We are writing to inform you about an upcoming conference that may be of interest to you.</p>
                    
                    <h2 class="event-title">${event.title}</h2>
                    
                    <div class="event-details">
                      ${
                        event.organizations[0].conferenceDates[0]
                          ? `
                        <div class="event-detail">
                          <strong>Conference Schedule:</strong><br>
                          ${event.organizations[0].conferenceDates[0].fromDate ? new Date(event.organizations[0].conferenceDates[0].fromDate).toLocaleDateString() : 'To be determined'} 
                          ${event.organizations[0].conferenceDates[0].toDate ? ` - ${new Date(event.organizations[0].conferenceDates[0].toDate).toLocaleDateString()}` : ''}
                        </div>
                      `
                          : ''
                      }
                      ${
                        event.organizations[0].locations[0]
                          ? `
                        <div class="event-detail">
                          <strong>Conference Venue:</strong><br>
                          ${event.organizations[0].locations[0].address ? `${event.organizations[0].locations[0].address}, ` : ''}
                          ${event.organizations[0].locations[0].cityStateProvince ? `${event.organizations[0].locations[0].cityStateProvince}, ` : ''}
                          ${event.organizations[0].locations[0].country ? `${event.organizations[0].locations[0].country}` : ''}
                        </div>
                      `
                          : ''
                      }
                      ${
                        event.organizations[0].topics &&
                        event.organizations[0].topics.length > 0
                          ? `
                        <div class="event-detail">
                          <strong>Conference Topics:</strong><br>
                          ${event.organizations[0].topics.map((topic) => topic.inTopic.name).join(', ')}
                        </div>
                      `
                          : ''
                      }
                    </div>

                    <p class="closing">
                      We believe this conference aligns with your professional interests and would be valuable for your participation. 
                      The event promises to provide excellent networking opportunities and insights into the latest developments in the field.
                    </p>

                    <div style="text-align: center;">
                      <a href="${process.env.FRONTEND_URL}/conference/${event.id}" class="button">View Conference Details</a>
                    </div>

                    <p class="closing">
                      Should you have any questions or require additional information, please do not hesitate to contact us.
                    </p>

                    <p class="closing">
                      Best regards,<br>
                      <span class="highlight">The ConfHub Team</span>
                    </p>
                  </div>
                  <div class="footer">
                    <p>This is an automated message. Please do not reply to this email.</p>
                    <p>© ${new Date().getFullYear()} ConfHub. All rights reserved.</p>
                  </div>
                </div>
              </body>
              </html>
            `;
            await this.notificationService.sendEmailNotification(
              follower.userId,
              emailContent,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error sending notification for event ${event.id}:`,
            error,
          );
        }
      }

      this.logger.log('Finished processing upcoming events');
    } catch (error) {
      this.logger.error('Error checking upcoming events:', error);
    }
  }
}

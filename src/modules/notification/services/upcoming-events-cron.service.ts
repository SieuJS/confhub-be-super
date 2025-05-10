import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConferenceService } from '../../conference/services/conference.service';
import { NotificationService } from './notification.service';

@Injectable()
export class UpcomingEventsCronService {
  private readonly logger = new Logger(UpcomingEventsCronService.name);

  constructor(
    private readonly conferenceService: ConferenceService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkUpcomingEvents() {
    try {
      this.logger.log('Starting daily check for upcoming events...');

      // Get events happening in the next 7 days
      const upcomingEvents =
        await this.conferenceService.checkUpcomingEvents(7);

      this.logger.log(`Found ${upcomingEvents.length} upcoming events`);

      // Send notifications for each upcoming event
      for (const event of upcomingEvents) {
        try {
          await this.notificationService.sendUpcomingEventNotification(event);
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

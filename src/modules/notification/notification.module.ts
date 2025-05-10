import { Module } from '@nestjs/common';
import { NotificationService } from './services/notification.service';
import { UpcomingEventsCronService } from './services/upcoming-events-cron.service';
import { ConferencesModule } from '../conference/conference.module';
import { EmailVerifyModule } from '../email-verify/email-verify.module';
import { CommonModule } from '../common';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ConferencesModule, CommonModule, EmailVerifyModule, ScheduleModule],
  providers: [NotificationService, UpcomingEventsCronService],
  exports: [NotificationService],
})
export class NotificationModule {}

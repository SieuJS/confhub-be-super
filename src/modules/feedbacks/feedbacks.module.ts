import { Module } from '@nestjs/common';
import { FeedbackService } from './services/feedback.service';
import { FeedbackController } from './controller/feedback.controller';
import { CommonModule } from '../common';
import { UserModule } from '../user/user.module';
import { ConferencesModule } from '../conference/conference.module';
import { NotifyModule } from '../notify/notify.module';

@Module({
  imports: [CommonModule, UserModule, ConferencesModule, NotifyModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbacksModule {}

import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { JournalController } from './controllers/journal.controller';
import { JournalService } from './services/journal/journal.service';
import { JournalFollowController } from './controllers/journal-follow.controller';
import { JournalFollowService } from './services/journal-follow/journal-follow.service';
import { NotifyModule } from '../notify/notify.module';
import { AuthModule } from '../auth/auth.module';
import { JournalCsvController } from './controllers/journal-csv.controller';
import { JournalCsvService } from './services/journal-csv/journal-csv.service';

@Module({
  imports: [CommonModule, NotifyModule, AuthModule],
  controllers: [
    JournalController,
    JournalFollowController,
    JournalCsvController,
  ],
  providers: [JournalService, JournalFollowService, JournalCsvService],
  exports: [JournalService, JournalFollowService, JournalCsvService],
})
export class JournalModule {}

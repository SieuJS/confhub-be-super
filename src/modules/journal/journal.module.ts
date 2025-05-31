import { Module } from '@nestjs/common';
import { JournalService } from './services/journal/journal.service';
import { JournalController } from './controllers/journal.controller';
import { CommonModule } from '../common';

@Module({
  imports: [CommonModule],
  controllers: [JournalController],
  providers: [JournalService],
  exports: [JournalService],
})
export class JournalModule {}

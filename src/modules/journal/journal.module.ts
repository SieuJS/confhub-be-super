import { Module } from '@nestjs/common';
import { JournalService } from './service/journal/journal.service';
import { CommonModule } from '../common';
import { JournalController } from './controller/journal/journal.controller';
import { SourceRankModule } from '../source-rank';

@Module({
  imports : [CommonModule, SourceRankModule],
  providers: [JournalService],
  controllers: [JournalController]
})
export class JournalModule {}

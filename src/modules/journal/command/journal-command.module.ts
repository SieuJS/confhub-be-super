import { Module } from '@nestjs/common';
import { InitJournalCommand } from './init-journal.command';
import { JournalService } from '../service/journal/journal.service';
import { CommonModule } from '../../common';
import { SourceRankModule } from '../../source-rank';

@Module({
  imports: [CommonModule, SourceRankModule],
  providers: [InitJournalCommand, JournalService],
})
export class JournalCommandModule {} 
import { Command, CommandRunner } from 'nest-commander';
import { JournalService } from '../service/journal/journal.service';
import { Injectable } from '@nestjs/common';
import * as path from 'path';

@Injectable()
@Command({
  name: 'init:journals',
  description: 'Initialize journals from JSONL file',
})
export class InitJournalCommand extends CommandRunner {
  constructor(private readonly journalService: JournalService) {
    super();
  }

  async run(): Promise<void> {
    try {
      const filePath = path.join(
        process.cwd(),
        'src/modules/journal/service/journal/journal_data.jsonl',
      );
      console.log('Starting journal import from:', filePath);
      await this.journalService.importJournalsFromJsonl(filePath);
      console.log('Journal import completed successfully');
    } catch (error) {
      console.error('Error importing journals:', error);
      process.exit(1);
    }
  }
} 
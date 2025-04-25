import { Controller, Get } from '@nestjs/common';
import { JournalService } from '../../service/journal/journal.service';
import * as JournalData from '../../service/journal/journal_data.json'
import { JournalImport } from '../../models/journal.import';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Transactional } from '@nestjs-cls/transactional';

@Controller('journal')
export class JournalController {
    constructor(
        private readonly journalService: JournalService,
    ) {

    }

    @Get('')
    getAllJournalEntries() {
        return this.journalService.getAllJournalEntries();
    }

    @Get('import')
    @Transactional<TransactionalAdapterPrisma>()
    async importJournalEntries() {
        const journalImport = JournalData as unknown as JournalImport[];

        const results = await Promise.all(
            journalImport.map(async (journal) => {
                const journalEntry = await this.journalService.createOrCreateJournalEntry(journal);
                return journalEntry;
            }
            )
        );
        return results.length;
    }

}

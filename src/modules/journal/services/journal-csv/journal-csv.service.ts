import { Injectable, BadRequestException } from '@nestjs/common';
import { JournalService } from '../journal/journal.service';
import { JournalCsvImportResponseDto } from '../../models/journal-csv-import-response.dto';
import { parseJournalCsv } from '../../utils/csv-parser.util';

@Injectable()
export class JournalCsvService {
  constructor(private readonly journalService: JournalService) {}

  async processCsvFile(
    fileBuffer: Buffer,
  ): Promise<JournalCsvImportResponseDto> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Empty file provided');
    }

    // Convert buffer to string
    const csvContent = fileBuffer.toString('utf-8');

    // Validate CSV content
    if (!csvContent.trim()) {
      throw new BadRequestException('CSV file is empty');
    }

    // Parse CSV content
    const journals = parseJournalCsv(csvContent);

    // Validate parsed data
    if (!journals || journals.length === 0) {
      throw new BadRequestException('No valid journal data found in CSV');
    }

    // Check and import journals
    return this.journalService.checkAndImportJournalsFromCsv(journals);
  }
}

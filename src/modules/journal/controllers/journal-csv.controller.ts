import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JournalCsvService } from '../services/journal-csv/journal-csv.service';
import { JournalCsvImportResponseDto } from '../models/journal-csv-import-response.dto';

@ApiTags('Journals')
@Controller('journals/csv')
export class JournalCsvController {
  constructor(private readonly journalCsvService: JournalCsvService) {}

  @Post('check-import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Check and import journals from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file containing journal data',
        },
      },
    },
  })
  async checkAndImportCsv(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<JournalCsvImportResponseDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!file.mimetype.includes('csv')) {
      throw new BadRequestException('File must be a CSV');
    }

    return this.journalCsvService.processCsvFile(file.buffer);
  }
}

import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UsePipes,
  Param,
  UseInterceptors,
  UploadedFile,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { JournalService } from '../services/journal/journal.service';
import { JournalImportDto } from '../models/journal-import.dto';
import { JournalListQueryDto } from '../models/journal-list-query.dto';
import { JournalImportResponseDto } from '../models/journal-import-response.dto';
import { JournalListResponseDto } from '../models/journal-list-response.dto';
import { JournalListItemDto } from '../models/journal-list-response.dto';
import { JournalTransformPipe } from '../pipes/journal-transform.pipe';
import { JournalCsvImportResponseDto } from '../models/journal-csv-import-response.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JournalCsvService } from '../services/journal-csv/journal-csv.service';

@ApiTags('Journals')
@Controller('journals')
export class JournalController {
  constructor(
    private readonly journalService: JournalService,
    private readonly journalCsvService: JournalCsvService,
  ) {}

  @Post('import')
  @UsePipes(JournalTransformPipe)
  @ApiOperation({ summary: 'Import journals data' })
  @ApiBody({ type: [JournalImportDto] })
  @ApiResponse({
    status: 200,
    description: 'Journals imported successfully',
    type: JournalImportResponseDto,
  })
  async importJournals(
    @Body() journals: JournalImportDto[],
  ): Promise<JournalImportResponseDto> {
    return this.journalService.importJournals(journals);
  }

  @Post('check-import')
  @ApiOperation({ summary: 'Check and import journals from CSV data' })
  @UseInterceptors(FileInterceptor('file'))
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
  @ApiResponse({
    status: 200,
    description: 'Journals checked successfully',
    type: JournalCsvImportResponseDto,
  })
  async checkAndImportJournals(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<JournalCsvImportResponseDto> {
    if (!file) {
      throw new HttpException(
        {
          message: 'file is required',
        },
        400,
      );
    }

    if (!file.mimetype || !file.mimetype.includes('csv')) {
      throw new HttpException(
        {
          message: 'file must be a CSV',
        },
        400,
      );
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new HttpException(
        {
          message: 'file size must be less than 5MB',
        },
        400,
      );
    }

    try {
      return await this.journalCsvService.processCsvFile(file.buffer);
    } catch (error) {
      throw new HttpException(
        {
          message: 'error when processing CSV file',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        400,
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get list of journals with filters and pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of journals retrieved successfully',
    type: JournalListResponseDto,
  })
  async getJournals(
    @Query() query: JournalListQueryDto,
  ): Promise<JournalListResponseDto> {
    return this.journalService.getJournals(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journal by ID' })
  @ApiParam({ name: 'id', description: 'Journal ID' })
  @ApiResponse({
    status: 200,
    description: 'Journal retrieved successfully',
    type: JournalListItemDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Journal not found',
  })
  async getJournalById(@Param('id') id: string): Promise<JournalListItemDto> {
    return this.journalService.getJournalById(id);
  }
}

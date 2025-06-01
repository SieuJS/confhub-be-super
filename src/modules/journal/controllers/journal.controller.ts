import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UsePipes,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JournalService } from '../services/journal/journal.service';
import { JournalImportDto } from '../models/journal-import.dto';
import { JournalListQueryDto } from '../models/journal-list-query.dto';
import { JournalImportResponseDto } from '../models/journal-import-response.dto';
import { JournalListResponseDto } from '../models/journal-list-response.dto';
import { JournalListItemDto } from '../models/journal-list-response.dto';
import { JournalTransformPipe } from '../pipes/journal-transform.pipe';

@ApiTags('Journals')
@Controller('journals')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

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

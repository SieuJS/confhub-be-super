import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JournalService } from '../service/journal/journal.service';
import {
  SortField,
  SortOrder,
} from '../models/journal-request/get-journal-params';
import { JournalPaginationDTO } from '../models/journal/journal-pagination.dto';

@ApiTags('journal')
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  @ApiOperation({
    summary: 'Get list of journals with filtering, pagination and sorting',
  })
  @ApiResponse({
    status: 200,
    description: 'List of journals',
    type: JournalPaginationDTO,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in title, publisher and country',
  })
  @ApiQuery({
    name: 'publisher',
    required: false,
    description: 'Filter by publisher',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Filter by country',
  })
  @ApiQuery({
    name: 'region',
    required: false,
    description: 'Filter by region',
  })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by type' })
  @ApiQuery({
    name: 'categories',
    required: false,
    description: 'Filter by categories',
    type: [String],
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: 'Filter by fields',
    type: [String],
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    type: Number,
    default: 1,
  })
  @ApiQuery({
    name: 'perPage',
    required: false,
    description: 'Items per page',
    type: Number,
    default: 10,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field',
    enum: SortField,
    default: SortField.CREATED_AT,
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  async getJournals(
    @Query('search') search?: string,
    @Query('publisher') publisher?: string,
    @Query('country') country?: string,
    @Query('region') region?: string,
    @Query('type') type?: string,
    @Query('categories') categories?: string[],
    @Query('fields') fields?: string[],
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('perPage', new DefaultValuePipe(10), ParseIntPipe) perPage: number = 10,
    @Query('sortBy', new DefaultValuePipe(SortField.CREATED_AT)) sortBy: SortField = SortField.CREATED_AT,
    @Query('sortOrder', new DefaultValuePipe(SortOrder.DESC)) sortOrder: SortOrder = SortOrder.DESC,
  ): Promise<JournalPaginationDTO> {
    return this.journalService.getJournals(
      {
        search,
        publisher,
        country,
        region,
        type,
        categories,
        fields,
        page,
        perPage,
      },
      {
        sortBy,
        sortOrder,
      },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journal by ID' })
  @ApiResponse({
    status: 200,
    description: 'Journal details',
  })
  async getJournalById(@Query('id') id: string) {
    return this.journalService.getJournalById(id);
  }
}

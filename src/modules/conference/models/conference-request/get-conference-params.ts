import { ApiProperty } from '@nestjs/swagger';
import { ConferenceFilter } from '../conference-filter/conference.filter';

export class GetConferencesParams extends ConferenceFilter {
  @ApiProperty({
    description: 'Mode',
    required: false,
  })
  mode?: string;

  @ApiProperty({
    description: 'The page number',
    required: false,
  })
  page?: number;

  @ApiProperty({
    description: 'The page size',
    required: false,
  })
  perPage?: number;
}

export class GetConferencesSortParams {
  @ApiProperty({
    description: 'Sort by',
    required: false,
  })
  sortBy?:
    | 'conferenceDate'
    | 'submissionDate'
    | 'title'
    | 'acronym'
    | 'rank'
    | 'source';

  @ApiProperty({
    description: 'Sort order',
    required: false,
  })
  sortOrder?: 'asc' | 'desc';
}

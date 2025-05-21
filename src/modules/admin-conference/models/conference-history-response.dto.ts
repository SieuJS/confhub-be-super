import { ApiProperty } from '@nestjs/swagger';

export class LocationDto {
  @ApiProperty({ description: 'Address of the location' })
  address: string;

  @ApiProperty({ description: 'City, state or province' })
  cityStateProvince: string;

  @ApiProperty({ description: 'Country' })
  country: string;

  @ApiProperty({ description: 'Continent' })
  continent: string;
}

export class ConferenceDateDto {
  @ApiProperty({ description: 'Type of the date (e.g., conference, submission, etc.)' })
  type: string;

  @ApiProperty({ description: 'Start date' })
  startDate: Date;

  @ApiProperty({ description: 'End date' })
  endDate: Date;

  @ApiProperty({ description: 'Name of the date' })
  name: string;
}

export class ConferenceHistoryResponseDto {
  @ApiProperty({ description: 'Organization history ID' })
  id: string;

  @ApiProperty({ description: 'Year of the conference' })
  year: number;

  @ApiProperty({ description: 'Access type of the conference' })
  accessType: string;

  @ApiProperty({ description: 'Whether the conference is available' })
  isAvailable: boolean;

  @ApiProperty({ description: 'Publisher of the conference' })
  publisher: string;

  @ApiProperty({ description: 'Summary of the conference' })
  summerize: string;

  @ApiProperty({ description: 'Call for papers information' })
  callForPaper: string;

  @ApiProperty({ description: 'Main conference link' })
  link: string;

  @ApiProperty({ description: 'Call for papers link' })
  cfpLink: string;

  @ApiProperty({ description: 'Important dates link' })
  impLink: string;

  @ApiProperty({ type: [LocationDto], description: 'Conference locations' })
  locations: LocationDto[];

  @ApiProperty({ type: [String], description: 'Conference topics' })
  topics: string[];

  @ApiProperty({ type: [ConferenceDateDto], description: 'Conference dates' })
  dates: ConferenceDateDto[];

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
} 
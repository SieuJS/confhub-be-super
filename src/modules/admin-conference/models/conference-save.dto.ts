import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsObject,
  IsEnum,
  ValidateNested,
  IsDateString,
  IsArray,
} from 'class-validator';

export enum ConferenceType {
  OFFLINE = 'Offline',
  ONLINE = 'Online',
  HYBRID = 'Hybrid',
}

export enum Continent {
  ASIA = 'Asia',
  EUROPE = 'Europe',
  NORTH_AMERICA = 'North America',
  SOUTH_AMERICA = 'South America',
  AFRICA = 'Africa',
  OCEANIA = 'Oceania',
  ANTARCTICA = 'Antarctica',
}

class DateInfo {
  @ApiProperty({
    description: 'Date name',
    example: 'Submission Deadline',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Date value',
    example: '2025-10-01',
  })
  @IsString()
  @IsOptional()
  value?: string;
}

export class ConferenceSaveDto {
  @ApiProperty({
    description: 'Conference title',
    example: 'North American Association for Computational Linguistics',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Conference acronym',
    example: 'NAACL',
  })
  @IsString()
  @IsOptional()
  acronym?: string;

  @ApiProperty({
    description: 'Main conference website link',
    example: 'https://2025.naacl.org/',
  })
  @IsString()
  @IsOptional()
  mainLink?: string;

  @ApiProperty({
    description: 'Call for papers link',
    example: 'https://2025.naacl.org/calls/papers/',
  })
  @IsString()
  @IsOptional()
  cfpLink?: string;

  @ApiProperty({
    description: 'Important dates link',
    example: '',
  })
  @IsString()
  @IsOptional()
  impLink?: string;

  @ApiProperty({
    description: 'Important links with descriptive names',
    example: {
      'Call for papers link': 'https://2025.naacl.org/calls/papers/',
      'Important dates link': 'None',
      'Official Website': 'https://2025.naacl.org/',
    },
  })
  @IsObject()
  @IsOptional()
  determineLinks?: Record<string, string>;

  @ApiProperty({
    description: 'Conference dates',
    example: 'April 29 – May 4, 2025',
  })
  @IsString()
  @IsOptional()
  conferenceDates?: string;

  @ApiProperty({
    description: 'Conference year',
    example: '2025',
  })
  @IsString()
  @IsOptional()
  year?: string;

  @ApiProperty({
    description: 'Conference location',
    example: 'Albuquerque, New Mexico',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'City, state, or province of the conference',
    example: 'Albuquerque, New Mexico',
  })
  @IsString()
  @IsOptional()
  cityStateProvince?: string;

  @ApiProperty({
    description: 'Country of the conference',
    example: 'United States',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({
    enum: Continent,
    description: 'Continent where the conference is held',
  })
  @IsEnum(Continent)
  @IsOptional()
  continent?: Continent;

  @ApiProperty({
    enum: ConferenceType,
    description: 'Type of conference (Online, Offline, Hybrid)',
  })
  @IsEnum(ConferenceType)
  @IsOptional()
  type?: ConferenceType;

  @ApiProperty({
    description: 'Submission dates',
    example: {
      'Submission Deadline (via ACL Rolling Review)': 'October 15, 2024',
    },
  })
  @IsObject()
  @IsOptional()
  submissionDate?: Record<string, string>;

  @ApiProperty({
    description: 'Notification dates',
    example: {},
  })
  @IsObject()
  @IsOptional()
  notificationDate?: Record<string, string>;

  @ApiProperty({
    description: 'Camera-ready dates',
    example: {},
  })
  @IsObject()
  @IsOptional()
  cameraReadyDate?: Record<string, string>;

  @ApiProperty({
    description: 'Registration dates',
    example: {},
  })
  @IsObject()
  @IsOptional()
  registrationDate?: Record<string, string>;

  @ApiProperty({
    description: 'Other important dates',
    example: {
      'Welcome Reception': 'April 29, 2025',
      'Main Conference': 'April 30 – May 2, 2025',
      'Tutorials and Workshops': 'May 3 – 4, 2025',
    },
  })
  @IsObject()
  @IsOptional()
  otherDate?: Record<string, string>;

  @ApiProperty({
    description: 'Conference topics',
    example: 'Computational Linguistics, Natural Language Processing',
  })
  @IsString()
  @IsOptional()
  topics?: string;

  @ApiProperty({
    description: 'Conference publisher',
    example: 'No publisher',
  })
  @IsString()
  @IsOptional()
  publisher?: string;

  @ApiProperty({
    description: 'Additional conference information',
    example: 'Conference Title: NAACL 2025...',
  })
  @IsString()
  @IsOptional()
  information?: string;

  @ApiProperty({
    description: 'Conference summary',
    example: 'NAACL 2025, the 2025 Annual Conference...',
  })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({
    description: 'Call for papers details in markdown format',
    example: '# Call for Papers: NAACL 2025...',
  })
  @IsString()
  @IsOptional()
  callForPapers?: string;

  @ApiProperty({
    description: 'Request ID',
    example: 'req-1748083667535-unkby',
  })
  @IsString()
  @IsOptional()
  requestId?: string;

  @ApiProperty({
    description: 'Original request ID',
    example: 'req-1748083090378-i01nk',
  })
  @IsString()
  @IsOptional()
  originalRequestId?: string;
}

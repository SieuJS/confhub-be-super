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

enum ConferenceType {
  OFFLINE = 'Offline',
  ONLINE = 'Online',
  HYBRID = 'Hybrid',
}

enum Continent {
  ASIA = 'Asia',
  EUROPE = 'Europe',
  NORTH_AMERICA = 'North America',
  SOUTH_AMERICA = 'South America',
  AFRICA = 'Africa',
  OCEANIA = 'Oceania',
  ANTARCTICA = 'Antarctica',
}

class TitleInfo {
  @ApiProperty({
    description: 'Conference title',
    example:
      'National Conference of the American Association for Artificial Intelligence',
  })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Conference acronym', example: 'AAAI' })
  @IsString()
  acronym: string;

  @ApiProperty({
    description: 'Main conference website link',
    example: 'https://aaai.org/conference/aaai/',
  })
  @IsString()
  @IsOptional()
  link?: string;

  @ApiProperty({ description: 'Call for papers link', example: '' })
  @IsString()
  @IsOptional()
  cfpLink?: string;

  @ApiProperty({ description: 'Important dates link', example: '' })
  @IsString()
  @IsOptional()
  impLink?: string;

  @ApiProperty({
    description: 'Important links with descriptive names',
    example: { 'Official Website': 'https://aaai.org/conference/aaai/' },
  })
  @IsObject()
  @IsOptional()
  determineLinks?: Record<string, string>;
}

class DateInfo {
  @ApiProperty({
    description: 'Submission deadline date',
    example: '2025-10-01',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({
    description: 'Additional information about the date',
    example: 'Abstract submission',
  })
  @IsString()
  @IsOptional()
  info?: string;
}

export class ConferenceSaveDto {
  @ApiProperty({
    description: 'Conference acronym',
    example: 'SERA',
  })
  @IsString()
  @IsOptional()
  acronym?: string;

  @ApiProperty({ type: String, description: 'Conference title information' })
  title: string;

  @ApiProperty({
    description: 'Conference dates',
    example: 'May 29-May 31, 2025',
  })
  @IsString()
  @IsOptional()
  conferenceDates?: string;

  @ApiProperty({ description: 'Conference year', example: '2025' })
  @IsString()
  @IsOptional()
  year?: string;

  @ApiProperty({
    description: 'Conference venue/location',
    example: 'Las Vegas',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'City, state, or province of the conference',
    example: 'Las Vegas',
  })
  @IsString()
  @IsOptional()
  cityStateProvince?: string;

  @ApiProperty({
    description: 'Country of the conference',
    example: 'USA',
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

  @ApiProperty({ type: [DateInfo], description: 'Submission deadline dates' })
  @ValidateNested({ each: true })
  @Type(() => DateInfo)
  @IsArray()
  @IsOptional()
  submissionDate?: DateInfo[];

  @ApiProperty({ type: [DateInfo], description: 'Notification dates' })
  @ValidateNested({ each: true })
  @Type(() => DateInfo)
  @IsArray()
  @IsOptional()
  notificationDate?: DateInfo[];

  @ApiProperty({ type: [DateInfo], description: 'Camera-ready deadline dates' })
  @ValidateNested({ each: true })
  @Type(() => DateInfo)
  @IsArray()
  @IsOptional()
  cameraReadyDate?: DateInfo[];

  @ApiProperty({ type: [DateInfo], description: 'Registration deadline dates' })
  @ValidateNested({ each: true })
  @Type(() => DateInfo)
  @IsArray()
  @IsOptional()
  registrationDate?: DateInfo[];

  @ApiProperty({ type: [DateInfo], description: 'Other important dates' })
  @ValidateNested({ each: true })
  @Type(() => DateInfo)
  @IsArray()
  @IsOptional()
  otherDate?: DateInfo[];

  @ApiProperty({
    description: 'Conference topics',
    example: 'Software Engineering, Management, Applications',
  })
  @IsString()
  @IsOptional()
  topics?: string;

  @ApiProperty({
    description: 'Conference publisher',
    example: 'IJNDC, IJSI, IJBDIA, SCI',
  })
  @IsString()
  @IsOptional()
  publisher?: string;

  @ApiProperty({
    description: 'Additional conference information',
    example: 'conferenceTitle: ACIS Conference on Software Engineering Research, Management and Applications\nconferenceAcronym: SERA',
  })
  @IsString()
  @IsOptional()
  information?: string;

  @ApiProperty({
    description: 'Conference summary',
    example: 'The 23rd IEEE/ACIS International Conference on Software Engineering, Management and Applications (SERA 2025) will be held in Las Vegas, USA...',
  })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({
    description: 'Call for papers details in markdown format',
    example: '# Call for Papers\n\nThe 23rd IEEE/ACIS International Conference on Software Engineering Research, Management and Applications (SERA 2025)...',
  })
  @IsString()
  @IsOptional()
  callForPapers?: string;

  @ApiProperty({
    description: 'Important links with descriptive names',
    example: { 
      'Official Website': 'https://acisinternational.org/conferences/sera-2025/',
      'Call for papers link': 'http://acisinternational.org/wp-content/uploads/2025/03/SERA_2025_CFP-9.pdf',
      'Important dates link': 'None'
    },
  })
  @IsObject()
  @IsOptional()
  determineLinks?: Record<string, string>;
}

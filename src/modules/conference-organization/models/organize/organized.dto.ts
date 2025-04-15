import { ApiProperty } from '@nestjs/swagger';
import { ConferenceDateDTO } from '../date/conference-date.dto';
import { LocationDTO } from '../location/location.dto';
import { APIS } from '@getbrevo/brevo';

export class OrganizedDTO {
  @ApiProperty({
    description: 'Unique identifier for the organized event',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Is available for the organized event',
    example: true,
  })
  isAvailable: boolean;

  @ApiProperty({
    description: 'Access type for the organized event',
    example: 'online',
  })
  accessType: string;

  @ApiProperty({
    description: 'Year of the organized event',
    example: 2023,
  })
  year: number | null;

  @ApiProperty({
    description: 'Id of conference',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  conferenceId: string;

  @ApiProperty({
    description: 'link to the organized event',
    example: 'https://example.com/organized-event',
  })
  link: string;

  @ApiProperty({
    description: 'link to the organized event',
    example: 'https://example.com/organized-event',
  })
  cfpLink: string;

  @ApiProperty({
    description: 'link to the organized event',
    example: 'https://example.com/organized-event',
  })
  impLink: string;

  @ApiProperty({
    description: 'Summerize of the organized event',
    example: 'This is a summerize of the organized event',
  })
  summerize: string;

  @ApiProperty({
    description: 'Call for paper of the organized event',
    example: 'This is a call for paper of the organized event',
  })
  callForPaper: string;

  @ApiProperty({
    description: 'Publisher of the organized event',
    example: 'Springer',
  })
  publisher: string;

  @ApiProperty({
    description: 'Topics of the organized event',
    example: ['AI', 'ML', 'DL'],
    isArray: true,
  })
  topics: string[];

  @ApiProperty({
    description: 'Date when the organized event was created',
    example: '2023-10-01T00:00:00Z',
  })
  conferenceDates: Partial<ConferenceDateDTO>[];

  @ApiProperty({
    description: 'Location of the organized event',
    example: 'New York',
  })
  locations: Partial<LocationDTO>[];

  @ApiProperty({
    description: ' Created at date of the organized event',
    example: '2023-10-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated at date of the organized event',
    example: '2023-10-01T00:00:00Z',
  })
  updatedAt: Date;
}

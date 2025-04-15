import { ApiProperty } from '@nestjs/swagger';

export class ConferenceDateDTO {
  @ApiProperty({
    description: 'Unique identifier for the conference date',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Unique identifier for the organized event',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  organizedId: string;

  @ApiProperty({
    description: 'Date when the conference starts',
    example: '2023-10-01T00:00:00Z',
  })
  fromDate: Date | null;

  @ApiProperty({
    description: 'Date when the conference ends',
    example: '2023-10-05T00:00:00Z',
  })
  toDate: Date | null;

  @ApiProperty({
    description: 'Type of the conference date (e.g., submission, review, etc.)',
    example: 'submission',
  })
  type: string;

  @ApiProperty({
    description: 'Name of the conference date',
    example: 'Submission Deadline',
  })
  name: string;

  @ApiProperty({
    description: 'Unique identifier for the conference',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the conference date was last updated',
    example: '2023-10-01T00:00:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Indicates whether the conference date is available',
    example: true,
  })
  isAvailable: boolean;
}

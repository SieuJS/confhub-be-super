import { ApiProperty } from '@nestjs/swagger';

export class JournalListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  issn: string;

  @ApiProperty()
  publisher: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  region: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class JournalListResponseDto {
  @ApiProperty({ type: [JournalListItemDto] })
  items: JournalListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
} 
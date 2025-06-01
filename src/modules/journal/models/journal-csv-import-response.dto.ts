import { ApiProperty } from '@nestjs/swagger';

export class JournalCsvImportResult {
  @ApiProperty()
  title: string;

  @ApiProperty()
  issn: string;

  @ApiProperty()
  crawled: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  lastUpdated: Date | null;
}

export class JournalCsvImportResponseDto {
  @ApiProperty({ type: [JournalCsvImportResult] })
  results: JournalCsvImportResult[];

  @ApiProperty()
  totalProcessed: number;

  @ApiProperty()
  totalExists: number;

  @ApiProperty()
  totalNew: number;
}

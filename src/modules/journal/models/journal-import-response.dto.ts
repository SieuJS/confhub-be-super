import { ApiProperty } from '@nestjs/swagger';

export class ImportResult {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: any;

  @ApiProperty()
  error?: string;
}

export class JournalImportResponseDto {
  @ApiProperty({ type: [ImportResult] })
  results: ImportResult[];

  @ApiProperty()
  totalProcessed: number;

  @ApiProperty()
  totalSuccess: number;

  @ApiProperty()
  totalFailed: number;
}

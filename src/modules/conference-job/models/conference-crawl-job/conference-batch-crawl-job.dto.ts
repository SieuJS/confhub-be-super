import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ConferenceCrawlJobDTO } from './conference-crawl-job.dto';

export class ConferenceBatchCrawlJobDTO {
  @ApiProperty({
    description: 'Batch id for tracking the batch job',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  batchId: string;

  @ApiProperty({
    description: 'Array of conference crawl jobs to process in batch',
    type: [ConferenceCrawlJobDTO],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConferenceCrawlJobDTO)
  conferences: ConferenceCrawlJobDTO[];

  @ApiProperty({
    description: 'Progress of the batch job',
    example: 50,
  })
  progress: number;

  @ApiProperty({
    description: 'Status message of the batch job',
    example: 'Processing batch...',
  })
  message: string;

  @ApiProperty({
    description: 'Total number of conferences in the batch',
    example: 10,
  })
  totalCount: number;

  @ApiProperty({
    description: 'Number of successfully processed conferences',
    example: 5,
  })
  successCount: number;

  @ApiProperty({
    description: 'Number of failed conferences',
    example: 1,
  })
  failedCount: number;
}

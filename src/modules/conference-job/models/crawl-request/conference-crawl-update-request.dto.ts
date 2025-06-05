import { ApiProperty } from '@nestjs/swagger';

export class ConferenceCrawlItem {
  @ApiProperty()
  Title: string;

  @ApiProperty()
  Acronym: string;

  @ApiProperty()
  mainLink: string;

  @ApiProperty()
  cfpLink: string;

  @ApiProperty()
  impLink: string;
}

export class ModelConfig {
  @ApiProperty()
  determineLinks: 'non-tuned' | 'tuned';
  @ApiProperty()
  extractInfo: 'non-tuned' | 'tuned';
  @ApiProperty()
  extractCfp: 'non-tuned' | 'tuned';
}

export class ConferenceCrawlUpdateRequestDto {
  @ApiProperty({
    type: [ConferenceCrawlItem],
    description: 'List of conferences to update',
  })
  items: ConferenceCrawlItem[];

  @ApiProperty({
    type: ModelConfig,
    description: 'Model configuration',
  })
  models: ModelConfig;

  @ApiProperty({
    type: String,
    description: 'description',
  })
  description: string;
}

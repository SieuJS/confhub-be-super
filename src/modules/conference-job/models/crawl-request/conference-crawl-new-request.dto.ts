import { ApiProperty } from '@nestjs/swagger';
import { ModelConfig } from './conference-crawl-update-request.dto';

export class ConferenceCrawlItem {
  @ApiProperty()
  Title: string;

  @ApiProperty()
  Acronym: string;
}

export class ConferenceCrawlNewRequestDto {
  @ApiProperty({
    type: [ConferenceCrawlItem],
    description: 'List of conferences to crawl',
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

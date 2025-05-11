import { ApiProperty } from '@nestjs/swagger';
import { JournalResponse } from './journal.types';

export class JournalDTO implements JournalResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  issn: string;

  @ApiProperty()
  hIndex: string;

  @ApiProperty()
  publisher: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  scimagoLink: string;

  @ApiProperty()
  sjr: string;

  @ApiProperty()
  scope: string;

  @ApiProperty()
  emailSubmission: string;

  @ApiProperty()
  totalDocs: string;

  @ApiProperty()
  totalDocs3Years: string;

  @ApiProperty()
  totalRefs: string;

  @ApiProperty()
  totalCites3Years: string;

  @ApiProperty()
  citableDocs3Years: string;

  @ApiProperty()
  citesPerDoc2Years: string;

  @ApiProperty()
  refsPerDoc: string;

  @ApiProperty()
  percentFemale: string;

  @ApiProperty()
  overton: string;

  @ApiProperty()
  sdg: string;

  @ApiProperty()
  region: string;

  @ApiProperty()
  coverage: string;

  @ApiProperty()
  categories: string;

  @ApiProperty()
  areas: string;

  @ApiProperty()
  homepage: string;

  @ApiProperty()
  howToPublish: string;

  @ApiProperty()
  mail: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}


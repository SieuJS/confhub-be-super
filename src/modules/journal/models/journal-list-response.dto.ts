import { ApiProperty } from '@nestjs/swagger';

export class SubjectAreaAndCategoryDto {
  @ApiProperty({ description: 'Field of Research' })
  'Field of Research': string;

  @ApiProperty({ description: 'Topics', type: [String] })
  Topics: string[];
}

export class InformationDto {
  @ApiProperty({ description: 'Journal homepage URL' })
  Homepage: string;

  @ApiProperty({ description: 'How to publish in this journal' })
  'How to publish in this journal': string;

  @ApiProperty({ description: 'Contact email' })
  Mail: string;
}

export class BioxBioDto {
  @ApiProperty({ description: 'Year' })
  Year: string;

  @ApiProperty({ description: 'Impact factor' })
  Impact_factor: string;
}

export class SupplementaryTableEntryDto {
  @ApiProperty({ description: 'Category name' })
  Category: string;

  @ApiProperty({ description: 'Year' })
  Year: string;

  @ApiProperty({ description: 'Quartile (Q1-Q4)' })
  Quartile: string;
}

export class JournalListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Scimago journal link' })
  scimagoLink: string;

  @ApiProperty({
    description: 'Bioxbio data',
    type: [BioxBioDto],
    nullable: true,
  })
  bioxbio: BioxBioDto[] | null;

  @ApiProperty({ description: 'Journal image URL' })
  Image: string;

  @ApiProperty({ description: 'Image context URL' })
  Image_Context: string;

  @ApiProperty({ description: 'Journal rank' })
  Rank: string;

  @ApiProperty({ description: 'Source ID' })
  Sourceid: string;

  @ApiProperty({ description: 'Journal title' })
  Title: string;

  @ApiProperty({ description: 'Journal type' })
  Type: string;

  @ApiProperty({ description: 'ISSN number' })
  Issn: string;

  @ApiProperty({ description: 'SJR score' })
  SJR: number;

  @ApiProperty({ description: 'SJR Best Quartile' })
  'SJR Best Quartile': string;

  @ApiProperty({ description: 'H-index' })
  'H index': string;

  @ApiProperty({ description: 'Total documents in 2023' })
  'Total Docs. (2023)': string;

  @ApiProperty({ description: 'Total documents in 3 years' })
  'Total Docs. (3years)': string;

  @ApiProperty({ description: 'Total references' })
  'Total Refs.': string;

  @ApiProperty({ description: 'Total citations in 3 years' })
  'Total Cites (3years)': string;

  @ApiProperty({ description: 'Citable documents in 3 years' })
  'Citable Docs. (3years)': string;

  @ApiProperty({ description: 'Cites per document in 2 years' })
  'Cites / Doc. (2years)': string;

  @ApiProperty({ description: 'References per document' })
  'Ref. / Doc.': string;

  @ApiProperty({ description: 'Percentage of female authors' })
  '%Female': string;

  @ApiProperty({ description: 'Overton score' })
  Overton: number;

  @ApiProperty({ description: 'SDG score' })
  SDG: number;

  @ApiProperty({ description: 'Country' })
  Country: string;

  @ApiProperty({ description: 'Region' })
  Region: string;

  @ApiProperty({ description: 'Publisher name' })
  Publisher: string;

  @ApiProperty({ description: 'Coverage period' })
  Coverage: string;

  @ApiProperty({ description: 'Categories' })
  Categories: string;

  @ApiProperty({ description: 'Areas' })
  Areas: string;

  @ApiProperty({ description: 'Journal title (duplicate)' })
  title: string;

  @ApiProperty({
    description: 'Subject area and category',
    type: SubjectAreaAndCategoryDto,
  })
  'Subject Area and Category': SubjectAreaAndCategoryDto;

  @ApiProperty({ description: 'ISSN number (duplicate)' })
  ISSN: string;

  @ApiProperty({ description: 'Journal information', type: InformationDto })
  Information: InformationDto;

  @ApiProperty({ description: 'Journal scope', required: false })
  Scope?: string;

  @ApiProperty({ description: 'Additional information', required: false })
  'Additional Info'?: string;

  @ApiProperty({
    description: 'Supplementary table entries',
    type: [SupplementaryTableEntryDto],
  })
  SupplementaryTable: SupplementaryTableEntryDto[];

  @ApiProperty({ description: 'Thumbnail HTML' })
  Thumbnail: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class JournalListResponseDto {
  @ApiProperty({ type: [JournalListItemDto] })
  data: JournalListItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

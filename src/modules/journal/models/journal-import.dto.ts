import { ApiProperty } from '@nestjs/swagger';

export class SubjectAreaAndCategory {
  @ApiProperty({ description: 'Field of Research' })
  'Field of Research': string;

  @ApiProperty({ description: 'Topics', type: [String] })
  Topics: string[];
}

export class Information {
  @ApiProperty({ description: 'Journal homepage URL' })
  Homepage: string | undefined;

  @ApiProperty({ description: 'How to publish in this journal' })
  'How to publish in this journal': string | undefined;

  @ApiProperty({ description: 'Contact email' })
  Mail: string | undefined;
}

export class BioxBio {
  @ApiProperty({ description: 'Year' })
  Year: number;

  @ApiProperty({ description: 'Impact factor' })
  Impact_factor: number;
}

export class SupplementaryTableEntry {
  @ApiProperty({ description: 'Category name' })
  Category: string;

  @ApiProperty({ description: 'Year' })
  Year: string;

  @ApiProperty({ description: 'Quartile (Q1-Q4)' })
  Quartile: string;
}

export class JournalImportDto {
  @ApiProperty({ description: 'Scimago journal link' })
  scimagoLink: string;

  @ApiProperty({ description: 'Bioxbio link', required: false, nullable: true })
  bioxbio: BioxBio[] | undefined;

  @ApiProperty({ description: 'Journal image URL' })
  Image: string | undefined;

  @ApiProperty({ description: 'Image context URL' })
  Image_Context: string | undefined;

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
    type: SubjectAreaAndCategory,
  })
  'Subject Area and Category': SubjectAreaAndCategory;

  [key: string]: any;

  @ApiProperty({ description: 'ISSN number (duplicate)' })
  ISSN: string;

  @ApiProperty({ description: 'Journal information', type: Information })
  Information: Information | undefined;

  @ApiProperty({ description: 'Journal scope' })
  Scope: string | undefined;

  @ApiProperty({
    description: 'Supplementary table entries',
    type: [SupplementaryTableEntry],
  })
  SupplementaryTable: SupplementaryTableEntry[];

  @ApiProperty({ description: 'Thumbnail HTML' })
  Thumbnail: string;
}

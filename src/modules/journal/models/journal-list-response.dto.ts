/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ApiProperty } from '@nestjs/swagger';
import { Prisma } from 'generated/prisma_client';

export class SubjectAreaAndCategoryDto {
  @ApiProperty({ description: 'Field of Research' })
  'Field of Research': string;

  @ApiProperty({ description: 'Topics', type: [String] })
  Topics: string[];
}

export class JournalStatisticsDto {
  @ApiProperty({ description: 'category name' })
  category: string | null;

  @ApiProperty({ description: 'statistic' })
  statistic: string | null;
}

export class InformationDto {
  @ApiProperty({ description: 'Journal homepage URL' })
  Homepage: string;

  @ApiProperty({ description: 'How to publish in this journal' })
  'How to publish in this journal': string;

  @ApiProperty({ description: 'Contact email' })
  Mail: string;

  constructor(
    dbInstance: Prisma.JournalAuthorInformationsGetPayload<Prisma.JournalAuthorInformationsDefaultArgs>,
  ) {
    this.Homepage = dbInstance?.homePage || '';
    this['How to publish in this journal'] = dbInstance?.instruction || '';
    this.Mail = dbInstance?.mail || '';
  }
}

export class BioxBioDto {
  @ApiProperty({ description: 'Year' })
  Year: number | null;

  @ApiProperty({ description: 'Impact factor' })
  Impact_factor: number | null;
}

export class SupplementaryTableEntryDto {
  @ApiProperty({ description: 'Category name' })
  Category: string | null;

  @ApiProperty({ description: 'Year' })
  Year: string | null;

  @ApiProperty({ description: 'Quartile (Q1-Q4)' })
  Quartile: string | null;
}

export class JournalListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Scimago journal link' })
  scimagoLink: string | null;

  @ApiProperty({
    description: 'Bioxbio data',
    type: [BioxBioDto],
    nullable: true,
  })
  bioxbio: (BioxBioDto | null)[] | null;

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
  Categories: (string | null)[];

  @ApiProperty({ description: 'Areas' })
  Areas: string;

  @ApiProperty({
    description: 'Subject area and category',
    type: SubjectAreaAndCategoryDto,
  })
  'Subject Area and Category': SubjectAreaAndCategoryDto;

  @ApiProperty({ description: 'ISSN number (duplicate)' })
  ISSN: string;

  @ApiProperty({ description: 'Journal image URL' })
  hIndex: number;

  @ApiProperty({ description: 'Journal information', type: InformationDto })
  Information: InformationDto | null;

  @ApiProperty({ description: 'Journal scope', required: false })
  Scope?: string;

  @ApiProperty({ description: 'Additional information', required: false })
  'Additional Info'?: string;

  @ApiProperty({
    description: 'Supplementary table entries',
    type: [SupplementaryTableEntryDto],
  })
  SupplementaryTable: SupplementaryTableEntryDto[];

  @ApiProperty({
    description: 'Journal statistics',
    type: [JournalStatisticsDto],
  })
  Statistics: JournalStatisticsDto[];

  @ApiProperty({ description: 'Thumbnail HTML' })
  Thumbnail: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(dbInstance: Prisma.JournalsGetPayload<JournalListItemInclude>) {
    this.id = dbInstance.id;
    this.Title = dbInstance.title;
    this.Type = dbInstance.type;
    this.Issn = dbInstance.issn;
    this.Publisher = dbInstance.publisher;
    this.Country = dbInstance.country;
    this.Region = dbInstance.region;
    this.updatedAt = dbInstance.updatedAt;
    this.createdAt = dbInstance.createdAt;
    this.hIndex = dbInstance.JournalDetails[0]?.hIndex || 0;
    this.Statistics = dbInstance.JournalStatistics.map((stat) => ({
      category: stat.category,
      statistic: stat.statistic,
    }));
    this.Image = dbInstance.JournalDetails[0]?.image || '';
    this.Image_Context = dbInstance.JournalDetails[0]?.imageContent || '';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.scimagoLink = dbInstance.JournalDetails
      ? dbInstance.JournalDetails[0]?.scrimagoLink
      : '';

    this.SJR = dbInstance.JournalDetails[0]?.sjr || 0;
    this.Overton = dbInstance.JournalDetails[0]?.overton || 0;
    this.SDG = dbInstance.JournalDetails[0]?.sdg || 0;
    this.Coverage = dbInstance.JournalDetails[0]?.coverage || '';

    this.Categories = dbInstance.quartiles.map((q) => q.category);

    this.Scope = dbInstance.JournalDetails[0]?.scope || '';

    this.Information = dbInstance.JournalAuthorInformations
      ? new InformationDto(dbInstance.JournalAuthorInformations[0])
      : null;
    this.SupplementaryTable = dbInstance.quartiles.map((entry) => ({
      Category: entry.category,
      Year: entry.year,
      Quartile: entry.quartile,
    }));

    this.bioxbio = dbInstance.JournalBioxBio.map((biox) => ({
      Year: biox.year,
      Impact_factor: biox.impactFactor,
    }));
    this.Thumbnail = dbInstance.JournalAuthorInformations[0]?.thumbnail || '';

    this.Areas = dbInstance.JournalAreas.map((area) => area.name).join(', ');

    this.Rank = dbInstance.JournalDetails[0]?.rank || '';
  }
}

export type JournalListItemInclude = {
  include: {
    JournalTopics: true;
    JournalStatistics: true;
    JournalDetails: true;
    quartiles: true;
    JournalAuthorInformations: true;
    JournalBioxBio: true;
    JournalAreas: true;
  };
};

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

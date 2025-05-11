export class CreateJournalDto {
  title: string;
  sourceId: string;
  scimagoLink?: string;
  image?: string;
  imageContext?: string;
  rank?: number;
  type?: string;
  issn?: string;
  sjr?: number;
  sjrBestQuartile?: string;
  hIndex?: number;
  totalDocs2023?: number;
  totalDocs3Years?: number;
  totalRefs?: number;
  totalCites3Years?: number;
  citableDocs3Years?: number;
  citesPerDoc2Years?: number;
  refsPerDoc?: number;
  femalePercentage?: number;
  overton?: number;
  sdg?: number;
  country?: string;
  region?: string;
  publisher?: string;
  coverage?: string;
  scope?: string;
  homepage?: string;
  howToPublish?: string;
  email?: string;
  categories: Array<{
    name: string;
    quartile: string;
    year: number;
  }>;
  fields: Array<{
    name: string;
  }>;
} 
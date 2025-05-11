import { Prisma } from 'generated/prisma_client';
import { SortField, SortOrder } from '../journal-request/get-journal-params';

export type JournalWhereInput = Prisma.JournalsWhereInput;
export type JournalSelect = Prisma.JournalsSelect;
export type JournalOrderByWithRelationInput =
  Prisma.JournalsOrderByWithRelationInput;

export interface JournalFilter {
  search?: string;
  publisher?: string;
  country?: string;
  region?: string;
  type?: string;
  categories?: string[];
  fields?: string[];
}

export interface JournalPagination {
  page: number;
  perPage: number;
}

export interface JournalSort {
  sortBy: SortField;
  sortOrder: SortOrder;
}

export interface JournalQueryOptions {
  filter: JournalFilter;
  pagination: JournalPagination;
  sort: JournalSort;
}

export interface JournalResponse {
  id: string;
  title: string;
  issn: string;
  hIndex: string;
  publisher: string;
  country: string;
  scimagoLink: string;
  sjr: string;
  scope: string;
  emailSubmission: string;
  totalDocs: string;
  totalDocs3Years: string;
  totalRefs: string;
  totalCites3Years: string;
  citableDocs3Years: string;
  citesPerDoc2Years: string;
  refsPerDoc: string;
  percentFemale: string;
  overton: string;
  sdg: string;
  region: string;
  coverage: string;
  categories: string;
  areas: string;
  homepage: string;
  howToPublish: string;
  mail: string;
  createdAt: Date;
  updatedAt: Date;
} 
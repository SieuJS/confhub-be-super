import { ApiProperty } from '@nestjs/swagger';

export class ConferenceLocationDTO {
  @ApiProperty()
  address: string;

  @ApiProperty()
  cityStateProvince: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  continent: string;
}

export class ConferenceDateDTO {
  @ApiProperty()
  type: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;
}

export class ConferenceOrganizationDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  year: number;

  @ApiProperty()
  accessType: string;

  @ApiProperty()
  isAvailable: boolean;

  @ApiProperty()
  publisher: string;

  @ApiProperty()
  summerize: string;

  @ApiProperty()
  callForPaper: string;

  @ApiProperty()
  link: string;

  @ApiProperty()
  cfpLink: string;

  @ApiProperty()
  impLink: string;

  @ApiProperty({ type: [ConferenceLocationDTO] })
  locations: ConferenceLocationDTO[];

  @ApiProperty({ type: [String] })
  topics: string[];

  @ApiProperty({ type: [ConferenceDateDTO] })
  dates: ConferenceDateDTO[];
}

export class AdminConferenceDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  acronym: string;

  @ApiProperty({ isArray: true })
  sources: string[];

  @ApiProperty({ isArray: true })
  researchFields: string[];

  @ApiProperty()
  ranks: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  status: string;

  @ApiProperty()
  link?: string;

  @ApiProperty()
  impLink?: string;

  @ApiProperty()
  cfpLink?: string;

  @ApiProperty({ type: [ConferenceOrganizationDTO] })
  organizationHistory: ConferenceOrganizationDTO[];
}

export class AdminConferenceParams {
  @ApiProperty({ required: false })
  search: string;

  @ApiProperty({ isArray: true, required: false })
  status: string[];

  @ApiProperty({ isArray: true, required: false })
  source: string[];

  @ApiProperty({ isArray: true, required: false })
  researchFields: string[];

  @ApiProperty({ isArray: true, required: false })
  ranks: string[];
}

export const AdminConferenceDefaultParams = {
  search: '',
  status: [],
  source: [],
  researchFields: [],
  ranks: [],
};

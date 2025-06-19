import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';
import { ConferenceDTO } from '../conference/conference.dto';

import { LocationInput } from 'src/modules/conference-organization/models/location/location.input';

import { ConferenceDateInput } from 'src/modules/conference-organization/models/date/conferencer-date.input';

class ConferenceRequestBody extends PickType(ConferenceDTO, [
  'acronym',
  'title',
]) {}

class ConferenceRequestLocation extends OmitType(LocationInput, [
  'organizeId',
]) {}

class ConferenceRequestDate extends OmitType(ConferenceDateInput, [
  'organizedId',
]) {}

export class AddConferenceBody extends ConferenceRequestBody {
  @ApiProperty({
    description: 'Location information',
    type: LocationInput,
  })
  location: ConferenceRequestLocation;

  @ApiProperty({
    description: 'Dates information',
    type: ConferenceRequestDate,
    isArray: true,
  })
  dates: ConferenceDateInput[];

  @ApiProperty({
    description: 'Topics information',
    isArray: true,
  })
  topics: string[];

  @ApiProperty({
    description: 'Access type',
  })
  type: string;

  @ApiProperty({
    description: 'link to the conference',
    type: String,
  })
  link: string;

  @ApiProperty({
    description: 'link to the cfp',
    type: String,
  })
  cfpLink: string;

  @ApiProperty({
    description: 'link to the imp',
    type: String,
  })
  impLink: string;

  @ApiProperty({ description: 'User id ' })
  userId: string;

  @ApiProperty({
    description: 'Conference description',
    example: 'This is a conference about AI and ML',
  })
  summarize: string;

  @ApiProperty({
    description: 'Call for paper',
    example: 'This is a call for paper for the conference',
    required: false,
    type: String,
  })
  callForPaper?: string;
}

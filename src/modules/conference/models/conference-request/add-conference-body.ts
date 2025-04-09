import { ApiProperty, PickType } from "@nestjs/swagger";
import { ConferenceDTO } from "../conference/conference.dto";
import { OrganizedDTO } from "src/modules/conference-organization/models/organize/organized.dto";
import { LocationInput } from "src/modules/conference-organization/models/location/location.input";
import { OrganizedInput } from "src/modules/conference-organization/models/organize/organized.input";
import { ConferenceDateInput } from "src/modules/conference-organization/models/date/conferencer-date.input";

class ConferenceRequestBody  extends PickType(ConferenceDTO, [
    'acronym',
    'title',
    'creatorId'
]) {}


class ConferenceRequestDates extends PickType(ConferenceDTO, [
    'dates'
]) {}

class ConferenceRequestOrganization extends OrganizedDTO {}

export class AddConferenceBody {
    @ApiProperty({
        description : "Conference information",
        type : ConferenceRequestBody
    })
    conference: ConferenceRequestBody;

    @ApiProperty({
        description : "Location information",
        type : LocationInput
    })
    location: LocationInput;

    @ApiProperty({
        description : "Dates information",
        type : ConferenceDateInput
    })
    dates: ConferenceDateInput[];

    @ApiProperty({
        description : "Organization information",
        type : OrganizedInput
    })
    organization: ConferenceRequestOrganization;


    @ApiProperty({
        description : "Research fields",
        example : "AI" ,
    })
    researchFields: string;

    @ApiProperty({
        example : "A" , 
    })
    rank: string;
    @ApiProperty({description : "Source of conference"})
    source: string;

    @ApiProperty({description : "User id "})
    userId: string;
}
import { ApiProperty } from "@nestjs/swagger";
import { ConferenceFilter } from "../conference-filter/conference.filter";

export class GetConferencesParams extends ConferenceFilter {
    @ApiProperty({
        description : "The page number",
        required : false
    })
    page? : number;

    @ApiProperty({
        description : "The page size",
        required : false
    })
    perPage? : number;
}
import { ApiProperty } from "@nestjs/swagger";

export class ConferenceLocation {
    @ApiProperty({
        description : "country of conference location",
        example : "Paris"
    })
    country? : string | null

    @ApiProperty ({
        description : "City of conference location",
        example : "Paris"
    })
    cityStateProvince? : string | null

    @ApiProperty({
        description : "continent of conference location",
        example : "LA"
    })
    continent? : string | null

    @ApiProperty({
        description : "Full location", 
        example : "Paris, LA, France"
    })
    address : string | null
}
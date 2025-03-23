import { ApiProperty } from "@nestjs/swagger";

export class ConferenceRankDTO {
    @ApiProperty({
        description : "The conference rank",
        required : true
    })
    rank : string;

    @ApiProperty({
        description : "The rank source",
        required : true
    })
    source : string


    @ApiProperty({
        description : "The field of research",
        required : true
    })
    fieldOfResearch : string;

    
}
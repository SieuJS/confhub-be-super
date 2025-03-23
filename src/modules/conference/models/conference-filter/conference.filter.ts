import { ApiProperty, PartialType } from "@nestjs/swagger";

export class ConferenceFilter {
    @ApiProperty({
        description : "The conference name",
        required : false,
        default : ""
    })
    title? : string; 

    @ApiProperty({
        description : "The conference acronym",
        required : false,
        default : ""
    })
    acronym? : string;

    @ApiProperty({
        description : "The conference start date",
        required : false,
    })
    fromDate? : string;

    @ApiProperty({
        description : "The conference end date",
        required : false,
    })
    toDate? : string;

    @ApiProperty({
        description : "The topics of the conference",
        required : false,
        isArray : true,
    })
    topics? : string[]; 

    @ApiProperty({
        description : "The city of conference", 
        required : false
    })
    cityStateProvince? : string;

    @ApiProperty({
        description : "The country of conference",
        required : false
    })
    country? : string;

    @ApiProperty({
        description : "The conference continent",
        required : false
    })
    continent? : string;

    @ApiProperty({
        description : "The address of conference",
        required : false
    })
    address? : string;

    @ApiProperty({
        description : "The field of researches" , 
        required : false,
        isArray : true
    })
    researchFields? : string[];

    @ApiProperty({
        description : "The confeerence rank" , 
        required : false
    })
    rank? : string; 

    @ApiProperty({
        description : "The conference source",
        required : false
    })
    source? : string;

    @ApiProperty({
        description : "The conference type",
        required : false
    })
    accessType? : string;

    @ApiProperty({
        description : "The conference publisher",
        required : false
    })
    publisher? : string;

    @ApiProperty({
        description : "Sort by",
        required : false
    })
    sortBy? : 'date' | 'rank' | 'name' | 'submissionDate' | 'startDate' | 'endDate';

    @ApiProperty({
        description : "Sort order",
        required : false
    })
    sortOrder? : 'asc' | 'desc';

    @ApiProperty({ 
        description : "The start date of conference",
        required : false
    })
    startDate : string;

    @ApiProperty({
        description : "The end date of conference",
        required : false
    })
    endDate : string;

    @ApiProperty({
        description : "type of conference",
        required : false
    })
    type : string;

    @ApiProperty({
        description : "keyword",
        required : false
    })
    keyword : string;

}


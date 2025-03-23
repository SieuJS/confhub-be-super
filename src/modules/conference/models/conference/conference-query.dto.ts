import { ApiProperty, PickType } from "@nestjs/swagger";
import { ConferenceDTO } from "./conference.dto";

export class ConferenceQueryDto extends PickType(ConferenceDTO, [
    "title",
    "acronym",
    "source",
    "rank",
    "year",
    "researchFields",
])  {
    @ApiProperty({ description: "From Date", type: Date, required: false })
    fromDate: Date;

    @ApiProperty({ description: "To Date", type: Date, required: false })
    toDate: Date;

    @ApiProperty({description : "Page Number", type : Number, required : false})
    page : number

    @ApiProperty({description : "Items per page", type : Number, required : false})
    perPage : number

}
 
import { ApiProperty } from "@nestjs/swagger"

export class ConferenceImportResponseDTO {
    @ApiProperty(
        {
            description : "The id of the job",
            example : "odfewoewr-ewrwer-ewrwer",
            required : true
        },
    )
    crawlJobId : string

    @ApiProperty(
        {
            description : "The id of the conference",
            example : "odfewoewr-ewrwer-ewrwer",
            required : true
        },
    )
    conferenceId : string 

    @ApiProperty(
        {
            description : 'conference exists or not',
            example : true,
            required : true
        }
    ) 
    isExists : boolean

    @ApiProperty(
        {
            description : "Channel socket",
            example : "conference",
        }
    )
    channel : string
}
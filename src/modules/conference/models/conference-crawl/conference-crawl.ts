import { ApiProperty } from "@nestjs/swagger";

export class ConferenceCrawlInputDTO {
    @ApiProperty(
        {
            description : "The id of the conference to crawl",
            example : "odfewoewr-ewrwer-ewrwer",
            required : true
        },
    )
    conferenceId : string 

    @ApiProperty(
        {
            description : "The mode of the crawl",
            example : "NEW",
            required : true,
            enum : ["NEW", "UPDATE"]
        }
    ) 
    mode : "NEW" | "UPDATE"
}
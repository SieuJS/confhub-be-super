import { ApiProperty } from "@nestjs/swagger"

export class ConferenceCrawlUpdateRequestDto {
    @ApiProperty()
    Title : string

    @ApiProperty()
    Acronym : string

    @ApiProperty()
    mainLink : string 

    @ApiProperty()
    cfpLink : string

    @ApiProperty()
    impLink : string
}
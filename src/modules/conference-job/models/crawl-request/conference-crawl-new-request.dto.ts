import { ApiProperty } from "@nestjs/swagger";

export class ConferenceCrawlNewRequestDto {
    @ApiProperty()
    Title : string

    @ApiProperty()
    Acronym : string
}
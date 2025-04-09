import { ApiNotImplementedResponse, ApiProperty } from "@nestjs/swagger";

export class ConferenceDatesDTO {

    @ApiProperty({description : "Name of conference date", example : '123e4567-e89b-12d3-a456-426614174000'})
    type : string

    @ApiProperty({description : "Name of conference date", example : 'Submission date'})
    name : string

    @ApiProperty({description : "From date", example : '2021-01-01T00:00:00.000Z'})
    fromDate : Date | null

    @ApiProperty({description : "To date", example : '2021-01-01T00:00:00.000Z'})
    toDate : Date | null

    @ApiProperty({
        description : "Created at",
        example : '2021-01-01T00:00:00.000Z'
    })
    createdAt : Date | null

    @ApiProperty({
        description : "Updated at",
        example : '2021-01-01T00:00:00.000Z'
    })
    updatedAt : Date | null

}
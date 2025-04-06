import { ApiProperty } from "@nestjs/swagger";

export class ConferenceDateDTO {
    @ApiProperty()
    id : string

    @ApiProperty()
    organizedId : string

    @ApiProperty()
    fromDate : Date | null

    @ApiProperty()
    toDate : Date | null

    @ApiProperty() 
    type : string

    @ApiProperty()
    name : string

    @ApiProperty()
    createdAt : Date

    @ApiProperty()
    updatedAt : Date

    @ApiProperty()
    isAvailable : boolean
}
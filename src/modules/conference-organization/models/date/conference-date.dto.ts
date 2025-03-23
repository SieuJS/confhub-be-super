import { ApiProperty } from "@nestjs/swagger";

export class ConferenceDateDTO {
    @ApiProperty()
    id : string

    @ApiProperty()
    organizedId : string

    @ApiProperty()
    fromDate : Date

    @ApiProperty()
    toDate : Date 

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
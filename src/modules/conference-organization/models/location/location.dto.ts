import { ApiProperty } from "@nestjs/swagger";

export class LocationDTO {
    @ApiProperty( {
        example : "2321424-234234-234234",
    })
    id : string

    @ApiProperty({
        example : "Colisten, Paris, France"
    })
    address : string 

    @ApiProperty({
        example : "Paris"
    })
    cityStateProvince : string

    @ApiProperty({
        example : "France"
    })
    country : string

    @ApiProperty({
        example : "Eroupe"
    })
    continent : string

    @ApiProperty({
        description : "The created date of the location",
        example : "2021-09-09T00:00:00.000Z"
    })
    createdAt : Date

    @ApiProperty({
        description : "The updated date of the location",
        example : "2021-09-09T00:00:00.000Z"
    })
    updatedAt : Date

    @ApiProperty({
        description : "Is available or not",
        example : true
    })
    isAvailable : boolean

    @ApiProperty({
        description : "Organization id",
        example : "234234-234234-234234"
    })
    organizeId : string

    
}
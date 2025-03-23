import { ApiProperty } from "@nestjs/swagger";
import { Sources } from "@prisma/client";
export class SourceDTO {

    @ApiProperty(
        {
            description : 'The id of the source',
            required : true,
            type :  String,
            example : "123jl1j23-123j1j23-123j1j23"
        }
    )
    id : string ;

    @ApiProperty(
        {
            description : 'The name of the source',
            required : true,
            type : 'string',
            example : 'Google'
        }
    ) 
    name : string ; 

    @ApiProperty(
        {
            description : 'The link of the source',
            required : false,
            type : 'string',
            example : 'https://www.google.com'
        }
    )
    link : string | null; 

    constructor (sourceDB : Sources) {
        this.id = sourceDB.id;
        this.name = sourceDB.name;
        this.link = sourceDB.link;
    }
}

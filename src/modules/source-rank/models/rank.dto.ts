import { ApiProperty } from "@nestjs/swagger";
import { SourceDTO } from "./source.dto";
import { Ranks } from "@prisma/client";

export class RankDTO {

    @ApiProperty(
        {
            description : 'The id of the rank',
            required : true,
            type :  String,
            example : "123jl1j23-123j1j23-123j1j23"
        }
    )
    id : string ;

    @ApiProperty(
        {
            description : 'The name of the rank',
            required : true,
            type : 'string',
            example : 'Google'
        }
    ) 
    name : string ; 

    @ApiProperty(
        {
            description : 'The value of the rank',
            required : true,
            type : 'number',
            example : 1
        }
    )
    value : number ;
    
    @ApiProperty(
        {
            description : 'The source of the rank',
            required : true,
            type : SourceDTO,
            example : 'Google'
        }
    )
    source : SourceDTO ; 
    constructor (rankDB : Ranks){
        this.id = rankDB.id;
        this.name = rankDB.name;
        this.value = rankDB.value;
    }
}
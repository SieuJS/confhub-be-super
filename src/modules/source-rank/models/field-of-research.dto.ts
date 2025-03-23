import { ApiProperty } from "@nestjs/swagger";
import { FieldOfResearchs } from "@prisma/client";
import { IsUUID } from "class-validator";

export class FieldOfResearchDTO {
    @ApiProperty(
        {
            description : "Field of Research ID",
            required : true,
            type : String,
            example : "123jl1j23-123j1j23-123j1j23"
        }
    )
    @IsUUID()
    id : string ;

    @ApiProperty(
        {
            description : "Field of Research Name",
            required : true,
            type : String,
            example : "Computer Science"
        }
    )
    name : string ;

    @ApiProperty({
        description : "Code of the field of research",
        required : true,
        type : String,
        example : "CS"
    })
    code : string ;

    constructor (fieldOfResearchDB : FieldOfResearchs) {
        this.id = fieldOfResearchDB.id;
        this.name = fieldOfResearchDB.name;
        this.code = fieldOfResearchDB.code;
    }
}
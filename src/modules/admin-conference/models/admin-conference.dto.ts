import { ApiProperty } from "@nestjs/swagger";
import { array } from "joi";

export class AdminConferenceDTO {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title : string ; 

    @ApiProperty()
    acronym : string ;

    @ApiProperty({isArray : true})
    sources : string[] ;

    @ApiProperty({isArray : true})
    researchFields : string[] ;

    @ApiProperty()
    ranks : string[] ;

    @ApiProperty()
    createdAt : Date ;

    @ApiProperty()
    updatedAt : Date ;

    @ApiProperty()
    status : boolean ;
    
}

export class AdminConferenceParams {
    @ApiProperty({required : false}) 
    search : string ; 

    @ApiProperty({isArray : true, required : false})
    status : string[];

    @ApiProperty({isArray : true, required : false}) 
    source : string[] ;

    @ApiProperty({isArray : true, required : false})
    researchFields : string[] ;

    @ApiProperty({isArray : true, required : false})
    ranks : string[] ;
}

export const AdminConferenceDefaultParams = {
    search : '',
    status : [],
    source : [],
    researchFields : [],
    ranks : [],
}
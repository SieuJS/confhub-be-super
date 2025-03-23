import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class UserDTO {
    @ApiProperty(
        {
            description : "The id of the user",
            example : "721ccd26-2f72-4623-9bae-27fd3a0f2834"
        }
    ) 
    id : string ; 

    @ApiProperty(
        {
            description : "The email of the user",
            example : "admin@admin.com" 
        }
    )
    @IsEmail() 
    email : string ;

    @ApiProperty({
        description : "The password of the user",
        example : "admin"
    })
    password : string ;

    @ApiProperty({
        description : "The role of the user",
        example : "admin"
    })
    role : string ;

    @ApiProperty({
        description : "The createdAt of the user",
        example : new Date()
    })
    createdAt : Date ;

    @ApiProperty({
        description : "The updatedAt of the user",
        example : new Date()
    })
    updatedAt : Date ;

    @ApiProperty({
        description : "The first name", 
        example : "John"
    })
    firstName : string ;

    @ApiProperty({
        description : "The last name",
        example : "Doe"
    })
    lastName : string ;

    @ApiProperty({
        description : "The date of birth",
        example : new Date()
    })
    dob : Date ;
}
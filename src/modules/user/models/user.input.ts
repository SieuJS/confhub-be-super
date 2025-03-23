import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, Length, MaxLength, MinLength } from "class-validator";

export class UserInput {
    @Length(3, 20)
    @ApiProperty({
        description : "The user's name",
        required : true
    })
    firstname : string; 

    @Length(3, 20)
    @ApiProperty({
        description : "The user's last name",
        required : true})
    lastname : string;


    @IsEmail()
    @ApiProperty({
        description : "The user's email",
        required : true
    })
    email : string;

    @MinLength(6)
    @MaxLength(8)
    @ApiProperty({
        description : "The user's password",
        required : true
    })
    password : string;
}

export class UserSigninInput {
    @ApiProperty({
        description : "The user's email",
        required : true
    })
    @IsEmail()
    email : string;

    @ApiProperty({
        description : "The user's password",
        required : true
    })
    @MinLength(6)
    password : string;
}
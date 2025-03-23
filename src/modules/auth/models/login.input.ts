import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class LoginInput {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        example: 'username',
    })
    username: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({
        example: 'password',
    })
    password: string;
}
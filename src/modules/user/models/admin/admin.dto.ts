import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, Length } from "class-validator";

export class AdminDto {
    @ApiProperty({ example: "e39896e7-e626-4800-be38-88073135a298", description: "Admin ID" })
    id: string;

    @ApiProperty({description : "Admin email", example : "admin@admin"})
    @IsEmail()
    email: string;

    @ApiProperty({description : "Admin password", example : "adminpassword"})
    @Length(6, 20)
    password: string;

    @ApiProperty({description : "Admin full name", example : "Admin"})
    @Length(3, 50)
    fullName: string;

    @ApiProperty({description : "Admin created at", example : "2023-10-01T00:00:00Z"})
    createdAt: Date;

    @ApiProperty({description : "Admin updated at", example : "2023-10-01T00:00:00Z"})
    updatedAt: Date;

    constructor(partial: Partial<AdminDto>) {
        Object.assign(this, partial);
    }
}
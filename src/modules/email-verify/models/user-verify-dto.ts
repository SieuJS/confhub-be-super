import { ApiProperty } from "@nestjs/swagger";

export class UserVerifyDTO {
    @ApiProperty({description : "Id of user" , example : "123e4567-e89b-12d3-a456-426614174000"})
    id: string;

    @ApiProperty({description : "Id of user who created the verify" , example : "123e4567-e89b-12d3-a456-426614174000"})
    userId: string;

    @ApiProperty({description : "Verifycation code " , example : "123-321"})
    code: string;

    @ApiProperty({description : "Is the code verified" , example : true})
    isVerified: boolean;
    @ApiProperty({description : "Created at", example : "2021-01-01T00:00:00.000Z"})
    createdAt: Date;
    @ApiProperty({description : "Updated at", example : "2021-01-01T00:00:00.000Z"})
    updatedAt: Date;
}
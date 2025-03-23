import { ApiProperty } from "@nestjs/swagger";
import { UserPublicDTO } from "../../../user/models/user-public.dto";

export class ConferenceFeedBackDTO {
    @ApiProperty({description : "Id of feedback" , example : "123e4567-e89b-12d3-a456-426614174000"})
    id: string;

    @ApiProperty({description : "Id of conference" , example : "123e4567-e89b-12d3-a456-426614174000"})
    conferenceId: string;

    @ApiProperty({description : "Id of user who gave feedback" , example : "123e4567-e89b-12d3-a456-426614174000"})
    creatorId: string;

    @ApiProperty({description : "Infomation of user", type : UserPublicDTO})
    user: UserPublicDTO;

    @ApiProperty({description : "Content of feedback" , example : "This is a feedback"})
    description: string;

    @ApiProperty({description : "Rating of feedback" , example : 5})
    star : number;

    @ApiProperty({description : "Created at", example : "2021-01-01T00:00:00.000Z"})
    createdAt: Date;

    @ApiProperty({description : "Updated at", example : "2021-01-01T00:00:00.000Z"})
    updatedAt: Date;
}

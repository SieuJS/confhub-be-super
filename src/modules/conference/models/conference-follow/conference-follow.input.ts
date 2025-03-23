import { ApiProperty } from "@nestjs/swagger";

export class ConferenceFollowInput {
    @ApiProperty({description : "Id of conference"})
    conferenceId: string;

    @ApiProperty({description : "Id of user"})
    userId: string;
}

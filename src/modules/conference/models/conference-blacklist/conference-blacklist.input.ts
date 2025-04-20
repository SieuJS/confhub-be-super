import { ApiProperty } from "@nestjs/swagger";

export class ConferenceBlacklistInput {
    @ApiProperty({description : "Id of conference"})
    conferenceId: string;

}

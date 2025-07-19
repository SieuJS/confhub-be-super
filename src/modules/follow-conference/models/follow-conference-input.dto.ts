import { ApiProperty } from '@nestjs/swagger';

export class FollowConferenceInputDto {
  @ApiProperty({
    description: 'The ID of the user who is following the conference',
    example: 1,
  })
  conferenceId: string;
}

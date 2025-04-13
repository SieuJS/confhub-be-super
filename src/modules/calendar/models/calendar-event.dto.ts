import { ApiProperty } from '@nestjs/swagger';

export class CalendarEvent {
  @ApiProperty({
    description: 'The day of the event',
    type: Number,
    example: 15,
  })
  day: number | undefined;

  @ApiProperty({
    description: 'The month of the event',
    type: Number,
    example: 10,
  })
  month: number | undefined; // 1-indexed (January is 1, December is 12)
  @ApiProperty({
    description: 'The year of the event',
    type: Number,
    example: 2023,
  })
  year: number | undefined;
  @ApiProperty({
    description: 'The type of event',
    required: false,
    type: String ,
    example: 'Conference',
  })
  type: string | undefined;
  @ApiProperty({
    description: 'The conference name',
    type: String,
    example: 'International Conference on AI',
  })
  conference: string | undefined;

  @ApiProperty({
    description: 'The conference ID',
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  conferenceId : string | undefined; // Add conferenceId for easier lookup
}

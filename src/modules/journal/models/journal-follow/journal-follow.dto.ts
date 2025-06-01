import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class JournalFollowDto {
  @ApiProperty({
    description: 'Journal ID to follow',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  journalId: string;
}

export class JournalFollowByDto {
  @ApiProperty({
    description: 'User ID who follows the journal',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class JournalFollowInput {
  @IsString()
  @IsNotEmpty()
  journalId: string;
}

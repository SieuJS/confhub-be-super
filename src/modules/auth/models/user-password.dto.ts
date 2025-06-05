import { ApiProperty } from '@nestjs/swagger';
import { MaxLength, MinLength } from 'class-validator';

export class UserPasswordDto {
  @ApiProperty({
    description: "The user's old password",
    required: true,
  })
  @MinLength(6)
  @MaxLength(20)
  oldPassword: string;

  @ApiProperty({
    description: "The user's new password",
    required: true,
  })
  @MinLength(6)
  @MaxLength(20)
  newPassword: string;
}

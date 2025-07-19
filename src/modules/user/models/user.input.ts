import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsEmail, Length, MaxLength, MinLength } from 'class-validator';
import { UserDTO } from './user.dto';

export class UserInput extends OmitType(UserDTO, [
  'id',
  'createdAt',
  'updatedAt',
  'isVerified',
]) {}

export class UserSigninInput {
  @ApiProperty({
    description: "The user's email",
    required: true,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "The user's password",
    required: true,
  })
  @MinLength(6)
  @MaxLength(20)
  password: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEmail, Length, MaxLength, MinLength } from 'class-validator';

export class UserDTO {
  @ApiProperty({
    description: "The user's id",
    required: true,
  })
  id: string;

  @Length(1, 20)
  @ApiProperty({
    description: "The user's name",
    required: true,
  })
  firstName: string;

  @Length(1, 20)
  @ApiProperty({
    description: "The user's last name",
    required: true,
  })
  lastName: string;

  @IsEmail()
  @ApiProperty({
    description: "The user's email",
    required: true,
  })
  email: string;

  @MinLength(6)
  @MaxLength(20)
  @ApiProperty({
    description: "The user's password",
    required: true,
  })
  password: string;

  @ApiProperty({
    description: "The user's date of birth",
    required: true,
  })
  @IsDate()
  dob: Date;

  @ApiProperty({
    description: 'The avatar of the user',
    required: false,
  })
  avatar: string | null;

  @ApiProperty({
    description: 'about me',
    required: true,
  })
  aboutMe: string;

  @ApiProperty({
    description: 'The backgound image',
    required: false,
  })
  background: string;

  @ApiProperty({
    description: 'Is verifycation',
    required: true,
  })
  isVerified: boolean;

  @ApiProperty({
    description: 'The trust credit of the user',
    required: false,
  })
  trustCredit?: number;

  @ApiProperty({
    description: 'The date of creation',
    required: true,
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The date of update',
    required: true,
  })
  updatedAt: Date;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginInput {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'email',
  })
  email: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'password',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'The mode of login', example: 'admin' })
  mode: 'admin' | 'user';
}

import { ApiProperty } from '@nestjs/swagger';

export class AdminUserParams {
  @ApiProperty({ required: false })
  search?: string;

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty({ required: false })
  role?: string;

  @ApiProperty({ required: false })
  startDate?: string;

  @ApiProperty({ required: false })
  endDate?: string;
}

export class AdminUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  avatar?: string;

  @ApiProperty()
  aboutMe?: string;

  @ApiProperty()
  background?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  isBanned: boolean;
}

export class CreateAdminDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  password: string;

  @ApiProperty()
  fullName: string;
}

export class UpdateAdminStatusDto {
  @ApiProperty()
  isActive: boolean;
}

export class BanUserDto {
  @ApiProperty()
  isBanned: boolean;

  @ApiProperty()
  reason?: string;
}

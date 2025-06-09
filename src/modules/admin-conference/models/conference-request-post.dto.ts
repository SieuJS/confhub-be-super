/* eslint-disable */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';

export enum ConferencePostRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ConferencePostRequestDTO {
  @ApiProperty({ description: 'Request ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'Conference ID' })
  @IsUUID()
  conferenceId: string;

  @ApiProperty({ description: 'ID of the user who created the request' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'ID of the admin who approved/rejected the request', required: false })
  @IsUUID()
  @IsOptional()
  adminId?: string | null;

  @ApiProperty({ description: 'Request status', enum: ConferencePostRequestStatus })
  @IsEnum(ConferencePostRequestStatus)
  status: ConferencePostRequestStatus | string;

  @ApiProperty({ description: 'Request message' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Conference information' })
  conference: {
    id: string;
    title: string;
    acronym: string;
  };

  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };

  @ApiProperty({ description: 'Admin information' })
  admin: {
    id: string;
    email: string;
    fullName: string;
  } | null;
}

export class CreateConferencePostRequestDTO {
  @ApiProperty({ description: 'Conference ID' })
  @IsUUID()
  conferenceId: string;

  @ApiProperty({ description: 'Request message' })
  @IsString()
  message: string;
}

export class UpdateConferencePostRequestDTO {
  @ApiProperty({ description: 'Request status', enum: ConferencePostRequestStatus })
  @IsEnum(ConferencePostRequestStatus)
  status: ConferencePostRequestStatus;

  @ApiProperty({ description: 'Request message' })
  @IsString()
  message: string;
}

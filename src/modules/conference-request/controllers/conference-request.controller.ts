import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ConferenceRequestService } from '../services/conference-request.service';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@Controller('user/conference/requests')
@UseGuards(JWTGuardUser)
@ApiBearerAuth('access-token')
export class ConferenceRequestController {
  constructor(
    private readonly conferenceRequestService: ConferenceRequestService,
  ) {}

  @Get('/')
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter requests by user ID',
  })
  async getConferenceRequestById(@Req() req, @Query('status') status?: string) {
    const user = req.user as { id: string };
    const id = user.id;
    return await this.conferenceRequestService.getConferenceRequestsByUserId(
      id,
      status,
    );
  }
}

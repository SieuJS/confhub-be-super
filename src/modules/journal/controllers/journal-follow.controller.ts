/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JournalFollowService } from '../services/journal-follow/journal-follow.service';
import {
  JournalFollowDto,
  JournalFollowByDto,
} from '../models/journal-follow/journal-follow.dto';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';

@ApiTags('Journal Follows')
@Controller('journal-follows')
@UseGuards(JWTGuardUser)
@ApiBearerAuth()
export class JournalFollowController {
  constructor(private readonly journalFollowService: JournalFollowService) {}

  @Post('follow')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Follow a journal' })
  @ApiResponse({ status: 200, description: 'Successfully followed journal' })
  @ApiResponse({ status: 404, description: 'Journal not found' })
  @ApiResponse({ status: 409, description: 'Already following this journal' })
  async followJournal(
    @Req() req,
    @Body() input: JournalFollowDto,
  ): Promise<void> {
    return this.journalFollowService.followJournal(req.user.id, input);
  }

  @Post('unfollow')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Unfollow a journal' })
  @ApiResponse({ status: 200, description: 'Successfully unfollowed journal' })
  @ApiResponse({ status: 404, description: 'Not following this journal' })
  async unfollowJournal(
    @Req() req,
    @Body() input: JournalFollowDto,
  ): Promise<{ message: string }> {
    return this.journalFollowService.unfollowJournal(req.user.id, input);
  }

  @Get('user/')
  @ApiOperation({ summary: 'Get journals followed by a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'List of followed journals retrieved successfully',
  })
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth()
  async getFollowedJournals(@Request() req) {
    return this.journalFollowService.getFollowedJournals(req.user.id);
  }

  @Get('journal/:journalId')
  @ApiOperation({ summary: 'Get followers of a journal' })
  @ApiParam({ name: 'journalId', description: 'Journal ID' })
  @ApiResponse({
    status: 200,
    description: 'List of journal followers retrieved successfully',
  })
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  async getJournalFollowers(@Param('journalId') journalId: string) {
    return this.journalFollowService.getJournalFollowers(journalId);
  }

  @Get('by-user')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get journals followed by user' })
  @ApiResponse({ status: 200, description: 'List of followed journals' })
  async getFollowedJournalsByUser(@Req() req) {
    const userId = req.user.id;
    return this.journalFollowService.getFollowedJournals(userId);
  }

  @Get('followers/:journalId')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get users following a journal' })
  @ApiResponse({ status: 200, description: 'List of journal followers' })
  async getJournalFollowersByJournal(@Body('journalId') journalId: string) {
    return this.journalFollowService.getJournalFollowers(journalId);
  }
}

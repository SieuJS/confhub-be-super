import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Transactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { FeedbackInputDTO } from '../models/feedback.input.dto';
import { FeedbackService } from '../services/feedback.service';
import { JWTGuardUser } from "src/modules/auth/guards/jwt.guard";
import { ApiBearerAuth, ApiBody, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('/feedback')
@Controller('feedback')
export class FeedbackController {
    constructor(
        private readonly feedbackService: FeedbackService,
    ) {}

    @UseGuards(JWTGuardUser)
    @Post()
    @ApiBearerAuth('access-token')
    @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
    @ApiBody({ type: FeedbackInputDTO })
    async createFeedback(@Body() input: FeedbackInputDTO, @Req() req) {
        const userId = req.user.id;
        return await this.feedbackService.createFeedback(input, userId);
    }

    @Get('/:conferenceId')
    @ApiParam({ name: 'conferenceId' })
    async getFeedbackByConferenceId(@Param('conferenceId') conferenceId: string) {
    return await this.feedbackService.getFeedbacksByConferenceId(
        conferenceId,
    );
    }
}

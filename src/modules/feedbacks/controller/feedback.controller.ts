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
import { ConferenceService } from 'src/modules/conference/services/conference.service';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import { JWTGuardUser } from "src/modules/auth/guards/jwt.guard";
import { ApiBearerAuth, ApiBody, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DEFAULT_TYPE } from 'src/modules/notify/constants/default-type';

@ApiTags('/feedback')
@Controller('feedback')
export class FeedbackController {
    constructor(
        private readonly feedbackService: FeedbackService,
        private readonly notificationService: NotificationService,
        private readonly conferenceService: ConferenceService
    ) {}

    @UseGuards(JWTGuardUser)
    @Post()
    @ApiBearerAuth('access-token')
    @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
    @ApiBody({ type: FeedbackInputDTO })
    async createFeedback(@Body() input: FeedbackInputDTO, @Req() req) {
        const userId = req.user.id;
        const conference = await this.conferenceService.getConferenceById(input.conferenceId);
        if (!conference) {
            throw new HttpException('Conference not found', 404);
          }
        const result = this.feedbackService.createFeedback(input, userId);
        const conferenceId = conference.id;
        const notifiConference =
          await this.notificationService.createConferenceNotification(
            {
              userId,
              conferenceId,
              type: DEFAULT_TYPE.CONFERENCE_FOLLOWED,
              message: `You have feedback about the conference ${conference.title}`,
              isDeleted: false,
              isRead: false,
            }
          );
        await this.notificationService.sendNotificationToUser(
          notifiConference,
          userId,
        );
      return result;
    }

    @Get('/:conferenceId')
    @ApiParam({ name: 'conferenceId' })
    async getFeedbackByConferenceId(@Param('conferenceId') conferenceId: string) {
    return await this.feedbackService.getFeedbacksByConferenceId(
        conferenceId,
    );
    }
}

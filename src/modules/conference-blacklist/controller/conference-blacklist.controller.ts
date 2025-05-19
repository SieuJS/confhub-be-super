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
import { ConferenceService } from 'src/modules/conference/services/conference.service';
import { UserService } from 'src/modules/user/services/user.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { ConferenceBlacklistInput } from 'src/modules/conference/models/conference-blacklist/conference-blacklist.input';
import { Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { DEFAULT_TYPE } from 'src/modules/notify/constants/default-type';
import { NotificationService } from 'src/modules/notify/services/notification.service';

@ApiTags('BlacklistConference')
@Controller('blacklist-conference')
export class ConferenceBlacklistController {
  constructor(
    private readonly conferenceService: ConferenceService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  @UseGuards(JWTGuardUser)
  @Post('/add')
  @ApiBearerAuth('access-token')
  @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
  @ApiBody({ type: ConferenceBlacklistInput })
  async addToBlacklist(@Body() input: { conferenceId: string }, @Req() req) {
    const userId = req.user.id;
    const conferenceId = input.conferenceId;
    const result = await this.userService.addToBlacklist(userId, conferenceId);
    try {
      const notifiConference =
        await this.notificationService.createConferenceNotification({
          userId,
          conferenceId,
          type: DEFAULT_TYPE.CONFERENCE_BLACKLISTED,
          message: `You have added the conference ${result.belongsTo.title} to blacklist`,
          isDeleted: false,
          isRead: false,
        });
      await this.notificationService.sendNotificationToUser(
        notifiConference,
        userId,
      );
    } catch (error) {
      console.error(error);
    }
    return result;
  }

  @UseGuards(JWTGuardUser)
  @Post('/remove')
  @ApiBearerAuth('access-token')
  @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
  @ApiBody({ type: ConferenceBlacklistInput })
  async removeFromBlacklist(
    @Body() input: { conferenceId: string },
    @Req() req,
  ) {
    const userId = req.user.id;
    const conferenceId = input.conferenceId;
    const conferenceInfo =
      await this.conferenceService.getConferenceById(conferenceId);
    const result = await this.userService.removeFromBlacklist(
      userId,
      conferenceId,
    );

    if (!result) {
      throw new HttpException('Conference not found', 404);
    }
    try {
      const notifiConference =
        await this.notificationService.createConferenceNotification({
          userId,
          conferenceId,
          type: DEFAULT_TYPE.CONFERENCE_UNBLACKLISTED,
          message: `You have removed the conference ${conferenceInfo?.title} from blacklist`,
          isDeleted: false,
          isRead: false,
        });

      await this.notificationService.sendNotificationToUser(
        notifiConference,
        userId,
      );
    } catch (error) {
      console.error(error);
    }
    const blacklistConference =
      await this.userService.getAddedBlacklistConferences(userId);
    return result;
  }

  @UseGuards(JWTGuardUser)
  @Get('')
  @ApiBearerAuth('access-token')
  async getAddedBlacklistConferences(@Req() req) {
    const userId = req.user.id;
    const results = await this.userService.getAddedBlacklistConferences(userId);

    return results;
  }

  @Get('/:conferenceId')
  @ApiParam({ name: 'conferenceId' })
  async getAddedBlacklistByConferenceId(
    @Param('conferenceId') conferenceId: string,
  ) {
    return await this.conferenceService.getAddedBlacklistByConferenceId(
      conferenceId,
    );
  }
}

import { Transactional } from "@nestjs-cls/transactional";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Body, Controller, HttpException, Post, Req, UseGuards, Get } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { JWTGuardUser } from "src/modules/auth/guards/jwt.guard";
import { ConferenceService } from "src/modules/conference/services/conference.service";
import { DEFAULT_TYPE } from "src/modules/notify/constants/default-type";
import { NotificationService } from "src/modules/notify/services/notification.service";
import { UserService } from "src/modules/user/services/user.service";

@Controller('/follow-conference')
export class FollowConferenceController{
    constructor (
        private readonly conferenceService : ConferenceService,
        private readonly userService : UserService,
        private readonly notificationService : NotificationService
    ) {
        
    }

     @UseGuards(JWTGuardUser)
      @Post('/add')
      @ApiBearerAuth('access-token')
      async followConference(@Body() body: { conferenceId: string }, @Req() req) {
        const userId = req.user.id;
        const conferenceId = body.conferenceId;
        const result = await this.userService.followConference(
          userId,
          conferenceId,
        );
    
        const notifiConference =
          await this.notificationService.createConferenceNotification(
            {
              userId,
              conferenceId,
              type: DEFAULT_TYPE.CONFERENCE_FOLLOWED,
              message: `You have followed the conference with id ${conferenceId}`,
              isDeleted: false,
              isRead: false,
            }
          );
        await this.notificationService.sendNotificationToUser(
          notifiConference,
          userId,
        );
        const followedConference = await this.userService.getFollowedConferencesByUserId(
          userId);
        
        return followedConference
      }
    
      @UseGuards(JWTGuardUser)
      @Post('/remove')
      @ApiBearerAuth('access-token')
      @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
      async unfollowConference(@Body() body: { conferenceId: string }, @Req() req) {
        const userId = req.user.id;
        const conferenceId = body.conferenceId;
        console.log('conferenceId', conferenceId);
        const result = await this.userService.unfollowConference(
          userId,
          conferenceId,
        );
        const notifiConference =
          await this.notificationService.createConferenceNotification(
            {
              userId,
              conferenceId,
              type: DEFAULT_TYPE.CONFERENCE_UNFOLLOWED,
              message: `You have unfollowed the conference with id ${conferenceId}`,
              isDeleted: false,
              isRead: false,
            }
          );
        await this.notificationService.sendNotificationToUser(
          notifiConference,
          userId,
        );
        if (!result) {
          throw new HttpException('Conference not found', 404);
        }
        const followedConference =
          await this.userService.getFollowedConferencesByUserId(userId);
        if (!followedConference) {
          throw new HttpException('Conference not found', 404);
        }
        return followedConference;
      }
    
      @Get('/followed') 
      @UseGuards(JWTGuardUser)
      @ApiBearerAuth('access-token')
      async getNotificationByUserId(@Req() req) {
        const userId = req.user.id;
        const conferences =
          await this.userService.getFollowedConferencesByUserId(userId);
    
        const formated = await Promise.all ( conferences.map((conf) => {
          return this.conferenceService.getConferenceInfo(conf.conferenceId);
        }))
        return formated;
      }
}
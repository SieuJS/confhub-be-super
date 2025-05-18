import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { CalendarService } from '../services/calendar.service';
import { NotificationService } from 'src/modules/notify/services/notification.service';
import { DEFAULT_TYPE } from 'src/modules/notify/constants/default-type';
import { Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { string } from 'joi';

@Controller('/calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly notificationService: NotificationService,
  ) {}

  @Get('/events')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  async getEvents(@Req() req) {
    const userId = req.user.id;
    return this.calendarService.getCalendarEventsByUserId(userId);
  }

  @Post('/add')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  @ApiBody({
    description: 'Conference ID',
    type: string,
  })
  @Transactional<TransactionalAdapterPrisma>({ timeout: 300000 })
  async addEvent(@Req() req, @Body('conferenceId') conferenceId: string) {
    const userId = req.user.id;
    const t = await this.calendarService.addEvent(userId, conferenceId);

    try {
      const notifiConference =
        await this.notificationService.createConferenceNotification({
          userId,
          conferenceId,
          type: DEFAULT_TYPE.CONFERENCE_CALENDAR_ADDED,
          isDeleted: false,
          message: `You have added the conference ${t.belongsTo.title} to your calendar`,
          isRead: false,
        });
      await this.notificationService.sendNotificationToUser(
        notifiConference,
        userId,
      );
    } catch (error) {
      console.error('Error sending notification:', error);
    }
    const events = await this.calendarService.getConferenceCalendarByUserId(userId);
    return events;
  }

  @Post('/remove')
  @UseGuards(JWTGuardUser)
  @ApiBearerAuth('access-token')
  async removeEvent(@Req() req, @Body('conferenceId') conferenceId: string) {
    const userId = req.user.id;
    const t = await this.calendarService.removeEvent(userId, conferenceId);

    try {
      const notifiConference =
        await this.notificationService.createConferenceNotification({
          userId,
          conferenceId,
          type: DEFAULT_TYPE.CONFERENCE_CALENDAR_REMOVED,
          isDeleted: false,
          message: `You have removed the conference  ${t?.belongsTo.title} from your calendar`,
          isRead: false,
        });

      await this.notificationService.sendNotificationToUser(
        notifiConference,
        userId,
      );
    } catch (error) {
      console.error('Error sending notification:', error);
    }
    const events = await this.calendarService.getConferenceCalendarByUserId(userId);
    return events;
  }
}

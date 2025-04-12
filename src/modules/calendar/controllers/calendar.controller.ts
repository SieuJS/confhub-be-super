import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { JWTGuardUser } from "src/modules/auth/guards/jwt.guard";
import { CalendarService } from "../services/calendar.service";

@Controller('/calendar')
export class CalendarController {

    constructor (
        private readonly calendarService : CalendarService
    ){}

    @Get('/events')
    @UseGuards(JWTGuardUser)
    @ApiBearerAuth('access-token')
    async getEvents(@Req() req) {
        const userId = req.user.id
        return this.calendarService.getCalendarEventsByUserId(userId)
    }

    @Put('/add-event')
    @UseGuards(JWTGuardUser)
    @ApiBearerAuth('access-token')
    async addEvent(@Req() req, @Body('conferenceId') conferenceId: string) {
        const userId = req.user.id
        const t = await this.calendarService.addEvent(userId, conferenceId); 
        const events = await this.calendarService.getCalendarEventsByUserId(userId)
        return events;
    }

    @Put('/remove-event')
    @UseGuards(JWTGuardUser)
    @ApiBearerAuth('access-token')
    async removeEvent(@Req() req, @Body('conferenceId') conferenceId: string) {
        const userId = req.user.id
        const t = await this.calendarService.removeEvent(userId, conferenceId); 
        const events = await this.calendarService.getCalendarEventsByUserId(userId)
        return events;
    }
}
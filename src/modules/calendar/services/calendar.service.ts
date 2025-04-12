import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/common";

@Injectable() 
export class CalendarService {
    
    constructor (
        private readonly prismaService: PrismaService
    ){}

    async getCalendarEventsByUserId(userId : string) {
        return await this.prismaService.conferenceCalendars.findMany({
            where : {
                userId : userId
            }
        })
    }

    async addEvent(userId : string, conferenceId : string) {
        return await this.prismaService.conferenceCalendars.create({
            data : {
                userId : userId,
                conferenceId : conferenceId
            }
        })
    }

    async removeEvent(userId : string, conferenceId : string) {
        const event = await this.prismaService.conferenceCalendars.findFirst({
            where : {
                userId : userId,
                conferenceId : conferenceId
            }
        })
        if (!event) {
            return ;
        }
        return await this.prismaService.conferenceCalendars.delete({
            where : {
                id : event.id
            }
        })
    }
}
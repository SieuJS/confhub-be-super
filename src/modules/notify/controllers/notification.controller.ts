import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationService } from "../services/notification.service";
import { JWTGuardUser } from "src/modules/auth/guards/jwt.guard";
import { Req } from "@nestjs/common";


@Controller('/notification')
@ApiTags('notification')
export class NotificationController {
    constructor (
        private readonly notificationService : NotificationService
    ){}

    @Get('/user') 
    @UseGuards(JWTGuardUser)
    async getNotificationByUserId(@Req() req) {
        const userId = req.user.id
        const notifications = await this.notificationService.getNotificationByUserId(userId)
        return notifications.map(notification => this.notificationService.transformNotification({
            id : notification.id,
            message : notification.message,
            isRead : notification.isRead,
            type : notification.belongToNotify.name,
            isDelted : notification.isDeleted,
            conferenceId : notification.conferenceId || "",
            createdAt : notification.createdAt,
            updatedAt : notification.updatedAt,
        }))
    }

    
}
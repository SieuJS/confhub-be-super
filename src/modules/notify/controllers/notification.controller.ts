import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { NotificationService } from "../services/notification.service";
import { JWTGuardUser } from "src/modules/auth/guards/jwt.guard";
import { Req } from "@nestjs/common";
import { NotificationResponseDTO } from "../models/notification-reponse.dto";


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
            userId : userId,
            type : notification.belongToNotify.name || "",
            typeId : notification.belongToNotify.id,
            isDeleted : notification.isDeleted,
            conferenceId : notification.conferenceId || "",
            createdAt : notification.createdAt,
            updatedAt : notification.updatedAt,
        }))
    }

    @Put('mark-all-as-read')
    @UseGuards(JWTGuardUser)
    async markAllAsRead(@Req() req) {
        const userId = req.user.id
        await this.notificationService.markAllAsRead(userId)
        return {
            message : "Mark all as read successfully"
        }
    }

    @Put('/user')
    @UseGuards(JWTGuardUser)
    @ApiBearerAuth('access-token')
    async upDateNotification(@Req() req , @Body('notifications') notifications : NotificationResponseDTO[]) {
        const userId = req.user.id
        const t = Promise.all(notifications.map(async (notify) => (
            await this.notificationService.updateNotification({...notify, userId} )
        )))
    }
}
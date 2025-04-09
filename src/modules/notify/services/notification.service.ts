import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import { notificationDTO } from "../models/notification-dto";
import { NotificationResponseDTO } from "../models/notification-reponse.dto";
@Injectable() 
export class NotificationService {
    constructor(
        private prismaService : PrismaService,
        private txHost : TransactionHost<TransactionalAdapterPrisma>
    ) {}
    
    async getNotificationByUserId(userId : string) {
        return await this.prismaService.notifications.findMany({
            where : {
                userId
            },
            include : {
                belongToNotify : true
            }
        })
    }

    transformNotification(notification : notificationDTO) : NotificationResponseDTO {
        return {
            id : notification.id,
            message : notification.message,
            seenAt : notification.isRead ? notification.updatedAt : null,
            type : notification.type,
            deletedAt : notification.isDelted ? notification.updatedAt : null,
            conferenceId : notification.conferenceId,
            createdAt : notification.createdAt,
            isImportant : !notification.isDelted,
        }
    }
}
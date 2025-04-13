import { ApiProperty, OmitType } from "@nestjs/swagger";
import { NotificationDTO } from "./notification-dto";

export class NotificationInput extends OmitType(NotificationDTO , ['id', 'createdAt', 'updatedAt', 'typeId']) {
}
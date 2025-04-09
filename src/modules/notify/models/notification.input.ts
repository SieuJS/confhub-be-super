import { OmitType } from "@nestjs/swagger";
import { notificationDTO } from "./notification-dto";

export class NotificationInput extends OmitType(notificationDTO , ['id']) {}
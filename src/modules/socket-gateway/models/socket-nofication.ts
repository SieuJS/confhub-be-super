import { NotificationResponseDTO } from 'src/modules/notify/models/notification-reponse.dto';
import { NotificationInput } from 'src/modules/notify/models/notification.input';

export class SocketNotification {
  userId: string;
  payload: NotificationResponseDTO;
  channel: string;
}

export interface INotification {
  id: string;
  userId: string;
  conferenceId: string | null;
  journalId: string | null;
  message: string;
  notificationId: string;
  isImportant: boolean;
  isDeleted: boolean;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationType {
  id: string;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

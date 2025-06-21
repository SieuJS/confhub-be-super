export class NotificationSettingResponseDTO {
  receiveNotifications?: boolean;
  autoAddFollowToCalendar?: boolean;
  notificationWhenConferencesChanges?: boolean;
  upComingEvent?: boolean;
  notificationThroughEmail?: boolean;
  notificationWhenUpdateProfile?: boolean;
  notificationWhenFollow?: boolean;
  notificationWhenAddTocalendar?: boolean;
  notificationWhenAddToBlacklist?: boolean;

  constructor() {
    this.receiveNotifications = true;
    this.autoAddFollowToCalendar = true;
    this.notificationWhenConferencesChanges = true;
    this.upComingEvent = true;
    this.notificationThroughEmail = true;
    this.notificationWhenUpdateProfile = true;
    this.notificationWhenFollow = true;
    this.notificationWhenAddTocalendar = true;
    this.notificationWhenAddToBlacklist = true;
  }
}

import { ApiProperty } from "@nestjs/swagger";

export class NotificationResponseDTO {
    @ApiProperty({
        description: "Notification id",
        example: "123e4567-e89b-12d3-a456-426614174000"
    })
    id: string;
    @ApiProperty({
        description: "Notification type",
        example: "Conference"
    })
    type: string;
    @ApiProperty({
        description: "Notification message",
        example: "You have a new notification"
    })
    message: string;
    @ApiProperty({
        description: "Notification created date",
        example: "2023-10-01T12:00:00Z"
    })
    createdAt: Date;

    @ApiProperty({
        description: "Notification deleted date",
        example: null
    })
    deletedAt : Date | null;
    @ApiProperty({
        description: "Notification seen date",
        example: null
    })
    seenAt : Date | null;
    @ApiProperty({
        description: "Notification is important",
        example: false
    })
    isImportant: boolean;
    @ApiProperty({
        description: "Conference id",
        example: "123e4567-e89b-12d3-a456-426614174000"
    })
    conferenceId: string;
}
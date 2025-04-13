import { ApiProperty } from "@nestjs/swagger";

export class NotificationDTO { 
    @ApiProperty({
        description : "Notification id",
        example : "123e4567-e89b-12d3-a456-426614174000"
    })
    id: string;

    @ApiProperty({
        description : "Notification type",
        example : "Conference"
    })
    typeId: string | null;

    @ApiProperty({
        description : "Notification type",
        example : "Conference"
    })
    type: string;

    @ApiProperty({
        description : "User id",
        example : "New Conference"
    })
    userId: string;

    @ApiProperty({
        description : "Notification message",
        example : "You have a new notification"
    })
    message: string;

    @ApiProperty({
        description : "Conference id",
        example : "123e4567-e89b-12d3-a456-426614174000"
    })
    conferenceId: string | null;

    @ApiProperty({

    })
    isDeleted: boolean;

    @ApiProperty({

    })
    isRead: boolean;

    @ApiProperty({
        description : "Notification created date",
        example : "2023-10-01T12:00:00Z"
    })
    createdAt: Date;
    @ApiProperty({
        description : "Notification updated date",
        example : "2023-10-01T12:00:00Z"
    })
    updatedAt: Date;
}
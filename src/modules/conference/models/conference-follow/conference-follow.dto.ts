import { ApiProperty } from "@nestjs/swagger";
import { UserPublicDTO } from "src/modules/user/models/user-public.dto";
import { ConferencePublicDTO } from "../conference/conference-public.dto";

export class ConferenceFollowDTO { 
    @ApiProperty({description : "Id of conference follow"})
    id: string; 

    @ApiProperty({description : "Id of conference"})    
    conferenceId: string; 

    @ApiProperty({description : "Conference which is followed" , type : ConferencePublicDTO})
    conference : ConferencePublicDTO

    @ApiProperty({description : "Id of user"})
    userId: string; 

    @ApiProperty({description : "User who followed the conference"})
    user : UserPublicDTO;
    
    @ApiProperty({description : "Created at"})
    createdAt: Date; 

    @ApiProperty({description : "Updated at"})
    updatedAt: Date;
}
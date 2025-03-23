import { PickType } from "@nestjs/swagger";
import { ConferenceFollowDTO } from "./conference-follow.dto";

export class ConferenceFollowByDTO extends PickType(ConferenceFollowDTO , [
    'id' ,
    'userId',
    'user',
    'createdAt',
    'updatedAt'
]){}
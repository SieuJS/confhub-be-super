import { ApiProperty, OmitType, PickType } from "@nestjs/swagger";
import { ConferenceDTO } from "./conference.dto";
import { OrganizedDTO } from "src/modules/conference-organization/models/organize/organized.dto";
import { ConferenceFollowByDTO } from "../conference-follow/conference-follow-by.dto";
import { ConferenceRankDTO } from "../conference-rank/conference-rank.dto";
import { ConferenceFeedBackDTO } from "../conference-feedback/conference-feedback.dto";

export class ConferenceInfoDTO extends PickType(ConferenceDTO , [
    'id' ,
    'acronym' ,
    'title',
    'creatorId',
    'createdAt',
    'updatedAt'
]){
    @ApiProperty({description : "Conference name"})
    creatorName : string
}

export class ConferenceDetailDTO  extends PickType(ConferenceDTO, [
    'id'
,
    'acronym' ,
    'title',
    'creatorId',
    'createdAt',
    'updatedAt',
'adminId',
'status']){

    @ApiProperty({description : "Organization information"})
    organizations : OrganizedDTO[]| null

    @ApiProperty({description : "Rank information"})
    ranks : ConferenceRankDTO[] | null

    @ApiProperty({description : "Feedbacks"})
    feedbacks : ConferenceFeedBackDTO[] | null

    @ApiProperty({description : "Followed by" , type : ConferenceFollowByDTO , isArray : true})
    followBy : ConferenceFollowByDTO[] | null

}
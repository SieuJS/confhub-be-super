import { PickType } from "@nestjs/swagger";
import { FeedBackDTO } from "./feedback.dto";

export class FeedbackInputDTO extends PickType(FeedBackDTO, [
    'conferenceId',
    'description',
    'star',
    'creatorId'
]) {
    
}

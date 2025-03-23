import { PickType } from "@nestjs/swagger";
import { ConferenceFeedBackDTO } from "./conference-feedback.dto";

export class ConferenceFeedBackInputDTO extends PickType( ConferenceFeedBackDTO , [
    'conferenceId',
    'description',
    'star',
    'creatorId'
]) {}
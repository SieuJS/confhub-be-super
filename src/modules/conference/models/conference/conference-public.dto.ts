import { PickType } from "@nestjs/swagger";
import { ConferenceDTO } from "./conference.dto";

export class ConferencePublicDTO extends PickType(ConferenceDTO, ['acronym', 'title']){}
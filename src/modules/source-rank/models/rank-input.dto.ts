import { OmitType } from "@nestjs/swagger";
import { RankDTO } from "./rank.dto";

export class RankInputDTO extends OmitType(RankDTO, ['id']) {
}
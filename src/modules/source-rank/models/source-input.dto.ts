import { OmitType } from "@nestjs/swagger";
import { SourceDTO } from "./source.dto";

export class SourceInputDTO extends OmitType(SourceDTO, ['id']) {

}
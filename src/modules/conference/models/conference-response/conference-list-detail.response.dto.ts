import { PaginationDTO } from "src/modules/common";
import { ConferenceDetailDTO } from "../conference/conference-detail.dto";

export class ConferenceListDetailResponseDTO{
    payload : ConferenceDetailDTO[]
    meta : PaginationDTO
}
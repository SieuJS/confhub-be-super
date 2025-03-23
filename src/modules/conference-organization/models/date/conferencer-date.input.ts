import { PickType } from "@nestjs/swagger";
import { ConferenceDateDTO } from "./conference-date.dto";

export class ConferenceDateInput extends PickType(ConferenceDateDTO, [
    'fromDate',
    'toDate',
    'type',
    'name',
    'organizedId'
]) {
}
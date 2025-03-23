import { OmitType, PickType } from "@nestjs/swagger";
import { LocationDTO } from "./location.dto";

export class LocationInput extends  PickType(LocationDTO , [
    'address',
    'cityStateProvince',
    'continent',
    'country',
    'organizeId'
]){}
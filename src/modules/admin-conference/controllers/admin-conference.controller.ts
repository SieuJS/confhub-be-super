import { Controller, DefaultValuePipe, Get, Query, UsePipes } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { AdminConferenceService } from "../services/admin-conference.service";
import { AdminConferenceParams } from "../models/admin-conference.dto";
import { AdminConferenceParamsPipe } from "../pipes/admin-conference-params.pipe";

@Controller('admin-conference')
export class AdminConferenceController {

    constructor (
        private readonly adminConferenceService : AdminConferenceService
    ) {}


    @ApiTags('get') 
    @Get('get')
    getConferenceInstances(
        @Query(
            new AdminConferenceParamsPipe()
        ) params : AdminConferenceParams,
        @Query('page', new DefaultValuePipe(1)) page : number,
        @Query('perPage', new DefaultValuePipe(10)) perPage : number,
    ) {

        const where = this.adminConferenceService.convertToPrismaWhereInput({
            search : params.search,
            status : params.status,
            source : params.source,
            researchFields : params.researchFields,
            ranks : params.ranks,
        })
        return this.adminConferenceService.getConferenceInstances({
            where ,
            orderBy : {},
            include : {},
            page : page,
            perPage : perPage,
        })
    }
}
import { Controller, Get } from "@nestjs/common";
import { ConferenceOrganizationSerivce } from "../services";

@Controller('/conference-organization')
export class ConferenceOrganizationController {
    constructor(
        private conferenceOrganizationService: ConferenceOrganizationSerivce
    ) {}

    @Get('/topics')
    async getConferenceTopics() {
        return await this.conferenceOrganizationService.getAllTopics();
    }
}
import { Controller, Get } from "@nestjs/common";
import { ConferenceOrganizationSerivce } from "../services";

@Controller('/conference-organization')
export class ConferenceOrganizationController {
    constructor(
        private conferenceOrganizationService: ConferenceOrganizationSerivce
    ) {}

    @Get('/topics')
    async getConferenceTopics() {
        const topicsInstances =  await this.conferenceOrganizationService.getAllTopics();
        return topicsInstances.map(topic => topic.name);
    }
}
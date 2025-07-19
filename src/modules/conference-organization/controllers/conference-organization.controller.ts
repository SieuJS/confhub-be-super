import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Query,
} from '@nestjs/common';
import { ConferenceOrganizationSerivce } from '../services';

@Controller('/conference-organization')
export class ConferenceOrganizationController {
  constructor(
    private conferenceOrganizationService: ConferenceOrganizationSerivce,
  ) {}

  @Get('/topics')
  async getConferenceTopics() {
    const topicsInstances =
      await this.conferenceOrganizationService.getAllTopics();
    return topicsInstances.map((topic) => topic.name);
  }

  @Delete('/topics')
  async deleteTopics(@Body() body: { topics: string[] }) {
    const { topics } = body;
    if (!topics || !Array.isArray(topics)) {
      throw new HttpException('Invalid topics array', 400);
    }
    await Promise.all(
      topics.map(async (topic) => {
        if (typeof topic !== 'string') {
          throw new HttpException('Invalid topic type', 400);
        }
        return await this.conferenceOrganizationService.removeTopic(topic);
      }),
    );
    return { message: 'Topics deleted successfully' };
  }

  @Get('/dates/types')
  async getAllDateTypes() {
    const dateTypes =
      await this.conferenceOrganizationService.getAllDateTypes();
    return dateTypes.map((type) => ({
      type,
      name: this.conferenceOrganizationService.getDatenameByType(type),
    }));
  }

  @Get('/dates')
  async getDateNameByType(@Query('type') type: string) {
    if (!type) {
      throw new HttpException('Type is required', 400);
    }
    const dateNames =
      await this.conferenceOrganizationService.getDatenameByType(type);
    if (!dateNames) {
      throw new HttpException('Date type not found', 404);
    }
    return { type, names: dateNames };
  }
}

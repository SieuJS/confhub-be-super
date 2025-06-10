/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConferenceService } from '../services/conference.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { ConferencePaginationDTO } from '../models/conference/conference-pagination.dto';
import { ConferenceImportDTO } from '../models/conference/conference-import.dto';
import {
  RankService,
  SourceService,
  FieldOfResearchService,
} from '../../source-rank';
import { RankInputDTO } from '../../source-rank/models/rank-input.dto';
import { ConferenceImportResponseDTO } from '../models/conference-response/conference-import-response.dto';
import { ConferenceOrganizationSerivce } from '../../conference-organization';
import { ConferenceDTO } from '../models/conference/conference.dto';
import { PaginationService } from '../../common/services/pagination.service';
import {
  GetConferencesParams,
  GetConferencesSortParams,
} from '../models/conference-request/get-conference-params';
import { AdminService } from '../../user/services/admin.service';
import { UserService } from '../../user/services/user.service';
import { ConferenceFollowInput } from '../models/conference-follow/conference-follow.input';
import { ConferenceDetailDTO } from '../models/conference/conference-detail.dto';
import { ConferenceFeedBackInputDTO } from '../models/conference-feedback/conference-feedback.input';
import { AddConferenceBody } from '../models/conference-request/add-conference-body';
import { JWTGuardUser } from 'src/modules/auth/guards/jwt.guard';
import { Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import axios from 'axios';

@ApiTags('/conference')
@Controller('conference')
export class ConferenceController {
  constructor(
    private readonly conferenceService: ConferenceService,
    private readonly rankService: RankService,
    private readonly sourceService: SourceService,
    private readonly fieldOfResearch: FieldOfResearchService,
    private readonly conferenceOrganizationService: ConferenceOrganizationSerivce,
    private readonly paginationService: PaginationService<ConferenceDTO>,
    private readonly adminService: AdminService,
    private readonly userService: UserService,
  ) {}
  @ApiResponse({
    status: 200,
    description: 'Get all conferences',
    type: ConferencePaginationDTO,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort by field',
    enum: ['createdAt', 'updatedAt', 'title', 'acronym', 'rank', 'source'],
    default: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @Get()
  async getConferences(
    @Query() params: GetConferencesParams,
    @Query('topics') topics: string | string[],
    @Query() sortParams: GetConferencesSortParams,
  ): Promise<ConferencePaginationDTO> {
    if (topics instanceof Array) {
      params.topics = topics;
    } else if (topics) {
      params.topics = [topics];
    }
    if (params.startDate) {
      params.fromDate = params.startDate;
    }
    if (params.endDate) {
      params.toDate = params.endDate;
    }
    if (params.type) {
      params.accessType = params.type;
    }
    if (params.page) {
      params.page = parseInt(params.page as any);
    }
    if (params.perPage) {
      params.perPage = parseInt(params.perPage as any);
    }

    const conferences = await this.conferenceService.getConferences(
      params,
      sortParams,
    );

    return conferences;
  }

  @Get('all')
  async getAllConferences() {
    return this.conferenceService.getConferences();
  }

  @ApiResponse({
    status: 200,
    description: 'Import conferences',
    type: ConferenceImportResponseDTO,
  })
  @ApiBody({
    type: ConferenceImportDTO,
  })
  @Post('import')
  async importConferences(
    @Body() conferenceImport: ConferenceImportDTO,
  ): Promise<any> {
    const user = await this.adminService.getAdmin();
    if (!user) {
      return new HttpException('User not found', 404);
    }
    conferenceImport.adminId = user.id;
    let conferenceInstance =
      await this.conferenceService.getConferenceByAcronymAndTitle(
        conferenceImport.title,
        conferenceImport.acronym,
      );
    const year = new Date().getFullYear();
    conferenceImport.year = year;

    if (!conferenceInstance) {
      conferenceInstance =
        await this.conferenceService.createConference(conferenceImport);
    }

    if (!conferenceInstance) {
      return new HttpException('Conference not found1', 404);
    }

    const sourceIntance = await this.sourceService.findOrCreateSource({
      name: conferenceImport.source,
      link: '',
    });

    const rankInput: RankInputDTO = {
      name: conferenceImport.rank,
      source: sourceIntance,
      value: 0,
    };

    const rankInstance = await this.rankService.findOrCreateRank(rankInput);
    conferenceImport.fieldOfResearchCodes.forEach(async (code) => {
      const fieldOfResearch =
        await this.fieldOfResearch.getFieldOfResearchByCode(code);
      if (fieldOfResearch) {
        await this.conferenceService.createOrFindRank(
          conferenceInstance.id,
          rankInstance,
          fieldOfResearch.id,
          conferenceImport.year,
        );
      }
    });
    const isCrawled = await this.conferenceService.isCrawledConference(
      conferenceInstance.id,
    );
    let status = '';
    if (!isCrawled) {
      status = 'not crawled';
    } else {
      status = 'crawled';
    }
    return {
      conferenceId: conferenceInstance.id,
      status,
    };
  }

  @Post('follow')
  @ApiBody({ type: ConferenceFollowInput })
  async followConference(
    @Body() input: { userId: string; conferenceId: string },
  ) {
    const conferenceIds = await this.userService.followConference(
      input.userId,
      input.conferenceId,
    );
    return conferenceIds;
  }

  @Post('unfollow')
  async unfollowConference(
    @Body() input: { userId: string; conferenceId: string },
  ) {
    const conferenceIds = await this.userService.unfollowConference(
      input.userId,
      input.conferenceId,
    );
    return conferenceIds;
  }

  @Get('followed')
  async getFollowedConferences(@Query('userId') userId: string) {
    const conferenceIds = await this.userService.getFollowedConferences(userId);
    const results = await Promise.all(
      conferenceIds.map(async (conferenceId) => {
        return await this.conferenceService.getConferenceById(
          conferenceId.conferenceId,
        );
      }),
    );
    return results;
  }

  @Get('followedBy/:conferenceId')
  @ApiParam({ name: 'conferenceId' })
  async getFollowedByConferenceId(@Param('conferenceId') conferenceId: string) {
    return await this.conferenceService.getFollowedByConferenceId(conferenceId);
  }

  @Post('feedback')
  @ApiBody({ type: ConferenceFeedBackInputDTO })
  async createFeedback(@Body() input: ConferenceFeedBackInputDTO) {
    return await this.conferenceService.createFeedback(input);
  }

  @Get('feedback/:conferenceId')
  @ApiParam({ name: 'conferenceId' })
  async getFeedbackByConferenceId(@Param('conferenceId') conferenceId: string) {
    return await this.conferenceService.getFeedbacksByConferenceId(
      conferenceId,
    );
  }

  @Post('add')
  @ApiBody({ type: AddConferenceBody })
  @UseGuards(JWTGuardUser)
  @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
  @ApiBearerAuth('access-token')
  async addConference(
    @Req() req,
    @Body() conferenceImport: AddConferenceBody,
  ): Promise<any> {
    const user = req.user;

    const conferenceInstance = await this.conferenceService.createConference({
      acronym: conferenceImport.acronym,
      title: conferenceImport.title,
      creatorId: user.id,
    });

    const organization =
      await this.conferenceOrganizationService.importOrganize({
        year: new Date().getFullYear(),
        accessType: conferenceImport.type,
        link: conferenceImport.link,
        impLink: conferenceImport.impLink || '',
        cfpLink: conferenceImport.cfpLink || '',
        summerize: conferenceImport.description,
        callForPaper: conferenceImport.callForPaper || '',
        conferenceId: conferenceInstance.id,
        isAvailable: true,
        publisher: user.email,
      });

    if (!organization) {
      return new HttpException('Organization not found', 404);
    }

    const location = await this.conferenceOrganizationService.importPlace({
      continent: conferenceImport.location.continent,
      country: conferenceImport.location.country,
      cityStateProvince: conferenceImport.location.cityStateProvince,
      address: conferenceImport.location.address,
      organizeId: organization.id,
    });

    const dates = await Promise.all(
      conferenceImport.dates.map((date) => {
        return this.conferenceOrganizationService.importDate({
          ...date,
          organizedId: organization.id,
        });
      }),
    );
  const topics = conferenceImport.topics || [];

  await Promise.all(topics.map(async (topic) => {
    await this.conferenceOrganizationService.importTopic({
      organized: organization.id,
      topic: topic,
    });
  }
  ));

    // Create conference post request
    const postRequest =
      await this.conferenceService.createConferencePostRequest(user.id, {
        conferenceId: conferenceInstance.id,
        message: 'Request to publish conference',
      });

    return {
      message: 'Conference created successfully',
      conferenceId: conferenceInstance.id,
      organizationId: organization.id,
      locationId: location.id,
      dates: dates,
      postRequest,
    };
  }

  @Get('user')
  @UseGuards(JWTGuardUser)
  @Transactional<TransactionalAdapterPrisma>({ timeout: 30000 })
  @ApiBearerAuth('access-token')
  async getMyConferences(@Req() req) {
    console.log('getMyConferences called');
    const user = req.user;
    const conferences = await this.conferenceService.getConferenceByCreatorId(
      user.id,
    );
    return conferences;
  }
    @Get('check-exists')
  @ApiQuery({ name: 'title', required: false, type: String })
  @ApiQuery({ name: 'acronym', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Check if conference title or acronym exists',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async checkConferenceExists(
    @Query('title') title?: string,
    @Query('acronym') acronym?: string,
  ) {
    if (!title && !acronym) {
      throw new HttpException('Title or acronym must be provided', 400);
    }

    const conference =
      await this.conferenceService.getConferenceByAcronymAndTitle(
        title || '',
        acronym || '',
      );

    return {
      exists: !!conference,
      message: conference
        ? 'Conference already exists'
        : 'Conference does not exist',
    };
  }

  @Get('check-link')
  @ApiQuery({ name: 'link', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Check if conference link is valid and not in database',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        existsInDb: { type: 'boolean' },
        isAccessible: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async checkConferenceLink(@Query('link') link: string) {
    if (!link) {
      throw new HttpException('Link must be provided', 400);
    }

    try {
      // Check if URL is valid
      new URL(link);
    } catch {
      return {
        isValid: false,
        existsInDb: false,
        isAccessible: false,
        message: 'Invalid URL format',
      };
    }

    // Check if link exists in database
    const existingConference = await this.conferenceOrganizationService.findByLink(link);

    // Check if link is accessible
    let isAccessible = false;
    try {
      await axios.head(link, {
        timeout: 5000, // 5 second timeout
        validateStatus: (status) => status < 400, // Consider any status < 400 as success
      });
      isAccessible = true;
    } catch {
      isAccessible = false;
    }

    return {
      isValid: true,
      existsInDb: !!existingConference,
      isAccessible,
      message: existingConference
        ? 'Link already exists in database'
        : isAccessible
          ? 'Link is valid, accessible and not in database'
          : 'Link is valid but not accessible',
    };
  }

  @Get(':id')
  async getConferenceDetail(
    @Param('id') id: string,
    @Query('force') force: boolean = false,
  ): Promise<ConferenceDetailDTO | HttpException> {
    const conference = await this.conferenceService.getConferenceById(id , force);
    if (!conference) {
      throw new HttpException('Conference not found1', 404);
    }
    const conferenceDetail =
      await this.conferenceService.getConferenceByIdWithDetail(id);
    if (!conferenceDetail) {
      throw new HttpException('Conference not found1', 404);
    }
    return conferenceDetail;
  }


}

import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConferenceService } from '../services/conference.service';
import { ApiBody, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConferencePaginationDTO } from '../models/conference/conference-pagination.dto';
import { ConferenceImportDTO } from '../models/conference/conference-import.dto';
import {
  RankService,
  SourceService,
  FieldOfResearchService,
} from '../../source-rank';
import { RankInputDTO } from '../../source-rank/models/rank-input.dto';
import { ConferenceImportResponseDTO } from '../models/conference-response/conference-import-response.dto';
import { ConferenceCrawlInputDTO } from '../models/conference-crawl/conference-crawl';
import { ConferenceCrawlJobService } from '../../conference-job';
import { ConferenceOrganizationSerivce } from '../../conference-organization';
import { ConferenceDTO } from '../models/conference/conference.dto';
import { ConferenceAttribute } from '../../../constants/conference-attribute';
import { PaginationService } from '../../common/services/pagination.service';
import { GetConferencesParams } from '../models/conference-request/get-conference-params';
import { AdminService } from '../../user/services/admin.service';
import { ConferenceRankService } from '../services/conference-rank.service';
import { UserService } from '../../user/services/user.service';
import { ConferenceFollowInput } from '../models/conference-follow/conference-follow.input';
import { ConferenceDetailDTO } from '../models/conference/conference-detail.dto';
import { ConferenceFeedBackInputDTO } from '../models/conference-feedback/conference-feedback.input';
import {
  converStringToDate,
  convertObjectToDate,
} from 'src/modules/conference-job/utils/date-parse';
import { AddConferenceBody } from '../models/conference-request/add-conference-body';

@ApiTags('/conference')
@Controller('conference')
export class ConferenceController {
  constructor(
    private readonly conferenceService: ConferenceService,
    private readonly rankService: RankService,
    private readonly sourceService: SourceService,
    private readonly fieldOfResearch: FieldOfResearchService,
    private readonly conferenceCrawlJobService: ConferenceCrawlJobService,
    private readonly conferenceOrganizationService: ConferenceOrganizationSerivce,
    private readonly paginationService: PaginationService<ConferenceDTO>,
    private readonly adminService: AdminService,
    private readonly userService: UserService,
    private readonly conferenceRankService: ConferenceRankService,
  ) {}
  @ApiResponse({
    status: 200,
    description: 'Get all conferences',
    type: ConferencePaginationDTO,
  })
  @Get()
  async getConferences(
    @Query() params: GetConferencesParams,
    @Query('topics') topics: string | string[],
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

    const conferences = await this.conferenceService.getConferences(params);

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
    @Body() conferenceImport : ConferenceImportDTO,
  ): Promise<any> {
    let isExists = true;
    const user = await this.adminService.getAdmin();
    if (!user) {
      return new HttpException('User not found', 404);
    }
    conferenceImport.adminId = user.id;
    let conferenceInstance =
      await this.conferenceService.getConferenceByAcronymAndTitle(
        conferenceImport.title,
        conferenceImport.acronym)
    const year = new Date().getFullYear();
    conferenceImport.year = year;

    if (!conferenceInstance) {
      isExists = false;
      conferenceInstance =
        await this.conferenceService.createConference(conferenceImport);
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
        const t = await this.conferenceService.createOrFindRank(
          conferenceInstance.id,
          rankInstance,
          fieldOfResearch.id,
          conferenceImport.year,
        );
      }
    });
    const isCrawled = await this.conferenceService.isCrawledConference(
      conferenceInstance.id);
      let status = '';
    if(!isCrawled) {
        status = 'not crawled';
    }else {
        status = 'crawled';
    }
    return {
      conferenceId: conferenceInstance.id,
      status 
    };
  }

  @Post('crawl-new')
  async importManyConferences(
    @Body() { conferenceId }: { conferenceId: string },
  ) {
    const conferenceInstance =
      await this.conferenceService.getConferenceById(conferenceId);

    if (!conferenceInstance) {
      return new HttpException('Conference not found', 404);
    }

    const JobCrawlInstance =
      await this.conferenceCrawlJobService.createConferenceCrawlJob({
        conferenceId: conferenceInstance.id,
        conferenceAcronym: conferenceInstance.acronym,
        conferenceTitle: conferenceInstance.title,
        status: ConferenceAttribute.JOB_STATUS_PENDING,
        progress: 0,
        message: 'pending',
      });

    return {
      crawlJobId: JobCrawlInstance.id,
      conferenceId: conferenceInstance.id,
      channel: 'cfp-crawl-' + JobCrawlInstance.id,
    };
  }

  @Get(':id')
  async getConferenceDetail(
    @Param('id') id: string,
  ): Promise<ConferenceDetailDTO | HttpException> {
    const conference = await this.conferenceService.getConferenceById(id);
    if (!conference) {
      return new HttpException('Conference not found', 404);
    }
    const creator = conference.creatorId
      ? await this.userService.getUserById(conference.creatorId)
      : null;
    const adminCreator = conference.adminId
      ? await this.adminService.getAdminById(conference.adminId)
      : null;
    let creatorName = '';
    if (creator) {
      creatorName = creator.firstName + ' ' + creator.lastName;
    } else if (adminCreator) {
      creatorName = adminCreator.fullName;
    }
    const ranks = await this.conferenceRankService.getRankByConferenceId(
      conference.id,
    );
    const folowBy = await this.conferenceService.getFollowedByConferenceId(
      conference.id,
    );
    const feedbacks = await this.conferenceService.getFeedbacksByConferenceId(
      conference.id,
    );
    const organizations =
      await this.conferenceOrganizationService.getAllOrganizedByConferenceId(
        conference.id,
      );
    if (!organizations) {
      return {
        conference: {
          id: conference.id,
          title: conference.title,
          acronym: conference.acronym,
          creatorId: conference.creatorId,
          createdAt: conference.createdAt,
          updatedAt: conference.updatedAt,
          creatorName,
        },
        organization: null,
        location: null,
        dates: null,
        ranks: ranks,
        followBy: folowBy,
        feedbacks: feedbacks,
      };
    }
    let locations = await Promise.all(
      organizations.map(async (organization) => {
        return await this.conferenceOrganizationService.getLocationsByOrganizedId(
          organization.id,
        );
      })
    )
    const dates = await Promise.all(
      organizations.map(async (organization) => {
        return await this.conferenceOrganizationService.getDatesByOrganizedId(
          organization.id,
        );
      })
    )

    return {
      conference: {
        id: conference.id,
        title: conference.title,
        acronym: conference.acronym,
        creatorId: conference.creatorId,
        createdAt: conference.createdAt,
        updatedAt: conference.updatedAt,
        creatorName,
      },
      organization :organizations[0],
      location: {
        id: locations[0].id,
        createdAt: locations[0].createdAt,
        updatedAt: locations[0].updatedAt,
        isAvailable: locations[0].isAvailable,
        organizeId: locations[0].organizeId,
        cityStateProvince: locations[0].cityStateProvince || '',
        country: locations[0].country || '',
        address: locations[0].address || '',
        continent: locations[0].continent || '',
      },
      dates : dates.flatMap((date) => {
        return date.map((d) => {
          return {
            id: d.id,
            fromDate: d.fromDate,
            toDate: d.toDate,
            type: d.type,
            name: d.name,
            isAvailable: d.isAvailable,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
        })
      }),
      followBy: folowBy,
      feedbacks: feedbacks,
      ranks: ranks,
    };
  }

  @Post('update/:id')
  @ApiParam({ name: 'id' })
  async updateConference(@Param('id') id: string) {
    const conference = await this.conferenceService.getConferenceById(id);
    if (!conference) {
      return new HttpException('Conference not found', 404);
    }
    const organization =
      await this.conferenceOrganizationService.getFirstOrganizationsByConferenceId(
        conference.id,
      );
    if (!organization) {
      return new HttpException('Organization not found', 404);
    }
    const responseData =
      await this.conferenceCrawlJobService.fetchUpdateConferenceCrawlData({
        cfpLink: organization.cfpLink,
        impLink: organization.impLink,
        Acronym: conference.acronym,
        Title: conference.title,
        mainLink: organization.link,
      });
    let crawlData = responseData.data[0];
    crawlData = {
      ...crawlData,
      cfpLink: organization.cfpLink,
      impLink: organization.impLink,
      link: organization.link,
    };

    const organizeData =
      await this.conferenceOrganizationService.importOrganize({
        year: parseInt(crawlData.year),
        accessType: crawlData.type,
        link: crawlData.link,
        impLink: crawlData.impLink,
        cfpLink: crawlData.cfpLink,
        summerize: crawlData.summary,
        callForPaper: crawlData.callForPapers,
        conferenceId: conference.id,
        isAvailable: true,
        publisher: crawlData.publisher,
      });
    if (!organizeData) {
      return new HttpException('Organization not found', 404);
    }

    const locationData = await this.conferenceOrganizationService.importPlace({
      continent: crawlData.continent,
      country: crawlData.country,
      cityStateProvince: crawlData.cityStateProvince,
      address: crawlData.location,
      organizeId: organizeData.id,
    });

    const {
      submissionDate,
      cameraReadyDate,
      conferenceDates,
      registrationDate,
      notificationDate,
      otherDate,
    } = crawlData;

    const conferenceDateInput = converStringToDate(
      conferenceDates,
      'conferenceDates',
      organizeData.id,
    );

    const submissionDateInput = convertObjectToDate(
      submissionDate,
      'submissionDate',
      organizeData.id,
    );
    const cameraReadyDateInput = convertObjectToDate(
      cameraReadyDate,
      'cameraReadyDate',
      organizeData.id,
    );
    const registrationDateInput = convertObjectToDate(
      registrationDate,
      'registrationDate',
      organizeData.id,
    );
    const notificationDateInput = convertObjectToDate(
      notificationDate,
      'notificationDate',
      organizeData.id,
    );
    const otherDateInput = convertObjectToDate(
      otherDate,
      'otherDate',
      organizeData.id,
    );

    const dateInput = [
      conferenceDateInput,
      ...submissionDateInput,
      ...cameraReadyDateInput,
      ...registrationDateInput,
      ...notificationDateInput,
      ...otherDateInput,
    ];

    for (const date of dateInput) {
      await this.conferenceOrganizationService.importDate(date);
    }

    const createdTopics = crawlData.topics.split(' ').map((topic) => {
      return this.conferenceOrganizationService.importTopic({ 
        organized: organizeData.id,
        topic: topic,
      });
    });

    return {
      conferenceId: conference.id,
      organizationId: organizeData.id,
      locationId: locationData.id,
      dates: dateInput,
    };
  }

  @Post('crawl')
  @ApiBody({
    type: ConferenceCrawlInputDTO,
  })
  async crawlConferences(@Body() conferenceCrawl: ConferenceImportDTO) {
    const conferenceInstance =
      await this.conferenceService.getConferenceByAcronymAndTitle(
        conferenceCrawl.title,
        conferenceCrawl.acronym,
      );

    if (!conferenceInstance) {
      return new HttpException('Conference not found', 404);
    }

    const JobCrawlInstance =
      await this.conferenceCrawlJobService.createConferenceCrawlJob({
        conferenceId: conferenceInstance.id,
        conferenceAcronym: conferenceInstance.acronym,
        conferenceTitle: conferenceInstance.title,
        status: ConferenceAttribute.JOB_STATUS_PENDING,
        progress: 0,
        message: 'pending',
      });

    return {
      crawlJobId: JobCrawlInstance.id,
      conferenceId: conferenceInstance.id,
      channel: 'cfp-crawl-' + JobCrawlInstance.id,
      conferenceAcronym: conferenceInstance.acronym,
      conferenceTitle: conferenceInstance.title,
      createdAt: JobCrawlInstance.createdAt,
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
  @ApiBody({ type: ConferenceImportDTO })
  async addConference(
    @Body() conferenceImport: AddConferenceBody,
  ): Promise<any> {
    const user = await this.userService.getUserById(conferenceImport.userId);
    if (!user) {
      return new HttpException('User not found', 404);
    }
    conferenceImport.conference.creatorId = user.id;
    const conferenceInstance =
      await this.conferenceService.createConference({
        acronym: conferenceImport.conference.acronym,
        title: conferenceImport.conference.title,
      });

    const organizationInstance =
      await this.conferenceOrganizationService.importOrganize(
        {
          ...conferenceImport.organization,
          conferenceId: conferenceInstance.id,
        })
    if (!organizationInstance) {
      return new HttpException('Fail when create conference', 404);
    }
    const locationInstance =
      await this.conferenceOrganizationService.importPlace({
        ...conferenceImport.location,
        organizeId: organizationInstance?.id,
      });

    const dateInstance = await Promise.all( conferenceImport.dates.map((date) => {
      return this.conferenceOrganizationService.importDate({
        ...date,
        organizedId: organizationInstance.id,
      });
    }));
    
    if (!locationInstance) {
      return new HttpException('Fail when create location', 404);
    }
    return conferenceInstance;
  }
  
  @Get('list/detail')
  async getListConferenceDetail(
    @Query('conferenceIds') conferenceIds: string,
  ): Promise<ConferenceDetailDTO[]> {
      return "" as any
  }

}

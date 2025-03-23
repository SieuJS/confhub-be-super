import { Body, Controller, Get, HttpException, Param, Post, Query } from "@nestjs/common";
import { ConferenceService } from "../services/conference.service";
import { ApiBody, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ConferencePaginationDTO } from "../models/conference/conference-pagination.dto";
import { ConferenceImportDTO } from "../models/conference/conference-import.dto";
import {
    RankService,
    SourceService,
    FieldOfResearchService,
} from "../../source-rank";
import { RankInputDTO } from "../../source-rank/models/rank-input.dto";
import { ConferenceImportResponseDTO } from "../models/conference-response/conference-import-response.dto";
import { ConferenceCrawlInputDTO } from "../models/conference-crawl/conference-crawl";
import { ConferenceCrawlJobService } from '../../conference-job'
import { ConferenceOrganizationSerivce } from "../../conference-organization";
import { ConferenceDTO } from "../models/conference/conference.dto";
import { ConferenceAttribute } from "../../../constants/conference-attribute";
import { PaginationService } from "../../common/services/pagination.service";
import { GetConferencesParams } from "../models/conference-request/get-conference-params";
import { AdminService } from "../../user/services/admin.service";
import { ConferenceRankService } from "../services/conference-rank.service";
import { UserService } from "../../user/services/user.service";
import { ConferenceFollowInput } from "../models/conference-follow/conference-follow.input";
import { ConferenceDetailDTO } from "../models/conference/conference-detail.dto";
import { ConferenceFeedBackInputDTO } from "../models/conference-feedback/conference-feedback.input";

@ApiTags("/conference")
@Controller("conference")
export class ConferenceController {
    constructor(
        private readonly conferenceService: ConferenceService,
        private readonly rankService: RankService,
        private readonly sourceService: SourceService,
        private readonly fieldOfResearch: FieldOfResearchService,
        private readonly conferenceCrawlJobService : ConferenceCrawlJobService,
        private readonly conferenceOrganizationService : ConferenceOrganizationSerivce,
        private readonly paginationService : PaginationService<ConferenceDTO>,
        private readonly adminService : AdminService,
        private readonly userService : UserService,
        private readonly conferenceRankService : ConferenceRankService
    ) {}
    @ApiResponse({
        status: 200,
        description: "Get all conferences",
        type: ConferencePaginationDTO,
    })
    @Get()
    async getConferences(@Query() params: GetConferencesParams, @Query('topics') topics : string | string[]) {
        if(topics instanceof Array) {
            params.topics = topics;
        } else if(topics) {
            params.topics = [topics];
        }
        if(params.startDate) {
            params.fromDate = params.startDate;
        }
        if(params.endDate) {
            params.toDate = params.endDate;
        }
        if(params.type) {
            params.accessType = params.type;
        }
        
        const conferences =  await this.conferenceService.getConferences(params);
        const conferenceToResponse : ConferenceDTO[] = await Promise.all(conferences.map( async conference => {
            const organization = await this.conferenceOrganizationService.getFirstOrganizationsByConferenceId(conference.id) ;
            if(!organization) {
                    return {
                        id : conference.id,
                        title : conference.title,
                        acronym : conference.acronym,
                        location : {
                            cityStateProvince : '',
                            country : '',
                            address : "",
                            continent : '',
                        },
                        rank : '',
                        source : '',
                        year : 0,
                        researchFields: [],
                        topics : [],
                        dates : { fromDate: new Date(), toDate: new Date(), name: '', type: 'conferenceDates' },
                        link : '',
                        createdAt : conference.createdAt,
                        updatedAt : conference.updatedAt,
                        creatorId : conference.creatorId,
                        accessType : '',
                        status : conference.status
                    }
                }
            
            const locations = await this.conferenceOrganizationService.getLocationsByOrganizedId(organization.id);
            if(locations.length === 0) {
                return {
                    id : conference.id,
                    title : conference.title,
                    acronym : conference.acronym,
                    location : {
                        cityStateProvince : '',
                        country : '',
                        address : '',
                        continent : '',
                    },
                    rank : '',
                    source : '',
                    year : 0,
                    researchFields: [],
                    topics : [],
                    dates : { fromDate: new Date(), toDate: new Date(), name: '', type: 'conferenceDates' },
                    link : '',
                    createdAt : conference.createdAt,
                    updatedAt : conference.updatedAt,
                    creatorId : conference.creatorId,
                    accessType : '',
                    status : conference.status
                }}
            const dates = await this.conferenceOrganizationService.getDatesByOrganizedId(organization.id);
            if(dates.length === 0) {
                return {
                    id : conference.id,
                    title : conference.title,
                    acronym : conference.acronym,
                    location : {
                        cityStateProvince : locations[0].cityStateProvince ?? '',
                        country : locations[0].country ?? '',
                        address : locations[0].address ?? '',
                        continent : locations[0].continent ?? '',
                    },
                    rank : conference.ranks[0]?.byRank?.name,
                    source : conference.ranks[0]?.byRank?.belongsToSource.name,
                    year : conference.ranks[0]?.year,
                    researchFields: conference.ranks.map(rank => rank.inFieldOfResearch.name),
                    topics : organization.topics,
                    dates : { fromDate: new Date(), toDate: new Date(), name: '', type: 'conferenceDates' },
                    link : organization.link,
                    createdAt : conference.createdAt,
                    updatedAt : conference.updatedAt,
                    creatorId : conference.creatorId,
                    accessType : organization.accessType,
                    status : conference.status
                }
            }

            const conferenceDTO : ConferenceDTO = {
                id : conference.id,
                title : conference.title,
                acronym : conference.acronym,
                location : {
                    cityStateProvince : locations[0].cityStateProvince || '',
                    country : locations[0].country || '',
                    address : locations[0].address || '',
                    continent : locations[0].continent || '',
                },
                rank : conference.ranks[0]?.byRank?.name,
                source : conference.ranks[0]?.byRank?.belongsToSource.name,
                year : conference.ranks[0]?.year,
                researchFields: conference.ranks.map(rank => rank.inFieldOfResearch.name),
                topics : organization.topics,
                dates : dates.filter(date => {
                    return (date.type === 'conferenceDates')
                }).map(date => {
                    return {
                        fromDate : date.fromDate,
                        toDate : date.toDate,
                        name : date.name,
                        type : date.type
                    }
                })[0],
                link : organization.link,
                createdAt : conference.createdAt,
                updatedAt : conference.updatedAt,
                creatorId : conference.creatorId,
                accessType : organization.accessType,
                status : conference.status

            }
            return conferenceDTO;
        }))
        
        return this.paginationService.paginate(conferenceToResponse, params.page, parseInt(params.perPage as any));
    }

    @Get('all') 
    async getAllConferences() {
        return this.conferenceService.getConferences();
    }

    @ApiResponse({
        status: 200,
        description: "Import conferences",
        type : ConferenceImportResponseDTO  
    })
    @ApiBody({
        type: ConferenceImportDTO,
    })
    @Post("import")
    async importConferences(@Body() conferenceImport: ConferenceImportDTO) : Promise<any> {
        let isExists = true;
        const user = await this.adminService.getAdmin();
        if(!user) {
            return new HttpException('User not found', 404);
        }
        conferenceImport.creatorId = user.id;
        let conferenceInstance =
            await this.conferenceService.getConferenceByAcronymAndTitle(
                conferenceImport.title,
                conferenceImport.acronym
            );
        const year = new Date().getFullYear();
        conferenceImport.year = year;

        conferenceImport.fieldOfResearchCodes = conferenceImport.fieldOfResearchCodes.filter(
            (code) => code !== ""
        )

        if (!conferenceInstance) {
            isExists = false;
            conferenceInstance = await this.conferenceService.createConference(
                conferenceImport
            );
        }

        const sourceIntance = await this.sourceService.findOrCreateSource({
            name: conferenceImport.source,
            link: "",
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
                await this.conferenceService.createConferenceRank(
                    conferenceInstance.id,
                    rankInstance,
                    fieldOfResearch.id,
                    conferenceImport.year
                );
            }
        });

        return {
            conferenceId: conferenceInstance.id,
            isExists,
        };
    }


    @Post('crawl-new')
    async importManyConferences(@Body() {conferenceId} : {conferenceId : string}) {

        const conferenceInstance = await this.conferenceService.getConferenceById(conferenceId);

        if(!conferenceInstance) {
            return new HttpException('Conference not found', 404);
        }

        const JobCrawlInstance = await this.conferenceCrawlJobService.createConferenceCrawlJob({
            conferenceId : conferenceInstance.id,
            conferenceAcronym : conferenceInstance.acronym,
            conferenceTitle : conferenceInstance.title,
            status : ConferenceAttribute.JOB_STATUS_PENDING,
            progress : 0,
            message : 'pending'
        })

        return {
            crawlJobId : JobCrawlInstance.id,
            conferenceId: conferenceInstance.id,
            channel : "cfp-crawl-"+JobCrawlInstance.id
        };
    }
    
    @Get(':id')
    async getConferenceDetail(@Param('id') id : string) : Promise<ConferenceDetailDTO | HttpException> {
        const conference = await this.conferenceService.getConferenceById(id);
        if(!conference) {
            return new HttpException('Conference not found', 404);
        }
        const organization = await this.conferenceOrganizationService.getFirstOrganizationsByConferenceId(conference.id) ;
        if(!organization) {
            return new HttpException('Organization not found', 404);
        }
        let locations = await this.conferenceOrganizationService.getLocationsByOrganizedId(organization.id);
        const dates = await this.conferenceOrganizationService.getDatesByOrganizedId(organization.id);
        const ranks = await this.conferenceRankService.getRankByConferenceId(conference.id);
        const folowBy = await this.conferenceService.getFollowedByConferenceId(conference.id);
        const feedbacks = await this.conferenceService.getFeedbacksByConferenceId(conference.id);
        return {
            conference : {
                id : conference.id,
                title : conference.title,
                acronym : conference.acronym,
                creatorId : conference.creatorId,
                createdAt : conference.createdAt,
                updatedAt : conference.updatedAt,
                creatorName : conference.creatorId,
            },
            organization,
            location : {
                id : locations[0].id,
                createdAt : locations[0].createdAt,
                updatedAt : locations[0].updatedAt,
                isAvailable : locations[0].isAvailable,
                organizeId : locations[0].organizeId,
                cityStateProvince : locations[0].cityStateProvince || '',
                country : locations[0].country || '',
                address : locations[0].address || '',
                continent : locations[0].continent || '',
            },
            dates,
            ranks,
            followBy : folowBy,
            feedbacks : feedbacks
        }
    }

    @Post('crawl')
    @ApiBody({
        type : ConferenceCrawlInputDTO
    })
    async crawlConferences(@Body() conferenceCrawl : ConferenceImportDTO) {

        const conferenceInstance = await this.conferenceService.getConferenceByAcronymAndTitle(
            conferenceCrawl.title, conferenceCrawl.acronym)

        if(!conferenceInstance) {
            return new HttpException('Conference not found', 404); 
        }

        const JobCrawlInstance = await this.conferenceCrawlJobService.createConferenceCrawlJob({
            conferenceId : conferenceInstance.id,
            conferenceAcronym : conferenceInstance.acronym,
            conferenceTitle : conferenceInstance.title,
            status : ConferenceAttribute.JOB_STATUS_PENDING,
            progress : 0,
            message : 'pending'
        })

        return {
            crawlJobId : JobCrawlInstance.id,
            conferenceId: conferenceInstance.id,
            channel : "cfp-crawl-"+JobCrawlInstance.id,
            conferenceAcronym : conferenceInstance.acronym,
            conferenceTitle : conferenceInstance.title,
            createdAt : JobCrawlInstance.createdAt
        };
    }

    @Post('follow')
    @ApiBody({type : ConferenceFollowInput})
    async followConference(@Body() input : {userId : string, conferenceId : string}) {
        const conferenceIds= await this.userService.followConference(input.userId, input.conferenceId);
        return conferenceIds;
    }

    @Post('unfollow')
    async unfollowConference(@Body() input : {userId : string, conferenceId : string}) {
        const conferenceIds= await this.userService.unfollowConference(input.userId, input.conferenceId);
        return conferenceIds;
    }

    @Get('followed')
    async getFollowedConferences(@Query('userId') userId : string) {
        const conferenceIds = await this.userService.getFollowedConferences(userId);
        const results = await Promise.all(conferenceIds.map(async conferenceId => {
            return await this.conferenceService.getConferenceById(conferenceId.conferenceId);
        }))
        return results;
    }

    @Get('followedBy/:conferenceId')
    @ApiParam({name : 'conferenceId'})
    async getFollowedByConferenceId(@Param('conferenceId') conferenceId : string) {
        return await this.conferenceService.getFollowedByConferenceId(conferenceId);
    }

    @Post('feedback')
    @ApiBody({type : ConferenceFeedBackInputDTO})
    async createFeedback(@Body() input : ConferenceFeedBackInputDTO) {
        return await this.conferenceService.createFeedback(input);
    }

    @Get('feedback/:conferenceId')
    @ApiParam({name : 'conferenceId'})
    async getFeedbackByConferenceId(@Param('conferenceId') conferenceId : string) {
        return await this.conferenceService.getFeedbacksByConferenceId(conferenceId);
    }

}

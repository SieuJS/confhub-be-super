import { PrismaService } from "../../common";
import { Injectable } from "@nestjs/common";
import { ConferenceImportDTO } from "../models/conference/conference-import.dto";
import { RankDTO } from "../../source-rank/models/rank.dto";
import { ConferenceQueryDto } from "../models/conference/conference-query.dto";
import { PaginationService } from "../../common/services/pagination.service";
import { ConferenceFilter } from "../models/conference-filter/conference.filter";
import parser from "any-date-parser";
import { ConferenceDTO } from "../models/conference/conference.dto";
import {
    FieldOfResearchService,
    RankService,
    SourceService,
} from "../../source-rank";
import { ConferenceOrganizationSerivce } from "../../conference-organization";
import { ConferenceRankService } from "./conference-rank.service";
import { ConferenceFollowByDTO } from "../models/conference-follow/conference-follow-by.dto";
import { ConferenceFeedBackDTO } from "../models/conference-feedback/conference-feedback.dto";
import { ConferenceFeedBackInputDTO } from "../models/conference-feedback/conference-feedback.input";

@Injectable()
export class ConferenceService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly paginationService: PaginationService<any>,
        private readonly rankService: RankService,
        private readonly fieldOfResearchService: FieldOfResearchService,
        private readonly sourceService: SourceService,
        private readonly conferenceOraganizationService: ConferenceOrganizationSerivce,
        private readonly conferenceRankService: ConferenceRankService
    ) {}

    async getConferences(conferenceFilter?: ConferenceFilter ) {
        
        const include = {
            ranks: {
                include: {
                    byRank: {
                        include: {
                            belongsToSource: true,
                        },
                    },
                    inFieldOfResearch: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        };

        if (!conferenceFilter) {
            return await this.prismaService.conferences.findMany({
                include : {
                    ranks : {
                        include : {
                            inFieldOfResearch : true,
                            byRank : {
                                include : {
                                    belongsToSource : true
                                }
                            }
                        }
                    }
                }
            });
        }

        const consferences = await this.prismaService.conferences.findMany({
            include,
            where: {
                ...( conferenceFilter.keyword ? {OR: [
                    {
                        title: {
                            contains: conferenceFilter.keyword,
                            mode: "insensitive",
                        },
                    },
                    {
                        acronym: {
                            contains: conferenceFilter.keyword,
                            mode: "insensitive",
                        },
                    },
                    {
                        organizations: {
                            some: {
                                topics: {
                                    some: {
                                        inTopic: {
                                            name: {
                                                contains: conferenceFilter.keyword,
                                                mode: "insensitive",
                                            },
                                        },
                                    },
                                },

                            },
                        },
                    }, 
                    {
                        organizations: {
                            some: {
                                locations: {
                                    some: {
                                        address: {
                                            contains: conferenceFilter.keyword,
                                            mode: "insensitive",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    {
                        organizations : {
                            some : {
                                summerize : {
                                    contains : conferenceFilter.keyword,
                                    mode : "insensitive"
                                }
                            }
                        }
                    }, 
                    {
                        organizations : {
                            some : {
                                callForPaper : {
                                    contains : conferenceFilter.keyword,
                                    mode : "insensitive"
                                }
                            }
                        }
                    }
                ]}  : {}),

                ...(conferenceFilter.title
                    ? {
                          title: {
                              contains: conferenceFilter.title,
                              mode: "insensitive",
                          },
                      }
                    : {}),

                ...(conferenceFilter.acronym
                    ? {
                          acronym: {
                              contains: conferenceFilter.acronym,
                              mode: "insensitive",
                          },
                      }
                    : {}),

                ranks: {
                    ...(conferenceFilter.rank || conferenceFilter.source || conferenceFilter.researchFields
                        ? {
                              some: {
                                  byRank: {
                                      ...(conferenceFilter.rank
                                          ? {
                                                name: {
                                                    equals:
                                                        conferenceFilter.rank,
                                                    mode: "insensitive",
                                                },
                                            }
                                          : {}),
                                      ...(conferenceFilter.source
                                          ? {
                                                belongsToSource: {
                                                    name: {
                                                        contains:
                                                            conferenceFilter.source,
                                                        mode: "insensitive",
                                                    },
                                                },
                                            }
                                          : {}),
                                    ...(conferenceFilter.researchFields ?{
                                        inFieldOfResearch : {
                                            name : {
                                                in : conferenceFilter.researchFields,
                                                mode : "insensitive"
                                            }
                                        }
                                    } : {})
                                  },
                              },
                          }
                        : {}),
                },

                ...(conferenceFilter.topics ||
                conferenceFilter.fromDate ||
                conferenceFilter.toDate ||
                conferenceFilter.cityStateProvince ||
                conferenceFilter.continent ||
                conferenceFilter.country ||
                conferenceFilter.accessType
                    ? {
                          organizations: {
                              some: {
                                ...
                                    (conferenceFilter.accessType
                                    ? {
                                    accessType: {
                                        contains: conferenceFilter.accessType,
                                        mode: "insensitive",
                                    }} : {}
                                ),
                                  ...(conferenceFilter.topics
                                      ? {
                                            topics: {
                                                some: {
                                                    inTopic: {
                                                        name: {
                                                            in: conferenceFilter.topics,
                                                            mode: "insensitive",
                                                            
                                                        },
                                                    },
                                                },
                                            },
                                        }
                                      : {}),
                                  locations: {
                                      some: {
                                          ...(conferenceFilter.cityStateProvince
                                              ? {
                                                    cityStateProvince: {
                                                        contains:
                                                            conferenceFilter.cityStateProvince,
                                                        mode: "insensitive",
                                                    },
                                                }
                                              : {}),

                                          ...(conferenceFilter.country
                                              ? {
                                                    country: {
                                                        contains:
                                                            conferenceFilter.country,
                                                        mode: "insensitive",
                                                    },
                                                }
                                              : {}),

                                          ...(conferenceFilter.continent
                                              ? {
                                                    continent: {
                                                        contains:
                                                            conferenceFilter.continent,
                                                        mode: "insensitive",
                                                    },
                                                }
                                              : {}),

                                          ...(conferenceFilter.address
                                              ? {
                                                    address: {
                                                        contains:
                                                            conferenceFilter.address,
                                                        mode: "insensitive",
                                                    },
                                                }
                                              : {}),
                                      },
                                  },
                                  conferenceDates: {

                                      ...(conferenceFilter.fromDate ||
                                      conferenceFilter.toDate
                                          ? {
                                                some: {
                                                    ...(conferenceFilter.fromDate
                                                        ? {
                                                              fromDate: {
                                                                  gte: parser.fromString(
                                                                      conferenceFilter.fromDate
                                                                      ),
                                                              },
                                                              type : 'conferenceDates'
                                                          }
                                                        : {}),

                                                    ...(conferenceFilter.toDate
                                                        ? {
                                                              toDate: {
                                                                  lte: parser.fromString(
                                                                      conferenceFilter.toDate
                                                                  ),
                                                              },
                                                            type : 'conferenceDates'
                                                          }
                                                        : {}),
                                                },
                                            }
                                          : {}),
                                  },
                              },
                          },
                      }
                    : {}),
            },
        });
        return consferences;
    }

    async getConferenceById(id: string)  {
        return await this.prismaService.conferences.findUnique({
            where: {
                id,
            },
        });
    }

    async isExistsConferenceNameAndAcronym(title: string, acronym: string) {
        const conference = await this.prismaService.conferences.findFirst({
            where: {
                title,
                acronym,
            },
        });
        return conference ? true : false;
    }

    async createConference(conference: ConferenceImportDTO) {
        if (
            await this.isExistsConferenceNameAndAcronym(
                conference.title,
                conference.acronym
            )
        ) {
            throw new Error(
                `Conference with title ${conference.title} and acronym ${conference.acronym} already exists`
            );
        }

        return await this.prismaService.conferences.create({
            data: {
                title: conference.title,
                acronym: conference.acronym,
                creatorId: conference.creatorId,
                status : 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    }

    async findOrCreateConference(conference: ConferenceImportDTO) {
        const existingConference =
            await this.prismaService.conferences.findFirst({
                where: {
                    title: conference.title,
                    acronym: conference.acronym,
                },
            });

        if (existingConference) {
            return existingConference;
        }

        return await this.prismaService.conferences.create({
            data: {
                id: conference.id,
                title: conference.title,
                acronym: conference.acronym,
                creatorId: conference.creatorId,
                status : 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    }

    async importConferences(conference: ConferenceImportDTO) {
        const conferenceInstance = await this.findOrCreateConference(
            conference
        );
    }

    async createConferenceRank(
        conferenceId: string,
        rankInstance: RankDTO,
        fieldOfResearchId: string,
        year: number
    ) {
        return await this.prismaService.conferenceRanks.create({
            data: {
                conferenceId: conferenceId,
                rankId: rankInstance.id,
                fieldOfResearchId,
                year,
            },
        });
    }

    async createOrFindRank(
        conferenceId: string,
        rankInstance: RankDTO,
        fieldOfResearchId: string,
        year: number
    ) {
        const existingRank = await this.prismaService.conferences.findFirst(
            {
                where : {
                    id : conferenceId, 
                    ranks : {
                        some : {
                            rankId : rankInstance.id,
                            fieldOfResearchId,
                            year
                        }
                    }
                }
            }
        );

        if (existingRank) {
            return existingRank;
        }

        return await this.createConferenceRank(
            conferenceId,
            rankInstance,
            fieldOfResearchId,
            year
        );
    }

    

    async getConferenceByAcronymAndTitle(title: string, acronym: string) {
        return await this.prismaService.conferences.findFirst({
            where: {
                title,
                acronym,
            },
        });
    }

    async createConferenceByImport(conferenceImport: ConferenceImportDTO) {
        return this.prismaService.conferences.create({
            data: {
                title: conferenceImport.title,
                acronym: conferenceImport.acronym,
                creatorId: conferenceImport.creatorId,
                status : 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    }

    async getGeneralConferenceInfo(conferenceId: string): Promise<ConferenceDTO | undefined> {
        const conference = await this.prismaService.conferences.findUnique({
            where: {
                id: conferenceId,
            },
            include: {
                ranks: {
                    include: {
                        byRank: {
                            include: {
                                belongsToSource: true,
                            },
                        },
                        inFieldOfResearch: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        if(!conference) {
            return undefined;
        }

        const organization =
            await this.conferenceOraganizationService.getFirstOrganizationsByConferenceId(
                conference.id
            );
        if (!organization) {
            return {
                id: conference.id,
                title: conference.title,
                acronym: conference.acronym,
                location: {
                    cityStateProvince: '',
                    country: '',
                    address: '',
                    continent: '',
                },
                rank: '',
                source: '',
                year: NaN,
                researchFields: [],
                topics: [],
                dates: undefined,
                link: '',
                createdAt: conference.createdAt,
                updatedAt: conference.updatedAt,
                creatorId: conference.creatorId,
                accessType: '',
                status : conference.status
            };
        }

        const locations =
            await this.conferenceOraganizationService.getLocationsByOrganizedId(
                organization.id
            );
        const dates =
            await this.conferenceOraganizationService.getDatesByOrganizedId(
                organization.id
            );
        const conferenceDTO: ConferenceDTO = {
            id: conference.id,
            title: conference.title,
            acronym: conference.acronym,
            location: {
                cityStateProvince: locations[0].cityStateProvince,
                country: locations[0].country,
                address: locations[0].address,
                continent: locations[0].continent,
            },
            rank: conference.ranks[0]?.byRank?.name,
            source: conference.ranks[0]?.byRank?.belongsToSource.name,
            year: conference.ranks[0]?.year,
            researchFields: conference.ranks.map(
                (rank) => rank.inFieldOfResearch.name
            ),
            topics: organization.topics,
            dates: dates
                .filter((date) => {
                    return date.type === "conferenceDates";
                })
                .map((date) => {
                    return {
                        fromDate: date.fromDate,
                        toDate: date.toDate,
                        name: date.name,
                        type: date.type,
                    };
                })[0],
            link: organization.link,
            createdAt: conference.createdAt,
            updatedAt: conference.updatedAt,
            creatorId: conference.creatorId,
            accessType: organization.accessType,
            status : conference.status
        };
        return conferenceDTO;
    }

    async getConferenceDetails(conferenceId: string) {
        const conference = await this.prismaService.conferences.findUnique({
            where : {
                id : conferenceId
            }   
        })
        if(!conference) {
            return undefined
        }
        const organization = await this.conferenceOraganizationService.getFirstOrganizationsByConferenceId(conference.id) ;
       if(!organization) {
           return {
               conference,
               organization,
               locations : [],
               dates : [],
               ranks : []
           }
       }
        const locations = await this.conferenceOraganizationService.getLocationsByOrganizedId(organization.id);
        const dates = await this.conferenceOraganizationService.getDatesByOrganizedId(organization.id);
        const ranks = await this.conferenceRankService.getRankByConferenceId(conference.id);

        return {
            conference,
            organization,
            locations,
            dates,
            ranks
        }
    }

    async getFollowedByConferenceId(conferenceId: string) : Promise<ConferenceFollowByDTO[]> {
        const follows = await this.prismaService.conferenceFollows.findMany({
            where : {
                conferenceId
            },
            include : {
                byUser : {
                    select : {
                        lastName : true,
                        firstName : true,
                        email : true,
                    }
                }
            }
        })


        const results = follows.map(( follow) : ConferenceFollowByDTO => {
            return {
                id : follow.id,
                userId : follow.userId,
                user : {
                    email : follow.byUser.email,
                    firstName : follow.byUser.firstName,
                    lastName : follow.byUser.lastName
                },
                createdAt : follow.createdAt,
                updatedAt : follow.updatedAt
            }
        }
        )

        return results

    }

    async createFeedback(input : ConferenceFeedBackInputDTO)  {
        return this.prismaService.conferenceFeedbacks.create({
            data : {
                conferenceId : input.conferenceId,
                creatorId : input.creatorId,
                description : input.description,
                star : input.star,
            }
        })
    }

    async getFeedbacksByConferenceId(conferenceId : string) : Promise<ConferenceFeedBackDTO[]> {
        const feedbacks = await this.prismaService.conferenceFeedbacks.findMany({
            where : {
                conferenceId
            },
            include : {
                byUser : {
                    select : {
                        email : true,
                        firstName : true,
                        lastName : true
                    }
                }
            }
        })

        const results = feedbacks.map(( feedback ) : ConferenceFeedBackDTO => {
            return {
                id : feedback.id,
                creatorId : feedback.creatorId,
                conferenceId : feedback.conferenceId,
                description : feedback.description,
                star : feedback.star,
                createdAt : feedback.createdAt,
                updatedAt : feedback.updatedAt,
                user : {
                    email : feedback.byUser.email,
                    firstName : feedback.byUser.firstName,
                    lastName : feedback.byUser.lastName
                }
            }
        })

        return results
    }
}

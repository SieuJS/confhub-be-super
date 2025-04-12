import { PrismaService } from '../../common';
import { Injectable } from '@nestjs/common';
import { ConferenceImportDTO } from '../models/conference/conference-import.dto';
import { RankDTO } from '../../source-rank/models/rank.dto';
import { ConferenceQueryDto } from '../models/conference/conference-query.dto';
import { PaginationService } from '../../common/services/pagination.service';
import { ConferenceFilter } from '../models/conference-filter/conference.filter';
import parser from 'any-date-parser';
import { ConferenceDTO } from '../models/conference/conference.dto';
import {
  FieldOfResearchService,
  RankService,
  SourceService,
} from '../../source-rank';
import { ConferenceOrganizationSerivce } from '../../conference-organization';
import { ConferenceRankService } from './conference-rank.service';
import { ConferenceFollowByDTO } from '../models/conference-follow/conference-follow-by.dto';
import { ConferenceFeedBackDTO } from '../models/conference-feedback/conference-feedback.dto';
import { ConferenceFeedBackInputDTO } from '../models/conference-feedback/conference-feedback.input';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { ConferencePaginationDTO } from '../models/conference/conference-pagination.dto';
import { GetConferencesParams } from '../models/conference-request/get-conference-params';
import { AdminController } from 'src/modules/user/controllers/admin.controller';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { AddConferenceBody } from '../models/conference-request/add-conference-body';
import { ConferenceDetailDTO } from '../models/conference/conference-detail.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });
@Injectable()
export class ConferenceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService<any>,
    private readonly rankService: RankService,
    private readonly fieldOfResearchService: FieldOfResearchService,
    private readonly sourceService: SourceService,
    private readonly conferenceOraganizationService: ConferenceOrganizationSerivce,
    private readonly conferenceRankService: ConferenceRankService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  async getConferences(
    conferenceFilter?: GetConferencesParams,
  ): Promise<ConferencePaginationDTO> {

    const include = conferenceFilter?.mode === 'detail' ?{
      ranks: {
        include: {
          byRank: {
            include: {
              belongsToSource: true,
            },
          },
          inFieldOfResearch: true,
        },
      },
      organizations: {
        include: {
          locations: true,
          topics: {
            include: {
              inTopic: true,
            },
          },
          conferenceDates: true,
        },
      },
    } : {
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

    const whereCondition = {
      ...(conferenceFilter?.keyword
        ? {
            OR: [
              {
                title: {
                  contains: conferenceFilter?.keyword,
                  mode: 'insensitive',
                },
              },
              {
                acronym: {
                  contains: conferenceFilter?.keyword,
                  mode: 'insensitive',
                },
              },
              {
                organizations: {
                  some: {
                    topics: {
                      some: {
                        inTopic: {
                          name: {
                            contains: conferenceFilter?.keyword,
                            mode: 'insensitive',
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
                          contains: conferenceFilter?.keyword,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                },
              },
              {
                organizations: {
                  some: {
                    summerize: {
                      contains: conferenceFilter?.keyword,
                      mode: 'insensitive',
                    },
                  },
                },
              },
              {
                organizations: {
                  some: {
                    callForPaper: {
                      contains: conferenceFilter?.keyword,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          }
        : {}),

      ...(conferenceFilter?.title
        ? {
            title: {
              contains: conferenceFilter?.title,
              mode: 'insensitive',
            },
          }
        : {}),

      ...(conferenceFilter?.acronym
        ? {
            acronym: {
              contains: conferenceFilter?.acronym,
              mode: 'insensitive',
            },
          }
        : {}),

      ranks: {
        ...(conferenceFilter?.rank ||
        conferenceFilter?.source ||
        conferenceFilter?.researchFields
          ? {
              some: {
                byRank: {
                  ...(conferenceFilter?.rank
                    ? {
                        name: {
                          equals: conferenceFilter?.rank,
                          mode: 'insensitive',
                        },
                      }
                    : {}),
                  ...(conferenceFilter?.source
                    ? {
                        belongsToSource: {
                          name: {
                            contains: conferenceFilter?.source,
                            mode: 'insensitive',
                          },
                        },
                      }
                    : {}),
                  ...(conferenceFilter?.researchFields
                    ? {
                        inFieldOfResearch: {
                          name: {
                            in: conferenceFilter?.researchFields,
                            mode: 'insensitive',
                          },
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
      },

      ...(conferenceFilter?.topics ||
      conferenceFilter?.fromDate ||
      conferenceFilter?.toDate ||
      conferenceFilter?.cityStateProvince ||
      conferenceFilter?.continent ||
      conferenceFilter?.country ||
      conferenceFilter?.accessType
        ? {
            organizations: {
              some: {
                ...(conferenceFilter?.accessType
                  ? {
                      accessType: {
                        contains: conferenceFilter?.accessType,
                        mode: 'insensitive',
                      },
                    }
                  : {}),
                ...(conferenceFilter?.topics
                  ? {
                      topics: {
                        some: {
                          inTopic: {
                            name: {
                              in: conferenceFilter?.topics,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                    }
                  : {}),
                locations: {
                  some: {
                    ...(conferenceFilter?.cityStateProvince
                      ? {
                          cityStateProvince: {
                            contains: conferenceFilter?.cityStateProvince,
                            mode: 'insensitive',
                          },
                        }
                      : {}),

                    ...(conferenceFilter?.country
                      ? {
                          country: {
                            contains: conferenceFilter?.country,
                            mode: 'insensitive',
                          },
                        }
                      : {}),

                    ...(conferenceFilter?.continent
                      ? {
                          continent: {
                            contains: conferenceFilter?.continent,
                            mode: 'insensitive',
                          },
                        }
                      : {}),

                    ...(conferenceFilter?.address
                      ? {
                          address: {
                            contains: conferenceFilter?.address,
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                  },
                },
                conferenceDates: {
                  ...(conferenceFilter?.fromDate || conferenceFilter?.toDate
                    ? {
                        some: {
                          ...(conferenceFilter?.fromDate
                            ? {
                                toDate: {
                                  gte: parser.fromString(
                                    conferenceFilter?.fromDate,
                                  ),
                                },
                                type: 'conferenceDates',
                              }
                            : {}),

                          ...(conferenceFilter?.toDate
                            ? {
                                fromDate: {
                                  lte: parser.fromString(
                                    conferenceFilter?.toDate,
                                  ),
                                },
                                type: 'conferenceDates',
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
    };

    const paginatedData = await paginate(
      this.prismaService.conferences,
      {
        where: whereCondition,
        include: include,
      },
      {
        page: conferenceFilter?.page || 1,
        perPage: conferenceFilter?.perPage || 10,
      },
    );

    if(conferenceFilter?.mode === 'detail') {
      const data = paginatedData.data ;
      const cleanedData = data.map((conference : any) => ({
        id: conference.id,
        title: conference.title,
        acronym: conference.acronym,
        creatorId: conference.creatorId,
        adminId: conference.adminId,
        createdAt: conference.createdAt,
        updatedAt: conference.updatedAt,
        status: conference.status,
        ranks: conference.ranks.map((rank) => ({
          year: rank.year,
          rank: rank.byRank?.name,
          source: rank.byRank?.belongsToSource?.name,
          researchField: rank.inFieldOfResearch?.name,
        })),
        organizations: conference.organizations.map((org) => ({
          year: org.year,
          accessType: org.accessType,
          summary: org.summerize,
          callForPaper: org.callForPaper,
          link: org.link,
          cfpLink: org.cfpLink,
          locations: org.locations.map((loc) => ({
            address: loc.address,
            cityStateProvince: loc.cityStateProvince,
            country: loc.country,
            continent: loc.continent,
          })),
          topics: org.topics.map((topic) => topic.inTopic?.name),
          conferenceDates: org.conferenceDates.map((date) => ({
            fromDate: date.fromDate,
            toDate: date.toDate,
            type: date.type,
            name: date.name,
          })),
        })),
      }));
      return {
        payload : cleanedData,
        meta : paginatedData.meta
      } as any
    }

    const conferences = paginatedData.data as any;
    const conferenceToResponse: ConferenceDTO[] = await Promise.all(
      conferences.map(async (conference) => {
        const rank = await this.conferenceRankService.getRankByConferenceFilter(
          conference.id,
          conferenceFilter,
        );
        
        const organization =
          await this.conferenceOraganizationService.getFirstOrganizationsByConferenceId(
            conference.id,
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
            rank: rank?.rank || '',
            source: rank?.source || '',
            year: conference.ranks[0]?.year,
            researchFields: conference.ranks.map(
              (rank) => rank.inFieldOfResearch.name,
            ),
            topics: [],
            dates: {
              fromDate: new Date(),
              toDate: new Date(),
              name: '',
              type: 'conferenceDates',
            },
            link: '',
            createdAt: conference.createdAt,
            updatedAt: conference.updatedAt,
            creatorId: conference.creatorId,
            accessType: '',
            status: conference.status,
          };
        }
        const topics = await this.conferenceOraganizationService.getAllTopicsByOrganizedId(
          organization.id)

        const locations =
          await this.conferenceOraganizationService.getLocationsByOrganizedId(
            organization.id,
          );
        if (locations.length === 0) {
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
            year: 0,
            researchFields: [],
            topics: [],
            dates: {
              fromDate: new Date(),
              toDate: new Date(),
              name: '',
              type: 'conferenceDates',
            },
            link: '',
            createdAt: conference.createdAt,
            updatedAt: conference.updatedAt,
            creatorId: conference.creatorId,
            accessType: '',
            status: conference.status,
          };
        }
        const dates =
          await this.conferenceOraganizationService.getDatesByOrganizedId(
            organization.id,
          );
        if (dates.length === 0) {
          return {
            id: conference.id,
            title: conference.title,
            acronym: conference.acronym,
            location: {
              cityStateProvince: locations[0].cityStateProvince ?? '',
              country: locations[0].country ?? '',
              address: locations[0].address ?? '',
              continent: locations[0].continent ?? '',
            },
            rank: conference.ranks[0]?.byRank?.name,
            source: conference.ranks[0]?.byRank?.belongsToSource.name,
            year: conference.ranks[0]?.year,
            researchFields: conference.ranks.map(
              (rank) => rank.inFieldOfResearch.name,
            ),
            topics,
            dates: {
              fromDate: new Date(),
              toDate: new Date(),
              name: '',
              type: 'conferenceDates',
            },
            link: organization.link,
            createdAt: conference.createdAt,
            updatedAt: conference.updatedAt,
            creatorId: conference.creatorId,
            adminId: conference.adminId,
            accessType: organization.accessType,
            status: conference.status,
          };
        }

        const conferenceDTO: ConferenceDTO = {
          id: conference.id,
          title: conference.title,
          acronym: conference.acronym,
          location: {
            cityStateProvince: locations[0].cityStateProvince || '',
            country: locations[0].country || '',
            address: locations[0].address || '',
            continent: locations[0].continent || '',
          },
          rank: conference.ranks[0]?.byRank?.name,
          source: conference.ranks[0]?.byRank?.belongsToSource.name,
          year: conference.ranks[0]?.year,
          researchFields: conference.ranks.map(
            (rank) => rank.inFieldOfResearch.name,
          ),
          topics : topics.map((topic) => topic.inTopic.name),
          dates: dates
            .filter((date) => {
              return date.type === 'conferenceDates';
            })
            .map((date) => {
              return {
                fromDate: date.fromDate,
                toDate: date.toDate,
                name: date.name,
                type: date.type,
                createdAt: date.createdAt,
                updatedAt: date.updatedAt,
              };
            })[0],
          link: organization.link,
          createdAt: conference.createdAt,
          updatedAt: conference.updatedAt,
          creatorId: conference.creatorId,
          adminId: conference.adminId,
          accessType: organization.accessType,
          status: conference.status,
        };
        return conferenceDTO;
      }),
    );
    return {
      payload: conferenceToResponse,
      meta: {
        curPage: paginatedData.meta.currentPage,
        perPage: paginatedData.meta.perPage,
        totalItems: paginatedData.meta.total,
        totalPage: paginatedData.meta.lastPage,
        prevPage: paginatedData.meta.prev,
        nextPage: paginatedData.meta.next,
      },
    };
  }

  async getConferencesWithDetail () {
    const conferences = await this.prismaService.conferences.findMany({
      include: {
        ranks: {
          include: {
            byRank: {
              include: {
                belongsToSource: true,
              },
            },
            inFieldOfResearch: true,
          },
        },
        organizations: {
          include: {
            locations: true,
            topics: true,
            conferenceDates: true,
          },
        },
      },
    });
    return conferences;
  }

  async getConferenceById(id: string) {
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

  async createConference(conference: {
    title: string;
    acronym: string;
    adminId?: string;
    creatorId?: string;
  }) {
    if (
      await this.isExistsConferenceNameAndAcronym(
        conference.title,
        conference.acronym,
      )
    ) {
      throw new Error(
        `Conference with title ${conference.title} and acronym ${conference.acronym} already exists`,
      );
    }

    return await this.prismaService.conferences.create({
      data: {
        ...conference,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async findOrCreateConference(conference: ConferenceImportDTO) {
    const existingConference = await this.prismaService.conferences.findFirst({
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
        adminId: conference.adminId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async importConferences(conference: ConferenceImportDTO) {
    const conferenceInstance = await this.findOrCreateConference(conference);
  }

  async createConferenceRank(
    conferenceId: string,
    rankInstance: RankDTO,
    fieldOfResearchId: string,
    year: number,
  ) {
    return await this.txHost.tx.conferenceRanks.create({
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
    year: number,
  ) {
    const existingRank = await this.txHost.tx.conferenceRanks.findFirst({
      where: {
        conferenceId,
        rankId: rankInstance.id,
        fieldOfResearchId,
        year,
      },
    });

    if (existingRank) {
      return existingRank;
    }

    return await this.createConferenceRank(
      conferenceId,
      rankInstance,
      fieldOfResearchId,
      year,
    );
  }

  async getConferenceByAcronymAndTitle(title: string, acronym: string) {
    return await this.prismaService.conferences.findFirst({
      where: {
        title: {
          contains: !!title ? title.trim() : '',
          mode: 'insensitive',
        },
        acronym: {
          contains: !!acronym ? acronym.trim() : '',
          mode: 'insensitive',
        },
      },
    });
  }

  async createConferenceByImport(conferenceImport: ConferenceImportDTO) {
    return this.prismaService.conferences.create({
      data: {
        title: conferenceImport.title,
        acronym: conferenceImport.acronym,
        adminId: conferenceImport.adminId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  
  async getFollowedByConferenceId(
    conferenceId: string,
  ): Promise<ConferenceFollowByDTO[]> {
    const follows = await this.prismaService.conferenceFollows.findMany({
      where: {
        conferenceId,
      },
      include: {
        byUser: {
          select: {
            lastName: true,
            firstName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    const results = follows.map((follow): ConferenceFollowByDTO => {
      return {
        id: follow.id,
        userId: follow.userId,
        user: {
          avatar: follow.byUser.avatar,
          firstName: follow.byUser.firstName,
          lastName: follow.byUser.lastName,
        },
        createdAt: follow.createdAt,
        updatedAt: follow.updatedAt,
      };
    });

    return results;
  }

  async createFeedback(input: ConferenceFeedBackInputDTO) {
    return this.prismaService.conferenceFeedbacks.create({
      data: {
        conferenceId: input.conferenceId,
        creatorId: input.creatorId,
        description: input.description,
        star: input.star,
      },
    });
  }

  async getFeedbacksByConferenceId(
    conferenceId: string,
  ): Promise<ConferenceFeedBackDTO[]> {
    const feedbacks = await this.prismaService.conferenceFeedbacks.findMany({
      where: {
        conferenceId,
      },
      include: {
        byUser: {
          select: {
            avatar: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const results = feedbacks.map((feedback): ConferenceFeedBackDTO => {
      return {
        id: feedback.id,
        creatorId: feedback.creatorId,
        conferenceId: feedback.conferenceId,
        description: feedback.description,
        star: feedback.star,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt,
        avatar: feedback.byUser.avatar,
        firstName: feedback.byUser.firstName,
        lastName: feedback.byUser.lastName,
      };
    });

    return results;
  }

  async getCreatorIdByConferenceId(conferenceId: string) {
    const conference = await this.prismaService.conferences.findUnique({
      where: {
        id: conferenceId,
      },
    });
    if (!conference) {
      return undefined;
    }
    return conference.creatorId;
  }

  async isCrawledConference(conferenceId: string) {
    const conferenceOrganization =
      await this.conferenceOraganizationService.getConferenceDatesByOrganizedId(
        conferenceId,
      );
    if (conferenceOrganization.length > 0) {
      return true;
    }
    return false;
  }

}



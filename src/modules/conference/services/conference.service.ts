/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaService } from '../../common';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConferenceImportDTO } from '../models/conference/conference-import.dto';
import { RankDTO } from '../../source-rank/models/rank.dto';
import parser from 'any-date-parser';
import { ConferenceDTO } from '../models/conference/conference.dto';

import { ConferenceOrganizationSerivce } from '../../conference-organization';
import { ConferenceRankService } from './conference-rank.service';
import { ConferenceFollowByDTO } from '../models/conference-follow/conference-follow-by.dto';
import { ConferenceFeedBackDTO } from '../models/conference-feedback/conference-feedback.dto';
import { ConferenceFeedBackInputDTO } from '../models/conference-feedback/conference-feedback.input';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { ConferencePaginationDTO } from '../models/conference/conference-pagination.dto';
import {
  GetConferencesParams,
  GetConferencesSortParams,
} from '../models/conference-request/get-conference-params';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import * as crypto from 'crypto';
import { ConferenceDetailDTO } from '../models/conference/conference-detail.dto';
import { ConferenceBlacklistByDTO } from '../models/conference-blacklist/conference-added-blacklist-by.dto';
import { Prisma, Topics } from 'generated/prisma_client';
import { ConferencePostRequestStatus } from 'src/modules/admin-conference/models/conference-request-post.dto';
import { RecommendService } from 'src/modules/recommend/services/recommend.service';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });
@Injectable()
export class ConferenceService {
  private readonly logger = new Logger(ConferenceService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly conferenceOraganizationService: ConferenceOrganizationSerivce,
    private readonly conferenceRankService: ConferenceRankService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly cacheService: RedisCacheService,
    private readonly recommendService: RecommendService,
  ) {}

  async getConferences(
    conferenceFilter?: GetConferencesParams,
    sortOptions?: GetConferencesSortParams,
  ): Promise<ConferencePaginationDTO> {
    // Generate cache key based on filters and sort options
    const result = await this.getConferencesFromDB(
      conferenceFilter,
      sortOptions,
    );

    return result;
  }

  private generateCacheKey(operation: string, params: any): string {
    const keyData = JSON.stringify(params);
    const hash = crypto.createHash('sha256').update(keyData).digest('hex');
    return `conferences:${operation}:${hash}`;
  }

  private async getConferencesFromDB(
    conferenceFilter?: GetConferencesParams,
    sortOptions?: GetConferencesSortParams,
  ): Promise<ConferencePaginationDTO> {
    let geminiAnalyzedSubmissionTypes: string[] = [];

    if (conferenceFilter?.subFromDate || conferenceFilter?.subToDate) {
      try {
        const mainSubmissionDateNames =
          await this.conferenceOraganizationService.getMainSubmissionDateNames();

        if (mainSubmissionDateNames.length > 0) {
          geminiAnalyzedSubmissionTypes = mainSubmissionDateNames;
          this.logger.log(
            `Using ${geminiAnalyzedSubmissionTypes.length} pre-classified main submission date types`,
          );
        } else {
          this.logger.warn(
            'No pre-classified main submission dates found, falling back to standard filtering',
          );
        }
      } catch (error) {
        this.logger.warn(
          'Failed to get pre-classified main submission dates, falling back to standard filtering',
          error,
        );
        geminiAnalyzedSubmissionTypes = [];
      }
    }
    const accessType = conferenceFilter?.type
      ? conferenceFilter.type
      : conferenceFilter?.accessType;
    if (conferenceFilter) {
      conferenceFilter.accessType = accessType;
    }

    let orderBy: Prisma.ConferencesOrderByWithRelationInput = {};
    const include: Prisma.ConferencesInclude =
      conferenceFilter?.mode === 'detail'
        ? {
            ranks: {
              include: {
                byRank: {
                  include: {
                    belongsToSource: true,
                  },
                },
                inFieldOfResearch: true,
              },
              ...(sortOptions?.sortBy === 'rank'
                ? {
                    orderBy: {
                      byRank: {
                        name: sortOptions?.sortOrder || 'desc',
                      },
                    },
                  }
                : {}),
              ...(sortOptions?.sortBy === 'source'
                ? {
                    orderBy: {
                      byRank: {
                        belongsToSource: {
                          name: sortOptions?.sortOrder || 'desc',
                        },
                      },
                    },
                  }
                : {}),
            },
            organizations: {
              include: {
                locations: true,
                topics: {
                  include: {
                    inTopic: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
                conferenceDates: true,
              },
              orderBy: [
                {
                  isLastest: Prisma.SortOrder.desc,
                },
                {
                  updatedAt: Prisma.SortOrder.desc,
                },
              ],
            },
          }
        : {
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
              ...(sortOptions?.sortBy === 'rank'
                ? {
                    orderBy: {
                      byRank: {
                        name: sortOptions?.sortOrder || 'desc',
                      },
                    },
                  }
                : {}),
              ...(sortOptions?.sortBy === 'source'
                ? {
                    orderBy: {
                      byRank: {
                        belongsToSource: {
                          name: sortOptions?.sortOrder || 'desc',
                        },
                      },
                    },
                  }
                : {}),
            },
            follows: true,
            organizations: {
              include: {
                conferenceDates: true,
              },
            }, // Include organizations for sorting
          };
    // Only use standard orderBy for non-rank/source fields
    if (sortOptions?.sortBy !== 'rank' && sortOptions?.sortBy !== 'source') {
      // For date-based sorting and follower count, we'll handle it after fetching data
      if (
        !sortOptions?.sortBy ||
        sortOptions?.sortBy === 'conferenceDate' ||
        sortOptions?.sortBy === 'submissionDate' ||
        sortOptions?.sortBy === 'match' ||
        sortOptions?.sortBy === 'type'
      ) {
        // No DB-level orderBy for nested conferenceDates
        orderBy = {};
      } else {
        orderBy = {
          [sortOptions?.sortBy]: sortOptions?.sortOrder || 'desc',
        };
      }
    }

    const whereCondition: Prisma.ConferencesWhereInput = {
      ...(conferenceFilter?.keyword
        ? {
            OR: [
              {
                title: {
                  contains: conferenceFilter?.keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                acronym: {
                  contains: conferenceFilter?.keyword,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                organizations: {
                  some: {
                    topics: {
                      some: {
                        inTopic: {
                          name: {
                            equals: conferenceFilter?.keyword,
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
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),

      ...(conferenceFilter?.acronym
        ? {
            acronym: {
              equals: conferenceFilter?.acronym,
              mode: Prisma.QueryMode.insensitive,
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
                        ...(conferenceFilter.rank === 'other'
                          ? {
                              name: {
                                not: {
                                  in: ['A', 'B', 'C', 'D', 'A*'],
                                },
                              },
                            }
                          : {
                              name: {
                                equals: conferenceFilter?.rank,
                                mode: 'insensitive',
                              },
                            }),
                      }
                    : {}),
                  ...(conferenceFilter?.source
                    ? {
                        belongsToSource: {
                          ...(conferenceFilter.source !== 'other'
                            ? {
                                name: {
                                  equals: conferenceFilter?.source,
                                  mode: 'insensitive',
                                },
                              }
                            : {
                                name: {
                                  not: {
                                    in: [
                                      'CORE',
                                      'CORE21',
                                      'CORE23',
                                      'CORE24',
                                      'CORE25',
                                      'CORE26',
                                      'CORE27',
                                    ],
                                  },
                                },
                              }),
                        },
                      }
                    : {}),
                },
                ...(conferenceFilter?.researchFields &&
                Array.isArray(conferenceFilter.researchFields) &&
                conferenceFilter.researchFields.length > 0
                  ? {
                      OR: conferenceFilter.researchFields.map(
                        (field: string) => ({
                          inFieldOfResearch: {
                            name: {
                              contains: field.trim(),
                              mode: 'insensitive',
                            },
                          },
                        }),
                      ),
                    }
                  : conferenceFilter?.researchFields &&
                      typeof conferenceFilter.researchFields === 'string'
                    ? {
                        inFieldOfResearch: {
                          name: {
                            contains: conferenceFilter.researchFields.trim(),
                            mode: 'insensitive',
                          },
                        },
                      }
                    : {}),
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
      conferenceFilter?.accessType ||
      conferenceFilter?.subFromDate ||
      conferenceFilter?.subToDate ||
      conferenceFilter?.publisher ||
      conferenceFilter?.cameraReadyFromDate ||
      conferenceFilter?.cameraReadyToDate ||
      conferenceFilter?.registerationFromDate ||
      conferenceFilter?.registerationToDate
        ? {
            organizations: {
              some: {
                AND: [
                  { isLastest: true }, // Ensure we only get the latest organization
                  ...(conferenceFilter?.accessType
                    ? [
                        {
                          accessType: {
                            contains: conferenceFilter?.accessType,
                            mode: Prisma.QueryMode.insensitive,
                          },
                        },
                      ]
                    : []),
                  ...(conferenceFilter?.topics
                    ? [
                        {
                          topics: {
                            some: {
                              inTopic: {
                                name: {
                                  in: conferenceFilter?.topics,
                                  mode: Prisma.QueryMode.insensitive,
                                },
                              },
                            },
                          },
                        },
                      ]
                    : []),
                  ...(conferenceFilter?.publisher
                    ? [
                        {
                          publisher: {
                            contains: conferenceFilter?.publisher,
                            mode: Prisma.QueryMode.insensitive,
                          },
                        },
                      ]
                    : []),
                  ...(conferenceFilter?.cityStateProvince ||
                  conferenceFilter?.country ||
                  conferenceFilter?.continent ||
                  conferenceFilter?.address
                    ? [
                        {
                          locations: {
                            some: {
                              ...(conferenceFilter?.cityStateProvince
                                ? {
                                    cityStateProvince: {
                                      contains:
                                        conferenceFilter?.cityStateProvince,
                                      mode: Prisma.QueryMode.insensitive,
                                    },
                                  }
                                : {}),

                              ...(conferenceFilter?.country
                                ? {
                                    country: {
                                      contains: conferenceFilter?.country,
                                      mode: Prisma.QueryMode.insensitive,
                                    },
                                  }
                                : {}),

                              ...(conferenceFilter?.continent
                                ? {
                                    continent: {
                                      contains: conferenceFilter?.continent,
                                      mode: Prisma.QueryMode.insensitive,
                                    },
                                  }
                                : {}),

                              ...(conferenceFilter?.address
                                ? {
                                    address: {
                                      contains: conferenceFilter?.address,
                                      mode: Prisma.QueryMode.insensitive,
                                    },
                                  }
                                : {}),
                            },
                          },
                        },
                      ]
                    : []),
                  // Conference dates filter
                  ...(conferenceFilter?.fromDate || conferenceFilter?.toDate
                    ? [
                        {
                          conferenceDates: {
                            some: {
                              AND: [
                                { type: 'conferenceDates' },
                                ...(conferenceFilter?.fromDate
                                  ? [
                                      {
                                        toDate: {
                                          gte: parser.fromString(
                                            conferenceFilter?.fromDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                                ...(conferenceFilter?.toDate
                                  ? [
                                      {
                                        fromDate: {
                                          lte: parser.fromString(
                                            conferenceFilter?.toDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                              ],
                            },
                          },
                        },
                      ]
                    : []),
                  // Submission dates filter
                  ...(conferenceFilter?.subFromDate ||
                  conferenceFilter?.subToDate
                    ? [
                        {
                          conferenceDates: {
                            some: {
                              AND: [
                                { type: 'submissionDate' },
                                ...(conferenceFilter?.subFromDate
                                  ? [
                                      {
                                        toDate: {
                                          gte: parser.fromString(
                                            conferenceFilter?.subFromDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                                ...(conferenceFilter?.subToDate
                                  ? [
                                      {
                                        fromDate: {
                                          lte: parser.fromString(
                                            conferenceFilter?.subToDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                              ],
                            },
                          },
                        },
                      ]
                    : []),
                  // Camera ready dates filter
                  ...(conferenceFilter?.cameraReadyFromDate ||
                  conferenceFilter?.cameraReadyToDate
                    ? [
                        {
                          conferenceDates: {
                            some: {
                              AND: [
                                { type: 'cameraReadyDate' },
                                ...(conferenceFilter?.cameraReadyFromDate
                                  ? [
                                      {
                                        toDate: {
                                          gte: parser.fromString(
                                            conferenceFilter?.cameraReadyFromDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                                ...(conferenceFilter?.cameraReadyToDate
                                  ? [
                                      {
                                        fromDate: {
                                          lte: parser.fromString(
                                            conferenceFilter?.cameraReadyToDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                              ],
                            },
                          },
                        },
                      ]
                    : []),
                  // Registration dates filter
                  ...(conferenceFilter?.registerationFromDate ||
                  conferenceFilter?.registerationToDate
                    ? [
                        {
                          conferenceDates: {
                            some: {
                              AND: [
                                { type: 'registrationDate' },
                                ...(conferenceFilter?.registerationFromDate
                                  ? [
                                      {
                                        toDate: {
                                          gte: parser.fromString(
                                            conferenceFilter?.registerationFromDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                                ...(conferenceFilter?.registerationToDate
                                  ? [
                                      {
                                        fromDate: {
                                          lte: parser.fromString(
                                            conferenceFilter?.registerationToDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                              ],
                            },
                          },
                        },
                      ]
                    : []),
                  // Notification dates filter
                  ...(conferenceFilter?.notificationFromDate ||
                  conferenceFilter?.notificationToDate
                    ? [
                        {
                          conferenceDates: {
                            some: {
                              AND: [
                                { type: 'notificationDate' },
                                ...(conferenceFilter?.notificationFromDate
                                  ? [
                                      {
                                        toDate: {
                                          gte: parser.fromString(
                                            conferenceFilter?.notificationFromDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                                ...(conferenceFilter?.notificationToDate
                                  ? [
                                      {
                                        fromDate: {
                                          lte: parser.fromString(
                                            conferenceFilter?.notificationToDate,
                                          ),
                                        },
                                      },
                                    ]
                                  : []),
                              ],
                            },
                          },
                        },
                      ]
                    : []),
                ],
              },
            },
          }
        : {}),
      NOT: {
        status: {
          in: ['pending', 'deleted', 'rejected'],
        },
      },
    };

    // Always fetch all matching conferences for recommendation sorting
    const allConferences = await this.prismaService.conferences.findMany({
      where: whereCondition,
      orderBy: orderBy,
      include: include,
    });

    let sortedConferences = allConferences;

    // If recommendId is present, sort by recommendation score
    if (conferenceFilter?.sortBy === 'submissionDate') {
      sortedConferences = [...allConferences].sort((a, b) => {
        const getSubmissionDate = (conf: any): Date | null => {
          const org = conf.organizations?.find((o: any) => o.isLastest);
          if (!org || !org.conferenceDates) return null;
          const subDate = org.conferenceDates.find(
            (d: any) => d.type === 'submissionDate',
          );
          return subDate ? new Date(subDate.fromDate) : null;
        };
        const dateA = getSubmissionDate(a);
        const dateB = getSubmissionDate(b);
        if (dateA && dateB) {
          return sortOptions?.sortOrder === 'asc'
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
        } else if (dateA) {
          return -1; // a comes first
        } else if (dateB) {
          return 1; // b comes first
        }
        return 0; // equal
      });
    } else if (conferenceFilter?.sortBy === 'conferenceDate') {
      sortedConferences = [...allConferences].sort((a, b) => {
        const getConferenceDate = (conf: any): Date | null => {
          const org = conf.organizations?.find((o: any) => o.isLastest);
          if (!org || !org.conferenceDates) return null;
          const confDate = org.conferenceDates.find(
            (d: any) => d.type === 'conferenceDate',
          );
          return confDate ? new Date(confDate.fromDate) : null;
        };
        const dateA = getConferenceDate(a);
        const dateB = getConferenceDate(b);
        if (dateA && dateB) {
          return sortOptions?.sortOrder === 'asc'
            ? dateA.getTime() - dateB.getTime()
            : dateB.getTime() - dateA.getTime();
        } else if (dateA) {
          return -1; // a comes first
        } else if (dateB) {
          return 1; // b comes first
        }
        return 0; // equal
      });
    } else if (conferenceFilter?.sortBy === 'type') {
      sortedConferences = [...allConferences].sort((a, b) => {
        const getAccessType = (conf: any): string | null => {
          const org = conf.organizations?.find((o: any) => o.isLastest);
          return org ? org.accessType || null : null;
        };
        const typeA = getAccessType(a) || '';
        const typeB = getAccessType(b) || '';
        return sortOptions?.sortOrder === 'asc'
          ? typeA.localeCompare(typeB)
          : typeB.localeCompare(typeA);
      });
    } else if (
      conferenceFilter?.sortBy === 'match' &&
      conferenceFilter?.recommendId &&
      allConferences.length > 0
    ) {
      const recommendId = conferenceFilter.recommendId;
      // Get recommendations with scores from the recommendService
      const recommendedConferences =
        await this.recommendService.getRecommendations({
          conference_ids: allConferences.map((conf) => conf.id),
          user_id: recommendId,
        });
      // recommendedConferences should be an array of { id, score }
      const scoreMap = new Map<string, number>();
      if (Array.isArray(recommendedConferences)) {
        recommendedConferences.forEach((rec: { id: string; score: number }) => {
          scoreMap.set(rec.id, rec.score);
        });
      }
      // Sort allConferences by score (descending), fallback to 0 if not found
      sortedConferences = [...allConferences].sort((a, b) => {
        const scoreA = scoreMap.get(a.id) ?? 0;
        const scoreB = scoreMap.get(b.id) ?? 0;
        return scoreB - scoreA;
      });
    }

    // Paginate if page/perPage is provided
    let paginatedData;
    if (conferenceFilter?.page || conferenceFilter?.perPage) {
      const page = conferenceFilter?.page || 1;
      const perPage = conferenceFilter?.perPage || 10;
      const total = sortedConferences.length;
      const lastPage = Math.ceil(total / perPage);
      const start = (page - 1) * perPage;
      const end = start + perPage;
      paginatedData = {
        data: sortedConferences.slice(start, end),
        meta: {
          currentPage: page,
          perPage,
          total,
          lastPage,
          prev: page > 1 ? page - 1 : null,
          next: page < lastPage ? page + 1 : null,
        },
      };
    } else {
      paginatedData = {
        data: sortedConferences,
        meta: {
          currentPage: 1,
          perPage: sortedConferences.length,
          total: sortedConferences.length,
          lastPage: 1,
          prev: null,
          next: null,
        },
      };
    }

    // ...existing code...

    if (conferenceFilter?.mode === 'detail') {
      const data = paginatedData.data;
      const cleanedData = data.map((conference: any) => ({
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
        organizations: conference.organizations
          .map((org) => ({
            year: org.year,
            accessType: org.accessType,
            summary: org.summerize,
            callForPaper: org.callForPaper,
            link: org.link,
            publisher: org.publisher || '',
            cfpLink: org.cfpLink,
            locations: org.locations.map((loc) => ({
              address: loc.address,
              cityStateProvince: loc.cityStateProvince,
              country: loc.country,
              continent: loc.continent,
            })),
            topics: org.topics.map((topic) => topic.inTopic?.name),
            isLastest: !!org.isLastest,
            dates: org.conferenceDates.map((date) => ({
              fromDate: date.fromDate,
              toDate: date.toDate,
              type: date.type,
              name: date.name,
            })),
          }))
          // Organizations are already sorted by isLastest DESC, updatedAt DESC from the query
          .slice(0, 2) // Take first 2 organizations (latest first)
          .map((org, index, arr) =>
            arr.length === 1
              ? org
              : index === 0
                ? org // Keep all data for the first (latest) organization
                : {
                    ...org,
                    topics: [], // Remove topics for older organization
                    callForPaper: '', // Remove call for paper for older organization
                    summary: '', // Remove summary for older organization
                  },
          ),
      }));
      return {
        payload: cleanedData,
        meta: {
          curPage: paginatedData.meta.currentPage,
          perPage: paginatedData.meta.perPage,
          totalItems: paginatedData.meta.total,
          totalPage: paginatedData.meta.lastPage,
          prevPage: paginatedData.meta.prev,
          nextPage: paginatedData.meta.next,
        },
      } as any;
    }

    const conferences = paginatedData.data;
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
              fromDate: null,
              toDate: null,
              name: '',
              type: 'conferenceDates',
            },
            link: '',
            createdAt: conference.createdAt,
            updatedAt: conference.updatedAt,
            creatorId: conference.creatorId,
            accessType: '',
            status: conference.status,
            isLastest: false, // No organization means no latest flag
          };
        }
        const topics =
          await this.conferenceOraganizationService.getAllTopicsByOrganizedId(
            organization.id,
          );

        const locations =
          await this.conferenceOraganizationService.getLocationsByOrganizedId(
            organization.id,
          );
        const dates =
          await this.conferenceOraganizationService.getDatesByOrganizedId(
            organization.id,
          );
        return {
          id: conference.id,
          title: conference.title,
          acronym: conference.acronym,
          location:
            locations.length > 0
              ? {
                  cityStateProvince: locations[0].cityStateProvince ?? '',
                  country: locations[0].country ?? '',
                  address: locations[0].address ?? '',
                  continent: locations[0].continent ?? '',
                }
              : null,
          rank: conference.ranks[0]?.byRank?.name,
          source: conference.ranks[0]?.byRank?.belongsToSource.name,
          year: conference.ranks[0]?.year,
          researchFields: conference.ranks.map(
            (rank) => rank.inFieldOfResearch.name,
          ),
          topics: topics.map((topic) => topic.inTopic.name),
          publisher: organization.publisher || '',

          dates:
            dates.length > 0
              ? dates.filter((date) => date.type === 'conferenceDates')[0]
              : {
                  fromDate: null,
                  toDate: null,
                  name: '',
                  type: 'conferenceDates',
                },
          submissionDates: dates.filter((date) => {
            // Filter for submission dates that fall within the specified date range
            if (
              !conferenceFilter?.subFromDate ||
              !conferenceFilter?.subToDate
            ) {
              return false; // If no date filters, include all submission dates
            }
            if (!date.fromDate || !date.toDate) return false;

            // Check if this is a main submission date (if we have pre-classified data)
            if (!(date.type === 'submissionDate')) {
              return false; // Only include main submission dates
            }

            // Date range filtering: Include dates that overlap with the filter range
            // A date overlaps if: date.toDate >= subFromDate AND date.fromDate <= subToDate
            const subFromDate = conferenceFilter?.subFromDate
              ? parser.fromString(conferenceFilter.subFromDate)
              : null;
            const subToDate = conferenceFilter?.subToDate
              ? parser.fromString(conferenceFilter.subToDate)
              : null;

            // If no date filters are specified, include all main submission dates
            if (!subFromDate && !subToDate) return true;

            // Check for date range overlap
            const dateStart = new Date(date.fromDate);
            const dateEnd = new Date(date.toDate);

            // If only subFromDate is specified: include dates that end on or after subFromDate
            if (subFromDate && !subToDate) {
              return dateEnd >= subFromDate;
            }

            // If only subToDate is specified: include dates that start on or before subToDate
            if (!subFromDate && subToDate) {
              return dateStart <= subToDate;
            }

            // If both dates are specified: include dates that overlap with the range
            if (subFromDate && subToDate) {
              return dateEnd >= subFromDate && dateStart <= subToDate;
            }

            return false;
          }),
          link: organization.link,
          createdAt: conference.createdAt,
          updatedAt: conference.updatedAt,
          creatorId: conference.creatorId,
          adminId: conference.adminId,
          accessType: organization.accessType,
          status: conference.status,
          isLastest: true, // This organization is the latest since getFirstOrganizationsByConferenceId filters by isLastest: true
        };
      }),
    );

    // Custom sorting logic for date proximity and follower count
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

  async getConferencesWithDetail() {
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

  async getConferenceById(id: string, force = false) {
    return await this.prismaService.conferences.findUnique({
      where: {
        id,
        ...(!force
          ? {
              status: {
                not: ConferencePostRequestStatus.REJECTED,
              },
            }
          : {}),
      },
    });
  }

  async isExistsConferenceNameAndAcronym(title: string, acronym: string) {
    const conference = await this.txHost.tx.conferences.findFirst({
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
      throw new HttpException(
        `Conference with title ${conference.title} and acronym ${conference.acronym} already exists`,
        400,
      );
    }

    const result = await this.txHost.tx.conferences.create({
      data: {
        ...conference,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Invalidate cache after creating conference
    await this.invalidateConferenceCache();

    return result;
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
    await this.findOrCreateConference(conference);
  }

  async createConferenceRank(
    conferenceId: string,
    rankInstance: RankDTO,
    fieldOfResearchId: string,
    year?: number,
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
    year?: number,
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
    const conferences = await this.txHost.tx.conferences.findFirst({
      where: {
        title: {
          equals: title.trim(),
          mode: 'insensitive',
        },
        acronym: {
          equals: acronym.trim(),
          mode: 'insensitive',
        },
      },
    });

    return conferences;
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

  async getConferenceByIdWithDetail(
    conferenceId: string,
  ): Promise<ConferenceDetailDTO | undefined> {
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
            inFieldOfResearch: true,
          },
        },
        organizations: {
          include: {
            locations: true,
            topics: {
              include: {
                inTopic: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            conferenceDates: true,
          },
          orderBy: [
            {
              isLastest: 'desc',
            },
            {
              updatedAt: 'desc',
            },
          ],
        },
        feedbacks: {
          include: {
            byUser: true,
          },
        },

        follows: {
          include: {
            byUser: true,
          },
        },
      },
    });
    if (!conference) {
      return undefined;
    }
    return {
      id: conference.id,
      title: conference.title,
      acronym: conference.acronym,
      creatorId: conference.creatorId,
      adminId: conference.adminId ?? undefined,
      createdAt: conference.createdAt,
      updatedAt: conference.updatedAt,
      status: conference.status,
      ranks: conference.ranks.map((rank) => ({
        year: rank.year,
        rank: rank.byRank?.name,
        source: rank.byRank?.belongsToSource?.name,
        fieldOfResearch: rank.inFieldOfResearch?.name,
      })),
      organizations: conference.organizations
        .map((org) => ({
          id: org.id,
          isAvailable: org.isAvailable,
          isLastest: org.isLastest,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
          conferenceId: org.conferenceId,
          year: org.year,
          accessType: org.accessType,
          summary: org.summerize,
          callForPaper: org.callForPaper,
          link: org.link,
          impLink: org.impLink,
          cfpLink: org.cfpLink,
          summerize: org.summerize,
          publisher: org.publisher,
          locations: org.locations.map((loc) => ({
            address: loc.address ?? undefined,
            cityStateProvince: loc.cityStateProvince ?? undefined,
            country: loc.country ?? undefined,
            continent: loc.continent ?? undefined,
          })),
          topics: org.topics.map((topic) => topic.inTopic?.name),
          conferenceDates: org.conferenceDates.map((date) => ({
            fromDate: date.fromDate,
            toDate: date.toDate,
            type: date.type,
            name: date.name,
          })),
        }))
        .sort((a, b) => {
          // Sort isLastest true first (descending)
          if (a.isLastest && !b.isLastest) return -1;
          if (!a.isLastest && b.isLastest) return 1;
          return 0;
        })
        .map((org, index) => {
          if (index === 0) {
            return { ...org };
          }
          return {
            locations: org.locations,
            conferenceDates: org.conferenceDates,
          };
        }),
      feedbacks: conference.feedbacks.map((feedback) => ({
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
      })),
      followBy: conference.follows.map((follow) => ({
        id: follow.id,
        userId: follow.userId,
        createdAt: follow.createdAt,
        updatedAt: follow.updatedAt,
        user: {
          avatar: follow.byUser.avatar,
          firstName: follow.byUser.firstName,
          lastName: follow.byUser.lastName,
        },
      })),
    };
  }
  async getConferenceInfo(
    conferenceId: string,
  ): Promise<ConferenceDTO | undefined> {
    const conference = await this.prismaService.conferences.findUnique({
      where: {
        id: conferenceId,
      },
      include: {
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
      },
    });
    if (!conference) {
      return undefined;
    }
    const hasRank = conference.ranks.length > 0;
    const formated: ConferenceDTO = {
      id: conference.id,
      title: conference.title,
      acronym: conference.acronym,
      location: {
        address: conference.organizations[0].locations[0].address,
        cityStateProvince:
          conference.organizations[0].locations[0].cityStateProvince,
        country: conference.organizations[0].locations[0].country,
        continent: conference.organizations[0].locations[0].continent,
      },
      rank: hasRank ? conference.ranks[0].byRank.name : undefined,
      source: hasRank
        ? conference.ranks[0].byRank.belongsToSource.name
        : undefined,
      year: hasRank ? conference.ranks[0].year : undefined,
      researchFields: hasRank
        ? conference.ranks.map((rank) => rank.inFieldOfResearch.name)
        : undefined,
      topics: conference.organizations[0].topics.map(
        (topic) => topic.inTopic.name,
      ),
      dates: conference.organizations[0].conferenceDates.map((date) => {
        return {
          fromDate: date.fromDate,
          toDate: date.toDate,
          type: date.type,
          name: date.name,
          createdAt: date.createdAt,
          updatedAt: date.updatedAt,
        };
      })[0],
      link: conference.organizations[0].link,
      createdAt: conference.createdAt,
      updatedAt: conference.updatedAt,
      creatorId: conference.creatorId,
      accessType: conference.organizations[0].accessType,
      status: conference.status,
      adminId: conference.adminId ?? undefined,
    };
    return formated;
  }

  async getConferenceByCreatorId(creatorId: string): Promise<any[]> {
    const conferences = await this.txHost.tx.conferences.findMany({
      where: {
        creatorId: creatorId,
      },
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
            topics: {
              include: {
                inTopic: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            conferenceDates: true,
          },
        },
        ConferencePostRequests: true,
      },
    });

    if (!conferences) {
      return [];
    }
    const formatedConferences = await Promise.all(
      conferences.map((conference): Partial<any> => {
        return {
          id: conference.id,
          title: conference.title,
          acronym: conference.acronym,
          creatorId: conference.creatorId,
          adminId: conference.adminId ?? undefined,
          createdAt: conference.createdAt,
          updatedAt: conference.updatedAt,
          status: conference.status,
          ranks:
            conference.ranks?.length > 0
              ? conference.ranks.map((rank) => ({
                  year: rank.year,
                  rank: rank.byRank?.name,
                  source: rank.byRank?.belongsToSource?.name,
                  fieldOfResearch: rank.inFieldOfResearch?.name,
                }))
              : [],
          organizations:
            conference.organizations?.length > 0
              ? conference.organizations.map((org) => ({
                  id: org.id,
                  isAvailable: org.isAvailable,
                  createdAt: org.createdAt,
                  updatedAt: org.updatedAt,
                  conferenceId: org.conferenceId,
                  year: org.year,
                  accessType: org.accessType,
                  summary: org.summerize,
                  callForPaper: org.callForPaper,
                  link: org.link,
                  impLink: org.impLink,
                  cfpLink: org.cfpLink,
                  summerize: org.summerize,
                  publisher: org.publisher,
                  locations:
                    org.locations?.map((loc) => ({
                      address: loc.address ?? undefined,
                      cityStateProvince: loc.cityStateProvince ?? undefined,
                      country: loc.country ?? undefined,
                      continent: loc.continent ?? undefined,
                    })) || [],
                  topics: org.topics?.map((topic) => topic.inTopic?.name) || [],
                  conferenceDates:
                    org.conferenceDates?.map((date) => ({
                      fromDate: date.fromDate,
                      toDate: date.toDate,
                      type: date.type,
                      name: date.name,
                    })) || [],
                }))
              : [],
          feedbacks:
            conference.feedbacks?.map((feedback) => ({
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
            })) || [],
          followBy:
            conference.follows?.map((follow) => ({
              id: follow.id,
              userId: follow.userId,
              createdAt: follow.createdAt,
              updatedAt: follow.updatedAt,
              user: {
                avatar: follow.byUser.avatar,
                firstName: follow.byUser.firstName,
                lastName: follow.byUser.lastName,
              },
            })) || [],
          message:
            conference.ConferencePostRequests?.length > 0
              ? conference.ConferencePostRequests[0].message
              : '',
        };
      }),
    );
    return formatedConferences;
  }

  async getAddedBlacklistByConferenceId(
    conferenceId: string,
  ): Promise<ConferenceBlacklistByDTO[]> {
    const blacklists = await this.prismaService.conferenceBlacklists.findMany({
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

    const results = blacklists.map((blacklist): ConferenceBlacklistByDTO => {
      return {
        id: blacklist.id,
        userId: blacklist.userId,
        user: {
          avatar: blacklist.byUser.avatar,
          firstName: blacklist.byUser.firstName,
          lastName: blacklist.byUser.lastName,
        },
        createdAt: blacklist.createdAt,
        updatedAt: blacklist.updatedAt,
      };
    });

    return results;
  }

  async checkUpcomingEvents(
    daysThreshold: number = 30,
  ): Promise<ConferenceDTO[]> {
    const currentDate = new Date();
    const futureDate = new Date();
    futureDate.setDate(currentDate.getDate() + daysThreshold);

    const upcomingConferences = await this.prismaService.conferences.findMany({
      where: {
        organizations: {
          some: {
            conferenceDates: {
              some: {
                type: 'conferenceDates',
                fromDate: {
                  gte: currentDate,
                  lte: futureDate,
                },
              },
            },
          },
        },
      },
      include: {
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
      },
    });

    return upcomingConferences.map((conference) => {
      const hasRank = conference.ranks.length > 0;
      const organization = conference.organizations[0];

      return {
        id: conference.id,
        title: conference.title,
        acronym: conference.acronym,
        location: {
          address: organization?.locations[0]?.address ?? '',
          cityStateProvince:
            organization?.locations[0]?.cityStateProvince ?? '',
          country: organization?.locations[0]?.country ?? '',
          continent: organization?.locations[0]?.continent ?? '',
        },
        rank: hasRank ? conference.ranks[0].byRank.name : undefined,
        source: hasRank
          ? conference.ranks[0].byRank.belongsToSource.name
          : undefined,
        year: hasRank ? conference.ranks[0].year : undefined,
        researchFields: hasRank
          ? conference.ranks.map((rank) => rank.inFieldOfResearch.name)
          : undefined,
        topics: organization?.topics.map((topic) => topic.inTopic.name) ?? [],
        dates: organization?.conferenceDates.find(
          (date) => date.type === 'conferenceDates',
        ) ?? {
          fromDate: null,
          toDate: null,
          type: 'conferenceDates',
          name: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        link: organization?.link ?? '',
        createdAt: conference.createdAt,
        updatedAt: conference.updatedAt,
        creatorId: conference.creatorId,
        accessType: organization?.accessType ?? '',
        status: conference.status,
        adminId: conference.adminId ?? undefined,
      };
    });
  }

  async getTopicByName(topicName: string): Promise<Topics | undefined> {
    const topic = await this.prismaService.topics.findFirst({
      where: {
        name: topicName,
      },
    });
    if (!topic) {
      return undefined;
    }
    return topic;
  }

  async createConferencePostRequest(
    userId: string,
    data: { conferenceId: string; message: string },
  ) {
    return this.txHost.tx.conferencePostRequests.create({
      data: {
        userId,
        conferenceId: data.conferenceId,
        status: 'PENDING',
        message: data.message,
      },
      include: {
        belongsTo: true,
        byUser: true,
        byAdmin: true,
      },
    });
  }

  // Cache invalidation methods
  private async invalidateConferenceCache(
    conferenceId?: string,
  ): Promise<void> {
    try {
      // Invalidate all conference list caches
      await this.cacheService.delByPattern('conferences:conferences:*');

      // Invalidate specific conference cache if ID provided
      if (conferenceId) {
        await this.cacheService.delByPattern(
          `conferences:detail:${conferenceId}*`,
        );
      }

      // Invalidate related caches
      await this.cacheService.delByPattern('conferences:upcoming:*');
      await this.cacheService.delByPattern('conferences:search:*');
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Cached method for getting conference by ID
  async getConferenceByIdCached(id: string, force = false): Promise<any> {
    const cacheKey = `conferences:detail:${id}:${force}`;

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.getConferenceById(id, force),
      3600, // 1 hour cache
    );
  }

  // Cached method for upcoming conferences
  async checkUpcomingEventsCached(
    daysThreshold: number = 30,
  ): Promise<ConferenceDTO[]> {
    const cacheKey = `conferences:upcoming:${daysThreshold}`;

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.checkUpcomingEvents(daysThreshold),
      1800, // 30 minutes cache
    );
  }
}

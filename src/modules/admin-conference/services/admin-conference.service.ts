/* eslint-disable*/
import { HttpException, Injectable, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { paginator, PaginatorTypes } from '@nodeteam/nestjs-prisma-pagination';
import { Conferences, Prisma } from 'generated/prisma_client';
import { PrismaService } from 'src/modules/common';
import {
  AdminConferenceDTO,
  AdminConferenceParams,
} from '../models/admin-conference.dto';
import { Readable } from 'stream';
import * as papa from 'papaparse';
import {
  ConferenceEvaluationRow,
  ConferenceImportRow,
} from '../models/conference-import-row';
import { NativeConferenceService } from './native-conference.service';
import {
  FieldOfResearchService,
  RankService,
  SourceService,
} from 'src/modules/source-rank';
import { ConferenceOrganizationSerivce } from 'src/modules/conference-organization';
import { ConferenceService } from 'src/modules/conference/services/conference.service';
import {
  converStringToDate,
  convertObjectToDate,
} from 'src/modules/conference-job/utils/date-parse';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConferencePostRequestDTO, ConferencePostRequestStatus } from '../models/conference-request-post.dto';
import { ConferenceSaveDto } from '../models/conference-save.dto';
import { PrismaClient } from 'generated/prisma_client';
import { ConferenceHistoryDto } from '../models/admin-conference.dto';
import { ConferenceHistoryResponseDto } from '../models/conference-history-response.dto';
import { SourceDTO } from 'src/modules/source-rank/models/source.dto';
import { equal } from 'joi';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });
@Injectable()
export class AdminConferenceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly nativeConferenceService: NativeConferenceService,
    private readonly fieldOfResearchService: FieldOfResearchService,
    private readonly conferenceOrganizationService: ConferenceOrganizationSerivce,
    private readonly rankService: RankService,
    private readonly souceService: SourceService,
    private readonly conferenceService: ConferenceService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
  ) {}

  convertToPrismaWhereInput(
    params: AdminConferenceParams,
  ): Prisma.ConferencesWhereInput {
    return {
      OR: [
        {
          title: {
            contains: params.search,
            mode: 'insensitive',
          },
        },
        {
          acronym: {
            contains: params.search,
            mode: 'insensitive',
          },
        },
      ],
      AND: [
        {
          ...(params.status.length > 0
            ? {
                status: {
                  in: params.status,
                },
              }
            : {}),
        },
       {
          ...(params.source.length > 0 || params.ranks.length > 0 ? {ranks: {
            some: {
              byRank: {
                belongsToSource: {
                  ...(params.source.length > 0
                    ? {
                        name: {
                          in: params.source,
                        },
                      }
                    : {}),
                },
                ...(params.ranks.length > 0
                  ? {
                      name: {
                        in: params.ranks,
                      },
                    }
                  : {}),
              },
              inFieldOfResearch: {
                ...(params.researchFields.length > 0
                  ? {
                      name: {
                        in: params.researchFields,
                      },
                    }
                  : {}),
              },
            },
          },} : {})
        },
      ],
    };
  }

  async getConferenceInstances({
    where,
    orderBy,
    include,
    page,
    perPage,
  }: {
    where: Prisma.ConferencesWhereInput;
    orderBy: Prisma.ConferencesOrderByWithRelationInput;
    include: Prisma.ConferencesInclude;
    page: number;
    perPage: number;
  }): Promise<PaginatorTypes.PaginatedResult<AdminConferenceDTO>> {
    include = {
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
        orderBy: {
          updatedAt: 'desc'
        }
      },
    };

    const paginatedResult = await paginate(
      this.prismaService.conferences,
      {
        where,
        orderBy,
        include,
      },
      {
        page,
        perPage,
      },
    );

    const conferences: AdminConferenceDTO[] = paginatedResult.data.map(
      (item: any): AdminConferenceDTO => ({
        id: item.id,
        title: item.title,
        sources: Array.from(
          new Set(
            item.ranks.map(
              (rank: any) => rank.byRank.belongsToSource.name as string,
            ),
          ),
        ),
        acronym: item.acronym,
        ranks: Array.from(
          new Set(item.ranks.map((rank: any) => rank.byRank.name as string)),
        ),
        researchFields: Array.from(
          new Set(
            item.ranks.map(
              (rank: any) => rank.inFieldOfResearch.name as string,
            ),
          ),
        ),
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        organizationHistory: item.organizations.map((org: any) => ({
          id: org.id,
          year: org.year,
          accessType: org.accessType,
          isAvailable: org.isAvailable,
          publisher: org.publisher,
          summerize: org.summerize,
          callForPaper: org.callForPaper,
          link: org.link,
          cfpLink: org.cfpLink,
          impLink: org.impLink,
          locations: org.locations.map((loc: any) => ({
            address: loc.address,
            cityStateProvince: loc.cityStateProvince,
            country: loc.country,
            continent: loc.continent,
          })),
          topics: org.topics.map((topic) => topic.inTopic.name),
          dates: org.conferenceDates.map((date: any) => ({
            type: date.type,
            startDate: date.fromDate,
            endDate: date.toDate,
            name: date.name,
          })),
          updatedAt: org.updatedAt,
        })),
      }),
    );

    return {
      data: conferences,
      meta: paginatedResult.meta,
    };
  }

  async parseCSVFile(
    file: Express.Multer.File,
  ): Promise<ConferenceImportRow[] | null> {
    const streamFile = Readable.from(file.buffer);
    const csvData = await new Promise<any[]>((resolve, reject) => {
      papa.parse(streamFile, {
        delimiter: ',',
        header: false,
        complete: (result) => resolve(result.data),
        error: (error) => reject(error),
      });
    });

    const parseds = csvData.map((row): ConferenceImportRow => {
      return {
        title: row[1],
        acronym: row[2],
        source: row[3],
        rank: row[4],
        researchFieldCodes: row
          .slice(6)
          .map((code) => code.trim())
          .filter((code) => code !== ''),
      };
    });
    return parseds;
  }

  async parseCSVFileWithHeader(file: Express.Multer.File): Promise<ConferenceImportRow[]> {
      const streamFile = Readable.from(file.buffer);
      const csvData = await new Promise<any[]>((resolve, reject) => {
        papa.parse(streamFile, {
          delimiter: ',',
          header: true,
          complete: (result) => resolve(result.data),
          error: (error) => reject(error),
        });
      });
      return csvData.map((row): ConferenceImportRow => {
        return {
          title: row.title,
          acronym: row.acronym,
          source: row.source || 
            'Unknown', // Default to 'Unknown' if source is not provided
          rank: row.rank || 
            'Unranked', // Default to 'Unranked' if rank is not provided
          researchFieldCodes: [row["fieldOfResearch1"],
            row["fieldOfResearch2"],
            row["fieldOfResearch3"],
          ].filter(code => !!code)
          .map((code) => code.trim())
          .filter((code) => code !== ''),
        };
      });
    }

  async parsePartEvaluateCsv(
    file: Express.Multer.File,
  ): Promise<ConferenceEvaluationRow[]> {
    const streamFile = Readable.from(file.buffer);
    const csvData = await new Promise<any[]>((resolve, reject) => {
      papa.parse(streamFile, {
        delimiter: ',',
        header: true,
        complete: (result) => resolve(result.data),
        error: (error) => reject(error),
      });
    });
    return csvData.map((row): ConferenceEvaluationRow => {
      try {
      return {
        ...row,
        submissionDate: JSON.parse(row.submissionDate as unknown as string),
        notificationDate: JSON.parse(row.notificationDate as unknown as string),
        cameraReadyDate: JSON.parse(row.cameraReadyDate as unknown as string),
        registrationDate: JSON.parse(row.registrationDate as unknown as string),
        otherDate: JSON.parse(row.otherDate),
      };
      } catch (error) {
      console.error('Error parsing CSV row:', row, error);
      return {
        ...row,
        submissionDate: null,
        notificationDate: null,
        cameraReadyDate: null,
        registrationDate: null,
        otherDate: null,
      };
      }
    });
  }

  async importConference(
    conference: ConferenceImportRow | undefined,
    adminId: string,
  ) {
    if (!conference) {
      throw new Error('No data to import');
    }
    const cleanedAcronym = conference.acronym
      .replace(/\([^)]*\)/g, '') // Remove content inside parentheses
      .replace(/\s{2,}/g, ' ') // Replace double spaces with a single space
      .trim();
    const cleanedTitle = conference.title
      .replace(/\([^)]*\)/g, '') // Remove content inside parentheses
      .replace(/\s{2,}/g, ' ') // Replace double spaces with a single space
      .trim();
    let conferenceInDB =
      await this.nativeConferenceService.getConferenceByAcronym(
        cleanedAcronym,
        cleanedTitle,
      );
    if (!conferenceInDB) {
      conferenceInDB = await this.nativeConferenceService.createConference({
        title: cleanedTitle,
        acronym: cleanedAcronym,
        adminId: adminId,
        status: 'DRAFT',
      });
    }
    if (!(await this.souceService.isExistSourceName(conference.source))) {
      await this.souceService.createSource({
        name: conference.source,
        link: '',
      });
    }
    const sourceInDB = await this.souceService.findOrCreateSource({
      name: conference.source,
      link: '',
    });
    const rankInDB = await this.rankService.findOrCreateRank({
      name: conference.rank,
      source: sourceInDB,
      value: 0,
    });
    for (const researchFieldCode of conference.researchFieldCodes) {
      const researchFieldInDB =
        await this.fieldOfResearchService.getFieldOfResearchByCode(
          researchFieldCode,
        );
      if (!researchFieldInDB) {
        throw new Error(
          `Research field with code ${researchFieldCode} not found`,
        );
      }
      const t = await this.conferenceService.createOrFindRank(
        conferenceInDB?.id as string,
        rankInDB,
        researchFieldInDB?.id,
        new Date().getFullYear(),
      );
    }
    const conferenceOrg =
      await this.conferenceOrganizationService.getFirstOrganizationsByConferenceId(
        conferenceInDB?.id as string,
      );
    const status = conferenceOrg ? 'CRAWLED' : 'NOT CRAWLED';
    const lastTimeCrawl = conferenceOrg ? conferenceOrg.updatedAt : undefined;

    // Update conference status using transaction
    await this.txHost.tx.conferences.update({
      where: { id: conferenceInDB.id },
      data: { status: status }
    });

    const conferenceAfterUpdate = await this.txHost.tx.conferences.findUnique({ 
      where: { id: conferenceInDB.id },
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
      },
    });

    return {
      id: conferenceAfterUpdate?.id,
      title: conferenceAfterUpdate?.title,
      sources: Array.from(
        new Set(
          conferenceAfterUpdate?.ranks.map(
            (rank) => rank.byRank.belongsToSource.name as string,
          ),
        ),
      ),
      acronym: conferenceAfterUpdate?.acronym,
      ranks: Array.from(
        new Set(conferenceAfterUpdate?.ranks.map((rank) => rank.byRank.name as string)),
      ),
      researchFields: Array.from(
        new Set(
          conferenceAfterUpdate?.ranks.map(
            (rank) => rank.inFieldOfResearch.name as string,
          ),
        ),
      ),
      status: status,
      createdAt: conferenceAfterUpdate?.createdAt,
      updatedAt: lastTimeCrawl || conferenceAfterUpdate?.updatedAt,
      link: conferenceOrg?.link || '',
      impLink: conferenceOrg?.impLink || '',
      cfpLink: conferenceOrg?.cfpLink || '',
    };
  }

  async importEvaluateConference (
    conference: ConferenceEvaluationRow | undefined,
  ) {
    if (!conference) {
      throw new Error('No data to import');
    }
    console.log('Importing conference:', conference.title, conference.acronym);
    const conferenceInDB =
      await this.conferenceService.getConferenceByAcronymAndTitle(
        conference?.title,
        conference?.acronym,
      );

    if (!conferenceInDB) {
      console.log('No conference foudn', conference);
      return undefined;
    }
    console.log('Importing conference:', conference.title, conference.acronym);
    try {
      const conferenceOrganization =
        await this.conferenceOrganizationService.importOrganize({
          ...conference,
          link: conference.mainLink,
          conferenceId: conferenceInDB.id,
          isAvailable: true,
          summerize: conference.summary,
          callForPaper: conference.callForPapers,
          accessType: conference.type,
          year: parseInt(conference.year),
        });
      if (!conferenceOrganization) {
        throw new Error('Conference organization cannot not be created');
        return false;
      }
      const conferenceLocation =
        await this.conferenceOrganizationService.importPlace({
          organizeId: conferenceOrganization.id,
          address: conference.location,
          cityStateProvince: conference.cityStateProvince,
          country: conference.country,
          continent: conference.continent,
        });

      const topics = conference.topics.split(',').map(async (topic) => {
        topic = topic.trim();
        return await this.conferenceOrganizationService.importTopic({
          organized: conferenceOrganization.id,
          topic: topic,
        });
      });
      await Promise.all(topics);
      const conferenceDate = converStringToDate(
        conference.conferenceDates,
        'conferenceDates',
        conferenceOrganization.id,
      );
      const submissionDate = convertObjectToDate(
        conference.submissionDate,
        'submissionDate',
        conferenceOrganization.id,
      );
      const notificationDate = convertObjectToDate(
        conference.notificationDate,
        'notificationDate',
        conferenceOrganization.id,
      );
      const cameraReadyDate = convertObjectToDate(
        conference.cameraReadyDate,
        'cameraReadyDate',
        conferenceOrganization.id,
      );
      const registrationDate = convertObjectToDate(
        conference.registrationDate,
        'registrationDate',
        conferenceOrganization.id,
      );
      const otherDate = convertObjectToDate(
        conference.otherDate,
        'otherDate',
        conferenceOrganization.id,
      );

      const allDates = [
        conferenceDate,
        ...submissionDate,
        ...notificationDate,
        ...cameraReadyDate,
        ...registrationDate,
        ...otherDate,
      ];

      for (const date of allDates) {
        await this.conferenceOrganizationService.importDate(date);
      }
      return true;
    } catch (error) {
      this.txHost.tx.errorConferenceLogger.create({
        data: {
          conferenceId: conferenceInDB.id,
          message: error.message,
          stack: error.stack,
        },
      });
      console.log('Error importing conference:', conference.title, conference.acronym);
      return false;
    }
  }

  async getConferenceRequest(params?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    const requests = await this.prismaService.conferencePostRequests.findMany({
      where: {
        ...(params?.status ? { status: {
          equals: params.status,
          mode : 'insensitive'
        } } : {}),
        ...(params?.startDate || params?.endDate
          ? {
              createdAt: {
                ...(params?.startDate ? { gte: params.startDate } : {}),
                ...(params?.endDate ? { lte: params.endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        belongsTo: true,
        byUser: true,
        byAdmin: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      },
      orderBy: {
        [params?.sortBy || 'createdAt']: params?.sortOrder || 'desc',
      },
    });

    return requests.map((request) => ({
      id: request.id,
      conferenceId: request.conferenceId,
      userId: request.userId,
      adminId: request.adminId,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      conference: {
        id: request.belongsTo.id,
        title: request.belongsTo.title,
        acronym: request.belongsTo.acronym,
      },
      user: {
        id: request.byUser.id,
        email: request.byUser.email,
        firstName: request.byUser.firstName,
        lastName: request.byUser.lastName,
      },
      admin: request.byAdmin ? {
        id: request.byAdmin.id,
        email: request.byAdmin.email,
        fullName: request.byAdmin.fullName,
      } : null,
    }));
  }

  async createConferenceRequest(
    userId: string,
    adminId: string | null,
    data: { conferenceId: string; message: string },
  ) : Promise<ConferencePostRequestDTO> {
    const request = await this.prismaService.conferencePostRequests.create({
      data: {
        userId,
        adminId,
        conferenceId: data.conferenceId,
        status: ConferencePostRequestStatus.PENDING,
        message: data.message,
      },
      include: {
        belongsTo: true,
        byUser: true,
        byAdmin: true,
      },
    });

    return {
      id: request.id,
      conferenceId: request.conferenceId,
      userId: request.userId,
      adminId: request.adminId,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      conference: {
        id: request.belongsTo.id,
        title: request.belongsTo.title,
        acronym: request.belongsTo.acronym,
      },
      user: {
        id: request.byUser.id,
        email: request.byUser.email,
        firstName: request.byUser.firstName,
        lastName: request.byUser.lastName,
      },
      admin: request.byAdmin ? {
        id: request.byAdmin.id,
        email: request.byAdmin.email,
        fullName: request.byAdmin.fullName,
      } : null,
    };
  }

  async removeConference(conferenceId: string) {
    // Delete all related records first
    await this.prismaService.$transaction(async (tx) => {
      // First get all organization IDs for this conference
      const organizations = await tx.conferenceOrganizations.findMany({
        where: { conferenceId },
        select: { id: true }
      });
      
      const organizationIds = organizations.map(org => org.id);

      // Delete locations for all organizations
      await tx.locations.deleteMany({
        where: { organizeId: { in: organizationIds } }
      });

      // Delete conference topics for all organizations
      await tx.conferenceTopics.deleteMany({
        where: { organizeId: { in: organizationIds } }
      });

      // Delete conference dates for all organizations
      await tx.conferenceDates.deleteMany({
        where: { organizedId: { in: organizationIds } }
      });

      // Delete conference organizations
      await tx.conferenceOrganizations.deleteMany({
        where: { conferenceId }
      });

      // Delete conference blacklists
      await tx.conferenceBlacklists.deleteMany({
        where: { conferenceId }
      });

      // Delete conference calendars
      await tx.conferenceCalendars.deleteMany({
        where: { conferenceId }
      });

      // Delete conference crawl jobs
      await tx.conferenceCrawlJobs.deleteMany({
        where: { conferenceId }
      });

      // Delete conference feedbacks
      await tx.conferenceFeedbacks.deleteMany({
        where: { conferenceId }
      });

      // Delete conference follows
      await tx.conferenceFollows.deleteMany({
        where: { conferenceId }
      });

      // Delete conference likes
      await tx.conferenceLikes.deleteMany({
        where: { conferenceId }
      });

      // Delete conference notifications
      await tx.notifications.deleteMany({
        where: { conferenceId }
      });

      // Delete conference post requests
      await tx.conferencePostRequests.deleteMany({
        where: { conferenceId }
      });

      // Delete conference ranks
      await tx.conferenceRanks.deleteMany({
        where: { conferenceId }
      });

      // Finally delete the conference
      await tx.conferences.delete({
        where: { id: conferenceId }
      });
    });
  }

  async updateConferenceRequestStatus(
    requestId: string,
    adminId: string,
    data: { status: ConferencePostRequestStatus; message: string },
  ) {
    const request = await this.prismaService.conferencePostRequests.update({
      where: { id: requestId },
      data: {
        adminId,
        status: data.status,
        message: data.message,
      },
      include: {
        belongsTo: true,
        byUser: true,
        byAdmin: true,
      },
    });
      // Otherwise update conference status
      await this.prismaService.conferences.update({
        where: { id: request.conferenceId },
        data: { status: data.status },
      });
    return {
      id: request.id,
      conferenceId: request.conferenceId,
      userId: request.userId,
      adminId: request.adminId,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      conference: {
        id: request.belongsTo.id,
        title: request.belongsTo.title,
        acronym: request.belongsTo.acronym,
      },
      user: {
        id: request.byUser.id,
        email: request.byUser.email,
        firstName: request.byUser.firstName,
        lastName: request.byUser.lastName,
      },
      admin: request.byAdmin ? {
        id: request.byAdmin.id,
        email: request.byAdmin.email,
        fullName: request.byAdmin.fullName,
      } : null,
    };
  }

  async getConferenceRequestById(requestId: string) {
    const request = await this.prismaService.conferencePostRequests.findUnique({
      where: { id: requestId },
      include: {
        belongsTo: true,
        byUser: true,
        byAdmin: true,
      },
    });

    if (!request) {
      throw new HttpException('Conference request not found', 404);
    }

    return {
      id: request.id,
      conferenceId: request.conferenceId,
      userId: request.userId,
      adminId: request.adminId,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      conference: {
        id: request.belongsTo.id,
        title: request.belongsTo.title,
        acronym: request.belongsTo.acronym,
      },
      user: {
        id: request.byUser.id,
        email: request.byUser.email,
        firstName: request.byUser.firstName,
        lastName: request.byUser.lastName,
      },
      admin: request.byAdmin ? {
        id: request.byAdmin.id,
        email: request.byAdmin.email,
        fullName: request.byAdmin.fullName,
      } : null,
    };
  }

  async saveConference(conferenceData: ConferenceSaveDto): Promise<any> {
    console.log('Saving conference:', conferenceData);
    try {
      // Create or update conference
      const conference = await this.txHost.tx.conferences.upsert({
        where: {
          title_acronym: {
            title: conferenceData.title,
            acronym: conferenceData.acronym || '',
          },
        },
        create: {
          title: conferenceData.title,
          acronym: conferenceData.acronym || '',
          status: 'SAVED',
        },
        update: {
          acronym: conferenceData.acronym || '',
          status: 'SAVED',
        },
      });

      // Create or update organization
      const organization = await this.txHost.tx.conferenceOrganizations.create({
        data: {
          conferenceId: conference.id,
          year: conferenceData.year ? parseInt(conferenceData.year) : null,
          accessType: conferenceData.type || 'Offline',
          isAvailable: true,
          publisher: conferenceData.publisher || '',
          summerize: conferenceData.summary || '',
          callForPaper: conferenceData.callForPapers || '',
          link: conferenceData.mainLink || '',
          cfpLink: conferenceData.cfpLink || '',
          impLink: conferenceData.impLink || '',
        },
      });

      // Create location
      if (conferenceData.location || conferenceData.cityStateProvince || conferenceData.country || conferenceData.continent) {
        await this.txHost.tx.locations.create({
          data: {
            organizeId: organization.id,
            address: conferenceData.location || '',
            cityStateProvince: conferenceData.cityStateProvince || '',
            country: conferenceData.country || '',
            continent: conferenceData.continent || '',
            isAvailable: true,
          },
        });
      }

      // Create topics
      if (conferenceData.topics) {
        const topics = conferenceData.topics.split(',').map(topic => topic.trim());
        for (const topic of topics) {
          let topicInDB = await this.txHost.tx.topics.findFirst({
            where: { name: topic },
          });
          if (!topicInDB) {
            topicInDB = await this.txHost.tx.topics.create({
              data: { name: topic },
            });
          }
          await this.txHost.tx.conferenceTopics.create({
            data: {
              organizeId: organization.id,
              topicId: topicInDB.id,
            },
          });
        }
      }            
      const {
            submissionDate,
            cameraReadyDate,
            conferenceDates,
            registrationDate,
            notificationDate,
            otherDate,
        } = conferenceData;
      
      // Create dates
      const conferenceDateInput = converStringToDate(
                conferenceDates,
                "conferenceDates",
                organization.id
            );

            const submissionDateInput = convertObjectToDate(
                submissionDate,
                "submissionDate",
                organization.id
            );
            const cameraReadyDateInput = convertObjectToDate(
                cameraReadyDate,
                "cameraReadyDate",
                organization.id
            );
            const registrationDateInput = convertObjectToDate(
                registrationDate,
                "registrationDate",
                organization.id
            );
            const notificationDateInput = convertObjectToDate(
                notificationDate,
                "notificationDate",
                organization.id
            );
            const otherDateInput = convertObjectToDate(
                otherDate,
                "otherDate",
                organization.id
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
      await this.updateLastestOrganizationById(
        organization.conferenceId,
      );

      return conference;
    } catch (error) {
      console.error('Error saving conference:', error);
      throw new HttpException(
        'Failed to save conference',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async importConferences(
    conferencesData: ConferenceSaveDto[],
  ): Promise<any[]> {
    try {
      const savedConferences = <any>[];

      for (const conferenceData of conferencesData) {
        const savedConference = await this.saveConference(conferenceData);
        savedConferences.push(savedConference as any);
      }
      
      return savedConferences;
    } catch (error) {
      throw new BadRequestException(
        `Failed to import conferences: ${error.message}`,
      );
    }
  }

  async updateConferenceHistory(updateHistoryDto: ConferenceHistoryDto) {
    try {
      // Find the conference history by ID
      const existingHistory = await this.txHost.tx.conferenceOrganizations.findUnique({
        where: { id: updateHistoryDto.id },
        include: {
          locations: true,
          topics: {
            include: {
              inTopic: true
            }
          },
          conferenceDates: true,
        },
      });

      if (!existingHistory) {
        throw new HttpException('Conference history not found', HttpStatus.NOT_FOUND);
      }

      // Create update data object with only the fields that are provided
      const updateData: any = {};

      // Only update basic info if provided
      if (updateHistoryDto.year !== undefined) updateData.year = updateHistoryDto.year;
      if (updateHistoryDto.accessType !== undefined) updateData.accessType = updateHistoryDto.accessType;
      if (updateHistoryDto.isAvailable !== undefined) updateData.isAvailable = updateHistoryDto.isAvailable;
      if (updateHistoryDto.publisher !== undefined) updateData.publisher = updateHistoryDto.publisher;
      if (updateHistoryDto.summerize !== undefined) updateData.summerize = updateHistoryDto.summerize;
      if (updateHistoryDto.callForPaper !== undefined) updateData.callForPaper = updateHistoryDto.callForPaper;

      // Only update links if provided
      if (updateHistoryDto.link !== undefined) updateData.link = updateHistoryDto.link;
      if (updateHistoryDto.cfpLink !== undefined) updateData.cfpLink = updateHistoryDto.cfpLink;
      if (updateHistoryDto.impLink !== undefined) updateData.impLink = updateHistoryDto.impLink;
      updateHistoryDto.isLastest = true;

      // Update the conference organization with only the provided fields
      const updatedHistory = await this.txHost.tx.conferenceOrganizations.update({
        where: { id: updateHistoryDto.id },
        data: updateData,
      });

      // Only update locations if provided
      if (updateHistoryDto.locations && updateHistoryDto.locations.length > 0) {
        // Delete existing locations
        await this.txHost.tx.locations.deleteMany({
          where: { organizeId: updateHistoryDto.id },
        });

        // Create new locations
        await Promise.all(
          updateHistoryDto.locations.map((location) =>
            this.txHost.tx.locations.create({
              data: {
                organizeId: updateHistoryDto.id,
                address: location.address || '',
                cityStateProvince: location.cityStateProvince || '',
                country: location.country || '',
                continent: location.continent || '',
                isAvailable: true,
              },
            }),
          ))
      }

      // Only update topics if provided
      if (updateHistoryDto.topics && updateHistoryDto.topics.length > 0) {
        // Delete existing topics
        await this.txHost.tx.conferenceTopics.deleteMany({
          where: { organizeId: updateHistoryDto.id },
        });

        // Create new topics
        await Promise.all(
          updateHistoryDto.topics.map(async (topic) => {
            let topicInDB = await this.txHost.tx.topics.findFirst({
              where: { name: topic },
            });
            if (!topicInDB) {
              topicInDB = await this.txHost.tx.topics.create({
                data: {
                  name: topic,
                },
              });
            }
            return this.txHost.tx.conferenceTopics.create({
              data: {
                organizeId: updateHistoryDto.id,
                topicId: topicInDB.id,
              },
            });
          }),
        );
      }

      // Only update dates if provided
      if (updateHistoryDto.dates && updateHistoryDto.dates.length > 0) {
        // Delete existing dates
        await this.txHost.tx.conferenceDates.deleteMany({
          where: { organizedId: updateHistoryDto.id },
        });

        // Create new dates
        await Promise.all(
          updateHistoryDto.dates.map((date) =>
            this.txHost.tx.conferenceDates.create({
              data: {
                organizedId: updateHistoryDto.id,
                type: date.type || '',
                fromDate: date.startDate || new Date(),
                toDate: date.endDate || new Date(),
                name: date.name || '',
                isAvailable: true,
              },
            }),
          ));
      }

      // Get the updated conference with all relations
      const updatedConference = await this.txHost.tx.conferences.findUnique({
        where: { id: existingHistory.conferenceId },
        include: {
          organizations: {
            include: {
              locations: true,
              topics: {
                include: {
                  inTopic: true
                }
              },
              conferenceDates: true,
            },
            orderBy: {
              updatedAt: 'desc',
            },
          },
        },
      });

      if (!updatedConference) {
        throw new HttpException('Conference not found after update', HttpStatus.NOT_FOUND);
      }
      await this.updateLastestOrganizationById(
        updatedConference.id,
      );

      return updatedConference;
    } catch (error) {
      console.log(error)
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update conference history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOrganizationHistoryById(id: string): Promise<ConferenceHistoryResponseDto> {
    try {
      const organization = await this.txHost.tx.conferenceOrganizations.findUnique({
        where: { id },
        include: {
          locations: true,
          topics: {
            include: {
              inTopic: true
            }
          },
          conferenceDates: true,
        },
      });

      if (!organization) {
        throw new HttpException('Organization history not found', HttpStatus.NOT_FOUND);
      }

      return {
        id: organization.id,
        year: organization.year || new Date().getFullYear(),
        accessType: organization.accessType,
        isAvailable: organization.isAvailable,
        publisher: organization.publisher || '',
        summerize: organization.summerize || '',
        callForPaper: organization.callForPaper || '',
        link: organization.link || '',
        cfpLink: organization.cfpLink || '',
        impLink: organization.impLink || '',
        locations: organization.locations.map(loc => ({
          address: loc.address || '',
          cityStateProvince: loc.cityStateProvince || '',
          country: loc.country || '',
          continent: loc.continent || '',
        })),
        topics: organization.topics.map(topic => topic.inTopic.name),
        dates: organization.conferenceDates.map(date => ({
          type: date.type,
          startDate: date.fromDate || new Date(),
          endDate: date.toDate || new Date(),
          name: date.name || '',
        })),
        updatedAt: organization.updatedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get organization history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      console.log(error)
    }
  }

  async deleteConferenceHistory(id: string) {
    try {
      // First check if the organization exists
      const organization = await this.txHost.tx.conferenceOrganizations.findUnique({
        where: { id },
      });

      if (!organization) {
        throw new HttpException('Organization history not found', HttpStatus.NOT_FOUND);
      }

        await this.txHost.tx.locations.deleteMany({
          where: { organizeId: id },
        });
        await  this.txHost.tx.conferenceTopics.deleteMany({
          where: { organizeId: id },
        });
        await  this.txHost.tx.conferenceDates.deleteMany({
          where: { organizedId: id },
        });
      await this.txHost.tx.conferenceOrganizations.delete({
        where: { id },
      });

      return {
        message: 'Conference organization history deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete conference organization history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getConferenceHistoryByConferenceId(conferenceId: string): Promise<ConferenceHistoryResponseDto[]> {
    const organizations = await this.prismaService.conferenceOrganizations.findMany({
      where: {
        conferenceId: conferenceId
      },
      include: {
        locations: true,
        topics: {
          include: {
            inTopic: true
          }
        },
        conferenceDates: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return organizations.map(org => ({
      id: org.id,
      year: org.year || 0,
      accessType: org.accessType,
      isAvailable: org.isAvailable,
      publisher: org.publisher,
      summerize: org.summerize,
      callForPaper: org.callForPaper,
      link: org.link,
      cfpLink: org.cfpLink,
      impLink: org.impLink,
      locations: org.locations.map(loc => ({
        address: loc.address || '',
        cityStateProvince: loc.cityStateProvince || '',
        country: loc.country || '',
        continent: loc.continent || ''
      })),
      topics: org.topics.map(topic => topic.inTopic.name),
      dates: org.conferenceDates
        .filter(date => date.fromDate && date.toDate)
        .map(date => ({
          type: date.type,
          startDate: date.fromDate!,
          endDate: date.toDate!,
          name: date.name
        })),
      updatedAt: org.updatedAt
    }));
  }

  async removeConferenceWithNoDate(){
    const conferences = await this.prismaService.conferenceOrganizations.findMany({
      where: {
        conferenceDates: {
          none: {}
        }
      },
      include: {
        belongsTo : true
      }
    });

    if (conferences.length === 0) {
      throw new HttpException('No conferences found with no dates', HttpStatus.NOT_FOUND);
    }
    const remove = await Promise.all(
      conferences.map(async (conference) => {
        return this.deleteConferenceHistory(conference.id);
      }))
    return remove;
  }

  /**
   * Remove all topics whose name does not contain any alphanumeric character (number or letter).
   * Also removes related ConferenceTopics and JournalTopics.
   */
  async removeTrashTopics() {
    // Find all topics with names that do NOT contain any alphanumeric character
    const allTopics = await this.prismaService.topics.findMany();
    const trashTopics = allTopics.filter(t => !/[a-zA-Z0-9]/.test(t.name));

    if (!trashTopics.length) {
      return { message: 'No trash topics found.' };
    }

    const trashTopicIds = trashTopics.map(t => t.id);

    // Remove related ConferenceTopics and JournalTopics
    await this.prismaService.conferenceTopics.deleteMany({
      where: { topicId: { in: trashTopicIds } },
    });
    await this.prismaService.journalTopics.deleteMany({
      where: { topicId: { in: trashTopicIds } },
    });

    // Remove the topics themselves
    const deleted = await this.prismaService.topics.deleteMany({
      where: { id: { in: trashTopicIds } },
    });

    return { message: `Removed ${deleted.count} trash topics.` };
  }

  async updateConferenceStatus(){
    const conferences = await this.prismaService.conferences.findMany({});
    Promise.all(conferences.map(async (conference) => {
      const organization = await this.prismaService.conferenceOrganizations.findFirst({
        where: { conferenceId: conference.id },
      });
      if (!organization) {
        return await this.prismaService.conferences.update({
          where: { id: conference.id },
          data: { status: 'NOT CRAWLED' },
        });
      }else if (organization) {
        return await this.prismaService.conferences.update({
          where: { id: conference.id },
          data: { status: 'CRAWLED' },
        });
      }
    }))
    return { message: 'Conference statuses updated successfully' };
  }
   public async removeSource(name: string | undefined): Promise<SourceDTO> {
      // First, get the source to return it after deletion
      const sourceToDelete = await this.txHost.tx.sources.findFirst({
        where: { 
          ...(name ? { name: {
            equals: name || '',
          }} : {name : {equals : ''}} )
        },
      });

      const id = sourceToDelete?.id;
  
      if (!sourceToDelete) {
        throw new NotFoundException(`Source with id ${id} not found`);;
      }
  
      // Get all ranks associated with this source
       
      const ranksToDelete = await this.txHost.tx.ranks.findMany({
        where: {
          sourceId: id,
        },
        select: {
          id: true,
        },
      });
  
      // Delete all conference ranks that reference the ranks from this source
       
      if (ranksToDelete.length > 0) {
         
        await this.txHost.tx.conferenceRanks.deleteMany({
          where: {
            rankId: {
               
              in: ranksToDelete.map((rank: any) => rank.id),
            },
          },
        });
      }
  
      // Delete all related ranks (due to foreign key constraint)
       
      await this.txHost.tx.ranks.deleteMany({
        where: {
          sourceId: id,
        },
      });
  
      // Finally delete the source
       
      await this.txHost.tx.sources.delete({
        where: { id },
      });
      

       
      return sourceToDelete;
    }

    async updateLastestOrganization(){
      const conferences = await this.prismaService.conferences.findMany({});
      for(const conference of conferences) {
        const organizations = await this.prismaService.conferenceOrganizations.findMany({
          where: { conferenceId: conference.id },
          orderBy: { updatedAt: 'desc' },
        });
        if (organizations.length > 0) {
                    await this.prismaService.conferenceOrganizations.updateMany({
            where: { id: { not: organizations[0].id }, conferenceId: conference.id },
            data: { isLastest: false },
          });
          await this.prismaService.conferenceOrganizations.update({
            where: { id: organizations[0].id },
            data: { isLastest: true, updatedAt: organizations[0].updatedAt },
          });

        }
      }
      return { message: 'Latest organizations updated successfully' };
    }

  async updateLastestOrganizationById(conferenceId: string) {
  const organizations = await this.prismaService.conferenceOrganizations.findMany({
    where: { conferenceId },
    orderBy: { updatedAt: 'desc' },
  });
  if (organizations.length > 0) {
    await this.prismaService.conferenceOrganizations.updateMany({
      where: { id: { not: organizations[0].id }, conferenceId },
      data: { isLastest: false },
    });
    await this.prismaService.conferenceOrganizations.update({
      where: { id: organizations[0].id },
      data: { isLastest: true, updatedAt: organizations[0].updatedAt },
    });

  }
}

  async updateLastestOrgByConference(confId : string) {
    const organizations = await this.prismaService.conferenceOrganizations.findMany({
      where: { conferenceId: confId },
      orderBy: { updatedAt: 'desc' },
    });
    if (organizations.length > 0) {
      await this.prismaService.conferenceOrganizations.updateMany({
        where: { id: { not: organizations[0].id }, conferenceId: confId },
        data: { isLastest: false },
      });
      await this.prismaService.conferenceOrganizations.update({
        where: { id: organizations[0].id },
        data: { isLastest: true, updatedAt: organizations[0].updatedAt },
      });

    }
    return { message: 'Latest organization updated successfully' };
  }
}

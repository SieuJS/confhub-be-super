/* eslint-disable*/
import { HttpException, Injectable, BadRequestException } from '@nestjs/common';
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
import { ConferencePostRequestStatus } from '../models/conference-request-post.dto';
import { ConferenceSaveDto } from '../models/conference-save.dto';
import { PrismaClient } from '@prisma/client';

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
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
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
          ranks: {
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
          },
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
          year: 'desc'
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
          })),
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
      const t = {
        ...row,
        submissionDate: JSON.parse(row.submissionDate as unknown as string),
        notificationDate: JSON.parse(row.notificationDate as unknown as string),
        cameraReadyDate: JSON.parse(row.cameraReadyDate as unknown as string),
        registrationDate: JSON.parse(row.registrationDate as unknown as string),
        otherDate: JSON.parse(row.otherDate),
      };
      return t;
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
    return {
      id: conferenceInDB?.id,
      title: conferenceInDB.title,
      sources: Array.from(
        new Set(
          conferenceInDB.ranks.map(
            (rank) => rank.byRank.belongsToSource.name as string,
          ),
        ),
      ),
      acronym: conferenceInDB.acronym,
      ranks: Array.from(
        new Set(conferenceInDB.ranks.map((rank) => rank.byRank.name as string)),
      ),
      researchFields: Array.from(
        new Set(
          conferenceInDB.ranks.map(
            (rank) => rank.inFieldOfResearch.name as string,
          ),
        ),
      ),
      status: status,
      createdAt: conferenceInDB.createdAt,
      updatedAt: lastTimeCrawl || conferenceInDB.updatedAt,
      link: conferenceOrg?.link || '',
      impLink: conferenceOrg?.impLink || '',
      cfpLink: conferenceOrg?.cfpLink || '',
    };
  }

  async importEvaluateConference(
    conference: ConferenceEvaluationRow | undefined,
  ) {
    if (!conference) {
      throw new Error('No data to import');
    }
    const conferenceInDB =
      await this.conferenceService.getConferenceByAcronymAndTitle(
        conference?.title,
        conference?.acronym,
      );

    if (!conferenceInDB) {
      console.log('No conference foudn', conference);
      return undefined;
    }
    try {
      const conferenceOrganization =
        await this.conferenceOrganizationService.importOrganize({
          ...conference,
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
      console.log('error', error);
      // throw new HttpException({
      //   message: 'error when importing conference',
      //   error: error,
      // }, 400);
      this.txHost.tx.errorConferenceLogger.create({
        data: {
          conferenceId: conferenceInDB.id,
          message: error.message,
          stack: error.stack,
        },
      });
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
  ) {
    const request = await this.prismaService.conferencePostRequests.create({
      data: {
        userId,
        adminId,
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

    // If approved, update conference status
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
    try {
      // Check if conference with same acronym already exists
      let conference;
      
      if (conferenceData.acronym) {
        conference = await this.prismaService.conferences.findFirst({
          where: { acronym: conferenceData.acronym }
        });
      }

      // Create base conference data object
      const conferenceDataToSave = {
        title: conferenceData.title?.title || '',
        acronym: conferenceData.acronym || conferenceData.title?.acronym || '',
        status: 'PUBLISHED', // Or set appropriate default status
      };

      // Create or update the conference
      let savedConference;
      if (!conference) {
        // Create new conference
        savedConference = await this.prismaService.conferences.create({
          data: conferenceDataToSave
        });
      } else {
        // Update existing conference
        savedConference = await this.prismaService.conferences.update({
          where: { id: conference.id },
          data: conferenceDataToSave
        });
      }

      // Create a conference organization
      const year = conferenceData.year ? parseInt(conferenceData.year) : new Date().getFullYear();
      
      // Create the conference organization
      const organizeData = await this.conferenceOrganizationService.importOrganize({
        conferenceId: savedConference.id,
        year: year,
        accessType: conferenceData.type || 'Offline',
        isAvailable: true,
        publisher: conferenceData.publisher || '',
        summerize: conferenceData.summary || '',
        callForPaper: conferenceData.callForPapers || '',
        link: conferenceData.title?.link || '',
        cfpLink: conferenceData.title?.cfpLink || '',
        impLink: conferenceData.title?.impLink || '',
      });

      if (!organizeData) {
        throw new Error('Failed to create conference organization data');
      }

      // Create location if available
      if (conferenceData.location || conferenceData.cityStateProvince || conferenceData.country || conferenceData.continent) {
        await this.conferenceOrganizationService.importPlace({
          organizeId: organizeData.id,
          address: conferenceData.location || '',
          cityStateProvince: conferenceData.cityStateProvince || '',
          country: conferenceData.country || '',
          continent: conferenceData.continent || '',
        });
      }

      // Process dates
      const conferenceDateInput = converStringToDate(
        conferenceData.conferenceDates || '',
        'conferenceDates',
        organizeData.id
      );
      
      const submissionDateInput = convertObjectToDate(
        conferenceData.submissionDate || [],
        'submissionDate',
        organizeData.id
      );
      
      const cameraReadyDateInput = convertObjectToDate(
        conferenceData.cameraReadyDate || [],
        'cameraReadyDate',
        organizeData.id
      );
      
      const registrationDateInput = convertObjectToDate(
        conferenceData.registrationDate || [],
        'registrationDate',
        organizeData.id
      );
      
      const notificationDateInput = convertObjectToDate(
        conferenceData.notificationDate || [],
        'notificationDate',
        organizeData.id
      );
      
      const otherDateInput = convertObjectToDate(
        conferenceData.otherDate || [],
        'otherDate',
        organizeData.id
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

      // Create topics if available
      if (conferenceData.topics) {
        const topicPromises = conferenceData.topics.split(',').map((topic) => {
          return this.conferenceOrganizationService.importTopic({
            organized: organizeData.id,
            topic: topic.trim(),
          });
        });

        await Promise.all(topicPromises);
      }

      // Return the complete conference data
      return {
        ...savedConference,
        organization: organizeData,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to save conference: ${error.message}`,
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
}

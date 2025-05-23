/* eslint-disable*/
import { HttpException, Injectable, BadRequestException, HttpStatus } from '@nestjs/common';
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
import { PrismaClient } from 'generated/prisma_client';
import { ConferenceHistoryDto } from '../models/admin-conference.dto';
import { ConferenceHistoryResponseDto } from '../models/conference-history-response.dto';

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

    // Update conference status using transaction
    await this.txHost.tx.conferences.update({
      where: { id: conferenceInDB.id },
      data: { status: status }
    });

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
      // Validate required fields
      if (!conferenceData.title) {
        throw new BadRequestException('Conference title is required');
      }

      // Check if conference with same acronym already exists
      let conference;
      const acronym = conferenceData.acronym;
      
      if (acronym) {
        conference = await this.txHost.tx.conferences.findFirst({
          where: { 
            OR: [
              { acronym: acronym },
              { title: conferenceData.title }
            ]
          }
        });
      }

      // Create base conference data object
      const conferenceDataToSave = {
        status: 'SAVED',
      };

      // Create or update the conference

      const savedConference = await this.txHost.tx.conferences.update({
        where: { id: conference.id },
        data: conferenceDataToSave
      });

      // Create a conference organization
      const year = conferenceData.year ? parseInt(conferenceData.year) : new Date().getFullYear();
      
      // Extract links from determineLinks if available
      const determineLinks = conferenceData.determineLinks || {};
      const link = determineLinks['Official Website'] || '';
      const cfpLink = determineLinks['Call for papers link'] || '';
      const impLink = determineLinks['Important dates link'] || '';

      // Create the conference organization with all available data
      const organizeData = await this.conferenceOrganizationService.importOrganize({
        conferenceId: savedConference.id,
        year: year,
        accessType: conferenceData.type || 'Offline',
        isAvailable: true,
        publisher: conferenceData.publisher || '',
        summerize: conferenceData.summary || '',
        callForPaper: conferenceData.callForPapers || '',
        link: link,
        cfpLink: cfpLink,
        impLink: impLink,
      });

      if (!organizeData) {
        throw new Error('Failed to create conference organization data');
      }

      // Create location if any location data is provided
      if (conferenceData.location || conferenceData.cityStateProvince || conferenceData.country || conferenceData.continent) {
        await this.conferenceOrganizationService.importPlace({
          organizeId: organizeData.id,
          address: conferenceData.location || '',
          cityStateProvince: conferenceData.cityStateProvince || '',
          country: conferenceData.country || '',
          continent: conferenceData.continent || '',
        });
      }

      // Process all dates
      const allDates: any[] = [];

      // Process conference dates
      if (conferenceData.conferenceDates) {
        const conferenceDateInput = converStringToDate(
          conferenceData.conferenceDates,
          'conferenceDates',
          organizeData.id
        );
        if (conferenceDateInput) {
          allDates.push(conferenceDateInput);
        }
      }

      // Process submission dates
      if (conferenceData.submissionDate?.length) {
        const submissionDateInput = convertObjectToDate(
          conferenceData.submissionDate,
          'submissionDate',
          organizeData.id
        );
        allDates.push(...submissionDateInput);
      }

      // Process camera ready dates
      if (conferenceData.cameraReadyDate?.length) {
        const cameraReadyDateInput = convertObjectToDate(
          conferenceData.cameraReadyDate,
          'cameraReadyDate',
          organizeData.id
        );
        allDates.push(...cameraReadyDateInput);
      }

      // Process registration dates
      if (conferenceData.registrationDate?.length) {
        const registrationDateInput = convertObjectToDate(
          conferenceData.registrationDate,
          'registrationDate',
          organizeData.id
        );
        allDates.push(...registrationDateInput);
      }

      // Process notification dates
      if (conferenceData.notificationDate?.length) {
        const notificationDateInput = convertObjectToDate(
          conferenceData.notificationDate,
          'notificationDate',
          organizeData.id
        );
        allDates.push(...notificationDateInput);
      }

      // Process other dates
      if (conferenceData.otherDate?.length) {
        const otherDateInput = convertObjectToDate(
          conferenceData.otherDate,
          'otherDate',
          organizeData.id
        );
        allDates.push(...otherDateInput);
      }

      // Save all dates
      for (const date of allDates) {
        if (date) {
          await this.conferenceOrganizationService.importDate(date);
        }
      }

      // Process topics if available
      if (conferenceData.topics) {
        const topics = conferenceData.topics.split(',').map(topic => topic.trim()).filter(Boolean);
        if (topics.length > 0) {
          const topicPromises = topics.map(topic => 
            this.conferenceOrganizationService.importTopic({
              organized: organizeData.id,
              topic: topic,
            })
          );
          await Promise.all(topicPromises);
        }
      }

      // Return the complete conference data with organization details
      return {
        id: savedConference.id,
        title: savedConference.title,
        acronym: savedConference.acronym,
        status: savedConference.status,
        organization: {
          id: organizeData.id,
          year: year,
          accessType: conferenceData.type || 'Offline',
          publisher: conferenceData.publisher,
          summerize: conferenceData.summary,
          callForPaper: conferenceData.callForPapers,
          link: link,
          cfpLink: cfpLink,
          impLink: impLink,
          location: {
            address: conferenceData.location || '',
            cityStateProvince: conferenceData.cityStateProvince || '',
            country: conferenceData.country || '',
            continent: conferenceData.continent || '',
          },
          dates: {
            conferenceDates: conferenceData.conferenceDates,
            submissionDates: conferenceData.submissionDate,
            notificationDates: conferenceData.notificationDate,
            cameraReadyDates: conferenceData.cameraReadyDate,
            registrationDates: conferenceData.registrationDate,
            otherDates: conferenceData.otherDate,
          },
          topics: conferenceData.topics ? conferenceData.topics.split(',').map(topic => topic.trim()).filter(Boolean) : [],
        }
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

  async updateConferenceHistory(updateHistoryDto: ConferenceHistoryDto) {
    try {
      // Find the conference history by ID
      const existingHistory = await this.txHost.tx.conferenceOrganizations.findUnique({
        where: { id: updateHistoryDto.conferenceId },
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

      // Update the conference organization with only the provided fields
      const updatedHistory = await this.prismaService.conferenceOrganizations.update({
        where: { id: updateHistoryDto.conferenceId },
        data: updateData,
      });

      // Only update locations if provided
      if (updateHistoryDto.locations && updateHistoryDto.locations.length > 0) {
        // Delete existing locations
        await this.prismaService.locations.deleteMany({
          where: { organizeId: updateHistoryDto.conferenceId },
        });

        // Create new locations
        await Promise.all(
          updateHistoryDto.locations.map((location) =>
            this.txHost.tx.locations.create({
              data: {
                organizeId: updateHistoryDto.conferenceId,
                address: location.address || '',
                cityStateProvince: location.cityStateProvince || '',
                country: location.country || '',
                continent: location.continent || '',
                isAvailable: true,
              },
            }),
          ),
        );
      }

      // Only update topics if provided
      if (updateHistoryDto.topics && updateHistoryDto.topics.length > 0) {
        // Delete existing topics
        await this.txHost.tx.conferenceTopics.deleteMany({
          where: { organizeId: updateHistoryDto.conferenceId },
        });

        // Create new topics
        await Promise.all(
          updateHistoryDto.topics.map(async (topic) => {
            let topicInDB = await this.prismaService.topics.findFirst({
              where: { name: topic },
            });
            if (!topicInDB) {
              topicInDB = await this.prismaService.topics.create({
                data: {
                  name: topic,
                },
              });
            }
            return this.prismaService.conferenceTopics.create({
              data: {
                organizeId: updateHistoryDto.conferenceId,
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
          where: { organizedId: updateHistoryDto.conferenceId },
        });

        // Create new dates
        await Promise.all(
          updateHistoryDto.dates.map((date) =>
            this.prismaService.conferenceDates.create({
              data: {
                organizedId: updateHistoryDto.conferenceId,
                type: date.type || '',
                fromDate: date.startDate || new Date(),
                toDate: date.endDate || new Date(),
                name: date.name || '',
                isAvailable: true,
              },
            }),
          ),
        );
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

      return updatedConference;
    } catch (error) {
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
      const organization = await this.prismaService.conferenceOrganizations.findUnique({
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
      const organization = await this.prismaService.conferenceOrganizations.findUnique({
        where: { id },
      });

      if (!organization) {
        throw new HttpException('Organization history not found', HttpStatus.NOT_FOUND);
      }

      // Delete related data first
      await this.prismaService.$transaction([
        // Delete locations
        this.prismaService.locations.deleteMany({
          where: { organizeId: id },
        }),
        // Delete topics
        this.prismaService.conferenceTopics.deleteMany({
          where: { organizeId: id },
        }),
        // Delete dates
        this.prismaService.conferenceDates.deleteMany({
          where: { organizedId: id },
        }),
        // Finally delete the organization
        this.prismaService.conferenceOrganizations.delete({
          where: { id },
        }),
      ]);

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
}

import { Injectable } from '@nestjs/common';
import { paginator, PaginatorTypes } from '@nodeteam/nestjs-prisma-pagination';
import { Conferences, Prisma } from 'generated/prisma_client';
import { PrismaService } from 'src/modules/common';
import {
  AdminConferenceDTO,
  AdminConferenceParams,
} from '../models/admin-conference.dto';
import { Readable } from 'stream';
import * as papa from 'papaparse';
import { ConferenceEvaluationRow, ConferenceImportRow } from '../models/conference-import-row';
import { NativeConferenceService } from './native-conference.service';
import {
  FieldOfResearchService,
  RankService,
  SourceService,
} from 'src/modules/source-rank';
import { ConferenceOrganizationSerivce } from 'src/modules/conference-organization';
import { ConferenceRankService } from 'src/modules/conference/services/conference-rank.service';
import { ConferenceService } from 'src/modules/conference/services/conference.service';
import { converStringToDate, convertObjectToDate, parseDateRange } from 'src/modules/conference-job/utils/date-parse';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
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
          topics: true,
          conferenceDates: true,
        },
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
          new Set(item.ranks.map((rank) => rank.byRank.belongsToSource.name)),
        ),
        acronym: item.acronym,
        ranks: Array.from(
          new Set(item.ranks.map((rank) => rank.byRank.name as string)),
        ),
        researchFields: Array.from(
          new Set(
            item.ranks.map((rank) => rank.inFieldOfResearch.name as string),
          ),
        ),
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
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

  async parsePartEvaluateCsv  (
    file: Express.Multer.File) : Promise<ConferenceEvaluationRow[] > {
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
      return {
        ...row,
        submissionDate : JSON.parse(row.submissionDate as unknown as string),
        notificationDate : JSON.parse(row.notificationDate as unknown as string),
        cameraReadyDate : JSON.parse(row.cameraReadyDate as unknown as string),
        registrationDate : JSON.parse(row.registrationDate as unknown as string),
        otherDate : JSON.parse(row.otherDate),
      };
    })
  }


  async importConference (conference : ConferenceImportRow | undefined, adminId: string) {
    if(!conference) {
      throw new Error('No data to import');
    }
    let conferenceInDB = await this.nativeConferenceService.getConferenceByAcronym(
      conference.acronym,
      conference.title,
    )
    if(!conferenceInDB) {
      conferenceInDB = await this.nativeConferenceService.createConference(
        {
          title : conference.title,
          acronym : conference.acronym,
          adminId : adminId,
          status : 'DRAFT',
        }
      )
    }
    if(! await this.souceService.isExistSourceName(conference.source)) {
      await this.souceService.createSource({
        name : conference.source,
        link : ''
      })
    }
    const sourceInDB = await this.souceService.findOrCreateSource({
      name : conference.source,
      link : ''
    })
    const rankInDB = await this.rankService.findOrCreateRank({
      name : conference.rank,
      source : sourceInDB,
      value : 0
    })
    for (const researchFieldCode of conference.researchFieldCodes) {
      const researchFieldInDB = await this.fieldOfResearchService.getFieldOfResearchByCode(
        researchFieldCode
      )
      if(!researchFieldInDB) {
        throw new Error(`Research field with code ${researchFieldCode} not found`)
      }
      const t = await this.conferenceService.createOrFindRank(
        conferenceInDB?.id as string,
        rankInDB,
        researchFieldInDB?.id,
        new Date().getFullYear(),
      )
    }
    return {
      id : conferenceInDB?.id,
      title : conferenceInDB.title,
      sources : Array.from(
        new Set(
          conferenceInDB.ranks.map(
            (rank) => rank.byRank.belongsToSource.name as string,
          ),
        ),
      ) as string[],
      acronym : conferenceInDB.acronym,
      ranks : Array.from(
        new Set(
          conferenceInDB.ranks.map((rank) => rank.byRank.name as string),
        ),
      ) as string[],
      researchFields : Array.from(
        new Set(
          conferenceInDB.ranks.map(
            (rank) => rank.inFieldOfResearch.name as string,
          ),
        ),
      ) as string[],
      status : conferenceInDB.status,
      createdAt : conferenceInDB.createdAt,
      updatedAt : conferenceInDB.updatedAt,
    }

  }

  async importEvaluateConference(
    conference: ConferenceEvaluationRow |undefined,
    adminId: string,
  ) {
    if(
      !conference
    ) {
      throw new Error('No data to import');
    }
    
    const conferenceInDB = await this.conferenceService.getConferenceByAcronymAndTitle(
      conference?.name,
      conference?.acronym, 
    )
    
    if (!conferenceInDB) {
      console.log('conference', conference);
      throw new Error('Conference not found ' + conference.acronym + " " +conference.name);
    }
    try {
      const conferenceOrganization = await this.conferenceOrganizationService.importOrganize(
        {
          ...conference, 
          conferenceId: conferenceInDB.id,
          isAvailable : true, 
          summerize : conference.summary, 
          callForPaper : conference.callForPapers,
          accessType : conference.type,
          year : parseInt(conference.year),
        }
      )
      if(!conferenceOrganization){
        throw new Error('Conference organization cannot not be created');
        return false;
      }
      const conferenceLocation = await this.conferenceOrganizationService.importPlace(
        {
          organizeId : conferenceOrganization.id, 
          address : conference.location , 
          cityStateProvince : conference.cityStateProvince,
          country : conference.country,
          continent : conference.continent,
        }
      )

      const topics = conference.topics.split(',').map( async (topic) => {
        topic = topic.trim();
        return await this.conferenceOrganizationService.importTopic(
          {
            organized : conferenceOrganization.id,
            topic : topic,
          }
        )
      });

      await Promise.all(topics);
      const conferenceDate = converStringToDate(conference.conferenceDates, 'conferenceDates', conferenceOrganization.id)

      const submissionDate = convertObjectToDate(conference.submissionDate, 'submissionDate', conferenceOrganization.id);
      const notificationDate = convertObjectToDate(conference.notificationDate, 'notificationDate', conferenceOrganization.id);
      const cameraReadyDate = convertObjectToDate(conference.cameraReadyDate, 'cameraReadyDate', conferenceOrganization.id);
      const registrationDate = convertObjectToDate(conference.registrationDate, 'registrationDate', conferenceOrganization.id);
      const otherDate = convertObjectToDate(conference.otherDate, 'otherDate', conferenceOrganization.id)
     
      const allDates = [
        conferenceDate,
        ...submissionDate,
        ...notificationDate,
        ...cameraReadyDate,
        ...registrationDate,
        ...otherDate,
      ]
      for (let date of allDates) {
        await this.conferenceOrganizationService.importDate(date);
      }
      return true;
      
    }
    catch (error) {
      console.log('error', error);
      this.prismaService.errorConferenceLogger.create({
        data : {
          conferenceId : conferenceInDB.id,
          message : error.message,
          stack : error.stack,
        }
      })
    return false;
    }
  }
}

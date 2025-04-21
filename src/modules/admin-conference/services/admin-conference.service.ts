import { Injectable } from '@nestjs/common';
import { paginator, PaginatorTypes } from '@nodeteam/nestjs-prisma-pagination';
import {  Prisma } from 'generated/prisma_client';
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
import { ConferenceService } from 'src/modules/conference/services/conference.service';
import { converStringToDate, convertObjectToDate} from 'src/modules/conference-job/utils/date-parse';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import axios from 'axios';
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
    private readonly txHost : TransactionHost<TransactionalAdapterPrisma>,
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
          new Set(item.ranks.map((rank: { byRank: { belongsToSource: { name: any; }; }; }) => rank.byRank.belongsToSource.name)),
        ),
        acronym: item.acronym,
        ranks: Array.from(
          new Set(item.ranks.map((rank: { byRank: { name: string; }; }) => rank.byRank.name as string)),
        ),
        researchFields: Array.from(
          new Set(
            item.ranks.map((rank: { inFieldOfResearch: { name: string; }; }) => rank.inFieldOfResearch.name as string),
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
        complete: (result: { data: any[] | PromiseLike<any[]>; }) => resolve(result.data),
        error: (error: any) => reject(error),
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
          .map((code: string) => code.trim())
          .filter((code: string) => code !== ''),
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
        complete: (result: { data: any[] | PromiseLike<any[]>; }) => resolve(result.data),
        error: (error: any) => reject(error),
      });
    });
    return csvData.map((row): ConferenceEvaluationRow => {
      const t = {
        ...row,
        submissionDate : JSON.parse(row.submissionDate as unknown as string),
        notificationDate : JSON.parse(row.notificationDate as unknown as string),
        cameraReadyDate : JSON.parse(row.cameraReadyDate as unknown as string),
        registrationDate : JSON.parse(row.registrationDate as unknown as string),
        otherDate : JSON.parse(row.otherDate),
      };
      return t ;
    })
  }


  async importConference (conference : ConferenceImportRow | undefined, adminId: string) : Promise<AdminConferenceDTO> {
    if(!conference) {
      throw new Error('No data to import');
    }
    const cleanedAcronym = conference.acronym
      .replace(/\([^)]*\)/g, '') // Remove content inside parentheses
      .replace(/\s{2,}/g, ' ') // Replace double spaces with a single space
      .trim();
    const cleanedTitle = conference.title.replace(/\([^)]*\)/g, '') // Remove content inside parentheses
    .replace(/\s{2,}/g, ' ') // Replace double spaces with a single space
    .trim();
    let conferenceInDB = await this.nativeConferenceService.getConferenceByAcronym(
      cleanedAcronym,
      cleanedTitle
    );
    if(!conferenceInDB) {
      conferenceInDB = await this.nativeConferenceService.createConference(
        {
          title : cleanedTitle,
          acronym : cleanedAcronym,
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
    const researchFieldInDBs : any[] = []
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
      researchFieldInDBs.push(researchFieldInDB);
    }

    const organization = await this.conferenceOrganizationService.getFirstOrganizationsByConferenceId(
      conferenceInDB?.id as string)
    return {
      id : conferenceInDB?.id,
      title : conferenceInDB.title,
      sources : Array.from(
        new Set(
          conferenceInDB.ranks.map(
            (rank: { byRank: { belongsToSource: { name: string; }; }; }) => rank.byRank.belongsToSource.name as string,
          ),
        ),
      ) as string[],
      acronym : conferenceInDB.acronym,
      ranks : [
        ...
            conferenceInDB.ranks.map((rank: { byRank: { name: string; }; }) => rank.byRank.name as string)
      ,
        rankInDB.name,
      ],
      researchFields : 
         [ ...conferenceInDB.ranks.map(
            (rank: { inFieldOfResearch: { name: string; }; }) => rank.inFieldOfResearch.name as string,
          ), ...researchFieldInDBs.map(rs => rs.name as any)],
      status : organization?  'CRAWLED' : 'NOT CRAWLED',
      createdAt : conferenceInDB.createdAt,
      updatedAt : conferenceInDB.updatedAt,
    }

  }

  async importEvaluateConference(
    conference: ConferenceEvaluationRow |undefined,
  ) {
    if(
      !conference
    ) {
      throw new Error('No data to import');
    }
    const conferenceInDB = await this.conferenceService.getConferenceByAcronymAndTitle(
      conference?.title,
      conference?.acronym
    )

    if (!conferenceInDB) {
      console.log('No conference foudn', conference)
      return undefined;
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
      // throw new HttpException({
      //   message: 'error when importing conference',
      //   error: error,
      // }, 400);
      this.txHost.tx.errorConferenceLogger.create({
        data : {
          conferenceId : conferenceInDB.id,
          message : error.message,
          stack : error.stack,
        }
      
      })
    return false;
    }
  }

  async sendToCrawlConference (conferenceIds : string[]) {
    
    const params = {dataSource : 'client'}
    const conferences = await this.prismaService.conferences.findMany({
      where : {
        id : {
          in : conferenceIds
        }
      }
    })

    const sendToCrawl = conferences.map((c) => 
    ({
      Acronym : c.acronym, 
      Title : c.title
    })) 

    const response = await axios.post<File>(
      'http://localhost:3001/crawl-conferences',
      sendToCrawl,
      {
        params: params,
        headers: { 'Content-Type': 'application/json' },
        timeout: 600000 // Tăng timeout (vd: 10 phút) cho các request lớn/chunk
    }
    )
  }

  async getConferenceById (id : string)  {
    return this.txHost.tx.conferences.findUnique({
      where : {
        id
      }
    })
  }

}

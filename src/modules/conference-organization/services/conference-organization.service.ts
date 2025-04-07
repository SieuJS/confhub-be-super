import { PrismaService } from "../../common";
import { LocationInput } from "../models/location/location.input";
import { LocationDTO } from "../models/location/location.dto";
import { ConferenceDateInput } from "../models/date/conferencer-date.input";
import { ConferenceDateDTO } from "../models/date/conference-date.dto";
import { OrganizedInput } from "../models/organize/organized.input";
import { OrganizedDTO } from "../models/organize/organized.dto";
import { Injectable } from "@nestjs/common";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import {Transactional, TransactionHost} from "@nestjs-cls/transactional";
@Injectable()
export class ConferenceOrganizationSerivce {
    constructor (
        private prismaService : PrismaService,
        private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    ){}

    async importPlace(input : LocationInput) : Promise<LocationDTO> {
        const location = await this.txHost.tx   .locations.create({
            data : {
                continent : input.continent,
                country : input.country,
                cityStateProvince : input.cityStateProvince,
                address : input.address ,
                organizeId : input.organizeId,
                isAvailable : true
            }
        })
    return {
            ...location,
            continent: location.continent || '',
            country: location.country || '',
            cityStateProvince: location.cityStateProvince || '',
            address: location.address || ''
        };
    }

    async importDate(input : ConferenceDateInput) : Promise<ConferenceDateDTO> {
        const date = await this.txHost.tx.conferenceDates.create({
            data : {
                fromDate : input.fromDate,
                toDate : input.toDate,
                organizedId : input.organizedId,
                type : input.type,
                name : input.name,
                isAvailable : true
            }
        })
        return date;
    }

    async importTopic ({organized, topic} : {
        organized : string,
        topic : string
    }) {
        const topicInDb = await this.findOrCreateTopic(topic);

        const organizedTopic = await this.txHost.tx.conferenceTopics.create({
            data : {
                organizeId : organized,
                topicId : topicInDb.id
            }
        })
        return {
            ...organizedTopic,
            topic : topicInDb.name
        }
    }

    async findOrCreateTopic (topic : string) {
        let topicInDb = await this.txHost.tx.topics.findFirst({
            where : {
                name : {
                    contains : topic,
                    mode : 'insensitive'
                }
            }
        })
        if(!topicInDb) {
            topicInDb = await this.txHost.tx.topics.upsert({
                where : {
                    name : topic
                },
                update : {

                },
                create : {
                    name : topic,                }
            })
        }
        return topicInDb;
    }

    async importOrganize(input : OrganizedInput) : Promise<OrganizedDTO | undefined> {

        const organize = await this.txHost.tx.conferenceOrganizations.create({
            data : {
                year    : isNaN(input.year as number) ? null : input.year,
                accessType : input.accessType,
                link : input.link,
                impLink : input.impLink,
                isAvailable : true,
                cfpLink : input.cfpLink,
                summerize : input.summerize,
                callForPaper : input.callForPaper,
                conferenceId : input.conferenceId,
                publisher : input.publisher,
            }
        })

        if(!organize) {
            return undefined;
        }
        if(input.topics && input.topics.length > 0) {
            const topics = await Promise.all(input.topics.map(topic => this.importTopic({
                organized : organize.id,
                topic
            })))
        }
        return {
            ...organize,
            topics : input.topics
        }
    }

    async getFirstOrganizationsByConferenceId(conferenceId : string) : Promise<OrganizedDTO | undefined> {
       const organizedDb = await this.prismaService.conferenceOrganizations.findFirst({
            where : {
                isAvailable : true,
                conferenceId
            },
            include: {
                topics : {
                    include : {
                        inTopic : {
                            select : {
                                name : true
                            }
                        }
                    }
                }
            },
            orderBy : {
                updatedAt : 'desc'
            }
        });
        if(!organizedDb) {
            return undefined;
        }
        return {
            ...organizedDb,
            topics : organizedDb.topics?.map(topic => topic.inTopic.name)
        }
    }

    async getLocationsByOrganizedId(organizedId : string ) {
        return this.txHost.tx.locations.findMany({
            where : {
                isAvailable : true,
                organizeId : organizedId
            },
            orderBy : {
                updatedAt : 'desc'
            }
        })
    }

    async getConferenceDatesByOrganizedId(organizedId : string) {
        return this.prismaService.conferenceDates.findMany({
            where : {
                isAvailable : true,
                organizedId,
                type : 'conferenceDates'
            },
            orderBy : {
                updatedAt : 'desc'
            }
        })  
    }

    async getDatesByOrganizedId(organizedId : string) {
        return this.prismaService.conferenceDates.findMany({
            where : {
                isAvailable : true,
                organizedId
            },
            orderBy : {
                updatedAt : 'desc'
            },

        })
    }
    

    async getAllTopics () {
        return this.prismaService.topics.findMany({
        })
    }


}
import { PrismaService } from "../../common";
import { LocationInput } from "../models/location/location.input";
import { LocationDTO } from "../models/location/location.dto";
import { ConferenceDateInput } from "../models/date/conferencer-date.input";
import { ConferenceDateDTO } from "../models/date/conference-date.dto";
import { OrganizedInput } from "../models/organize/organized.input";
import { OrganizedDTO } from "../models/organize/organized.dto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ConferenceOrganizationSerivce {
    constructor (
        private prismaService : PrismaService
    ){}

    async importPlace(input : LocationInput) : Promise<LocationDTO> {
        const location = await this.prismaService.locations.create({
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
        const date = await this.prismaService.conferenceDates.create({
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

    async importTopics (organizedId : string ,topics : string[]) {
        topics = topics.map(topic => topic.trim()); 
        let topicsInDb = await this.prismaService.topics.findMany({
            where : {
                name : {
                    in : topics
                }
            }
        })

        const topicsToCreate = topics.filter(topic => {
            const exists = topicsInDb.find(topicInDb => topicInDb.name === topic)
            if(!exists) {
                return true;
            }
            return false;
        })

        const topicsCreated = await this.prismaService.topics.createManyAndReturn({
            data : topicsToCreate.map(topic => {
                return {
                    name : topic
                }
            })
        })  
        
        topicsInDb = topicsInDb.concat(topicsCreated);

        const organizedTopics = await this.prismaService.conferenceTopics.createMany({
            data : topicsInDb.map(topic => {
                return {
                    organizeId : organizedId,
                    topicId : topic.id
                }
            })
        })
    }

    async importOrganize(input : OrganizedInput) : Promise<OrganizedDTO | undefined> {
        
        if(!input.link) {
            return undefined;
        }

        const organize = await this.prismaService.conferenceOrganizations.create({
            data : {
                year    : input.year,
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

        await this.importTopics(organize.id, input.topics);

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
        return this.prismaService.locations.findMany({
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


}
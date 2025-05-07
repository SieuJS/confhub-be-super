import { HttpException, Injectable } from "@nestjs/common";
import { UserInput } from "../models/user.input";
import { PrismaService } from "../../common";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TransactionHost } from "@nestjs-cls/transactional";
import { JwtService } from "@nestjs/jwt";
@Injectable()
export class UserService {
    constructor(
        private prismaService : PrismaService,
        private txHost : TransactionHost<TransactionalAdapterPrisma>,
        private jwtService : JwtService
    ) {}

    async getAllUsers () {
        return await this.txHost.tx.users.findMany();
    }

    async getUserByEmail(email : string | undefined) {
        return await this.txHost.tx.users.findFirst({
            where : {
                email 
            }
        });
    }

    async getUserById(id : string) {
        return await this.txHost.tx.users.findUnique({
            where : {
                id
            }
        });
    }

    async getUserVerificationStatus(userId: string) {
        return await this.txHost.tx.userVerification.findFirst({
            where: {
                userId,
                isValid: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async createUser(input : UserInput) {
        return await this.txHost.tx.users.create({
            data : {
                ...input ,
            }
        })
    }

    async updateUser(userId: string, data: Partial<UserInput>) {
        return await this.txHost.tx.users.update({
            where: {
                id: userId
            },
            data: {
                ...data
            }
        });
    }
    
    async followConference(userId : string, conferenceId : string) {
        const conference = await this.txHost.tx.conferences.findUnique({
            where : {
                id : conferenceId
            }
        })
        if (!conference) {
            throw new HttpException("Conference not found",400)
        }
        const follow =  await this.txHost.tx.conferenceFollows.create({
            data : {
                userId,
                conferenceId
            },
            include : {
                belongsTo : {
                    select : {
                        title : true,
                        acronym : true
                    }
                }
            }
        })
        return follow;
    }

    async unfollowConference(userId : string, conferenceId : string) {
        const follow = await this.txHost.tx.conferenceFollows.findFirst({
            where : {
                userId,
                conferenceId
            }
        })
        if (!follow) {
            return ;
        }
        return await this.prismaService.conferenceFollows.delete({
            where : {
                conferenceId_userId : {
                    userId,
                    conferenceId
                }
            },
            include : {
                belongsTo : {
                    select : {
                        title : true,
                        acronym : true
                    }
                }
            }  
        })
    }

    async getFollowedConferences(userId : string) {
        return await this.txHost.tx.conferenceFollows.findMany({
            where : {
                userId
            }
        })
    }

    async addToCalendar(userId : string, conferenceId : string) {
        return await this.txHost.tx.conferenceCalendars.create({
            data : {
                userId,
                conferenceId
            }
        })
    }

    async removeFromCalendar(userId : string, conferenceId : string) {
        return await this.txHost.tx.conferenceCalendars.delete({
            where : {
                conferenceId_userId : {
                    userId,
                    conferenceId
                }
            }
        })
    }

    async generateToken(userId : string) {
        const user = await this.prismaService.users.findUnique({
            where : {
                id : userId
            }
        })
        if (!user) {
            throw new HttpException("User not found",400)
        }
        return {
            token : this.jwtService.sign({
                payload : {
                    id : user.id,
                    email : user.email,
                    role : 'user'
                }
            })
        }
    }

    async getSettings() {
        return await this.prismaService.users.findFirst({
            where : {
                id : "f3fce1eb-db4a-47f6-83c4-233559b481a8"
            },
            include : {
                notificationSettings : true,
            }
        })
    }

    async getFollowedConferencesByUserId(userId : string) {
        const followed = await this.txHost.tx.conferenceFollows.findMany({
            where : {
                userId
            },
            include: {
                belongsTo: {
                    include: {
                        organizations: {
                            include: {
                                conferenceDates: {
                                    where: 
                                    {
                                        name: "Conference Date"
                                    }
                                },
                                locations: true,
                            }
                        }
                    }
                }
            }
        })

        const formatedFollowedConferences = await Promise.all(
            followed.map((conference): Partial<any> => {
                const conferenceDate = conference.belongsTo?.organizations?.[conference.belongsTo?.organizations?.length - 1].conferenceDates?.length > 0 ? conference.belongsTo?.organizations?.[conference.belongsTo?.organizations?.length - 1].conferenceDates?.map((date) => (
                    {
                        fromDate: date.fromDate,
                        toDate: date.toDate,
                    })): [];
                const location = conference.belongsTo?.organizations?.[conference.belongsTo?.organizations?.length - 1].locations?.length > 0 ? conference.belongsTo?.organizations?.[conference.belongsTo?.organizations?.length - 1].locations?.map((location) => (
                    {
                        address: location.address ?? undefined,
                        cityStateProvince: location.cityStateProvince ?? undefined,
                        country: location.country ?? undefined,
                        continent: location.continent ?? undefined,
                    })): [];
              return {
                id: conference.conferenceId,
                title: conference.belongsTo?.title,
                acronym: conference.belongsTo?.acronym,
                creatorId: conference.creatorId,
                adminId: conference.adminId ?? undefined,
                followedAt: conference.createdAt,
                updatedAt: conference.updatedAt,
                status: conference.belongsTo.status,
                dates: 
                {
                    fromDate: conferenceDate?.[0]?.fromDate,
                    toDate: conferenceDate?.[0]?.toDate,
                },
                location: 
                {
                    address: location?.[0]?.address ?? undefined,
                    cityStateProvince: location?.[0]?.cityStateProvince ?? undefined,
                    country: location?.[0]?.country ?? undefined,
                    continent: location?.[0]?.continent ?? undefined,
                },
              }
            }))

        return formatedFollowedConferences
    }

    async addToBlacklist(userId : string, conferenceId : string) {
        const conference = await this.txHost.tx.conferences.findUnique({
            where : {
                id : conferenceId
            }
        })
        if (!conference) {
            throw new HttpException("Conference not found",400)
        }

        const blacklist =  await this.txHost.tx.conferenceBlacklists.create({
            data : {
                userId,
                conferenceId
            },
            include : {
                belongsTo : {
                    select : {
                        title : true,
                        acronym : true
                    }
                }
            }
        })
        return blacklist;
    }

    async removeFromBlacklist(userId : string, conferenceId : string) {
        const blacklist = await this.txHost.tx.conferenceBlacklists.findFirst({
            where : {
                userId,
                conferenceId
            }
        })
        if (!blacklist) {
            return ;
        }
        return await this.prismaService.conferenceBlacklists.delete({
            where : {
                id : blacklist.id
            },
            include : {
                belongsTo : {
                    select : {
                        title : true,
                        acronym : true
                    }
                }
            }  
        })
    }

    async getAddedBlacklistConferences(userId : string) {
        const blacklist = await this.txHost.tx.conferenceBlacklists.findMany({
            where : {
                userId
            },
            include: {
                belongsTo: {
                    include: {
                        organizations: {
                            include: {
                                conferenceDates: {
                                    where: 
                                    {
                                        name: "Conference Date"
                                    }
                                },
                                locations: true,
                            }
                        }
                    }
                }
            }
        })

        const formatedBlacklistConferences = await Promise.all(
            blacklist.map((conference): Partial<any> => {
                const conferenceDate = conference.belongsTo?.organizations?.[conference.belongsTo?.organizations?.length - 1].conferenceDates?.length > 0 ? conference.belongsTo?.organizations?.[conference.belongsTo?.organizations?.length - 1].conferenceDates?.map((date) => (
                    {
                        fromDate: date.fromDate,
                        toDate: date.toDate,
                    })): [];
                const location = conference.belongsTo?.organizations?.[conference.belongsTo?.organizations?.length - 1].locations?.length > 0 ? conference.belongsTo?.organizations?.[conference.belongsTo?.organizations?.length - 1].locations?.map((location) => (
                    {
                        address: location.address ?? undefined,
                        cityStateProvince: location.cityStateProvince ?? undefined,
                        country: location.country ?? undefined,
                        continent: location.continent ?? undefined,
                    })): [];
              return {
                id: conference.id,
                conferenceId: conference.conferenceId,
                title: conference.belongsTo?.title,
                acronym: conference.belongsTo?.acronym,
                creatorId: conference.creatorId,
                adminId: conference.adminId ?? undefined,
                createdAt: conference.createdAt,
                updatedAt: conference.updatedAt,
                status: conference.belongsTo.status,
                dates: 
                {
                    fromDate: conferenceDate?.[0]?.fromDate,
                    toDate: conferenceDate?.[0]?.toDate,
                },
                location: 
                {
                    address: location?.[0]?.address ?? undefined,
                    cityStateProvince: location?.[0]?.cityStateProvince ?? undefined,
                    country: location?.[0]?.country ?? undefined,
                    continent: location?.[0]?.continent ?? undefined,
                },
              }
            }))

        return formatedBlacklistConferences

    }
    
}
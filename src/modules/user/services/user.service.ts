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

    async getUserByEmail(email : string) {
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

    async createUser(input : UserInput) {
        return await this.txHost.tx.users.create({
            data : {
                ...input ,
            }
        })
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
        return await this.txHost.tx.conferenceFollows.findMany({
            where : {
                userId
            },
        })
    }
}
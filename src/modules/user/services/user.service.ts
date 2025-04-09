import { Injectable } from "@nestjs/common";
import { UserInput } from "../models/user.input";
import { PrismaService } from "../../common";
import * as jwt from 'jsonwebtoken';
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TransactionHost } from "@nestjs-cls/transactional";
@Injectable()
export class UserService {
    constructor(
        private prismaService : PrismaService,
        private txHost : TransactionHost<TransactionalAdapterPrisma>
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
        return await this.txHost.tx.conferenceFollows.create({
            data : {
                userId,
                conferenceId
            }
        })
    }

    async unfollowConference(userId : string, conferenceId : string) {
        return await this.txHost.tx.conferenceFollows.delete({
            where : {
                conferenceId_userId : {
                    userId,
                    conferenceId
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
        const env = process.env ; 
        const token = jwt.sign({
            userId,
            role : "user"
        }, env.JWT_SECRET as any, {
            expiresIn : '1h',
            issuer : env.JWT_ISSUER
        });
        return token;
    }

    
}
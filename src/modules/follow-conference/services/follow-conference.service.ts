import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/common";

@Injectable() 
export class FollowConferenceService {
    constructor (
        private readonly prismaService : PrismaService
    ){}

    
}
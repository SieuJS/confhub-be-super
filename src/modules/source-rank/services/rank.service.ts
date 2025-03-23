import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common";
import { RankInputDTO } from "../models/rank-input.dto";
import { RankDTO } from "../models/rank.dto";

@Injectable()
export class RankService { 
    private readonly prismaService: PrismaService;
    
    constructor(prismaService: PrismaService) {
        this.prismaService = prismaService;
    }
    
    

    public async createRank(rank: RankInputDTO): Promise<RankDTO> {
        const rankCreated = await this.prismaService.ranks.create({
            data: {
                name: rank.name,
                value: rank.value,
                sourceId: rank.source.id
            },
            include: {
                belongsToSource: true
            }
        })
        return {
            id : rankCreated.id,
            name : rankCreated.name,
            value : rankCreated.value,
            source : rankCreated.belongsToSource
        }

    }

    public async findOrCreateRank (rank : RankInputDTO) : Promise<RankDTO> {
        const existingRank = await this.prismaService.ranks.findFirst({
            where : {
                name : rank.name,
                value : rank.value,
                sourceId : rank.source.id
            },
            include : {
                belongsToSource : true
            }
        })

        if(existingRank) {
            return {
                id : existingRank.id,
                name : existingRank.name,
                value : existingRank.value,
                source : existingRank.belongsToSource
            }
        }

        return await this.createRank(rank);
    }

    public async findOrCreateFieldOfResearch (fieldOfResearch : string) {
        const existingFieldOfResearch = await this.prismaService.fieldOfResearchs.findFirst({
            where : {
                name : fieldOfResearch
            }
        })

        if(existingFieldOfResearch) {
            return existingFieldOfResearch;
        }

        return await this.prismaService.fieldOfResearchs.create({
            data : {
                name : fieldOfResearch,
                code : 'UNDEFINE'
            }
        })
    }

}
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common";
import { ConferenceRankDTO } from "../models/conference-rank/conference-rank.dto";

@Injectable() 
export class ConferenceRankService {
    constructor(
        private prismaService : PrismaService
    ) {

    }

    async getRankByConferenceId(conferenceId : string) : Promise<ConferenceRankDTO[]> {
        const rankInfos = await this.prismaService.conferenceRanks.findMany({
            where : {
                conferenceId
            },
            include : {
                inFieldOfResearch : true,
                byRank : {
                    include : {
                        belongsToSource : true
                    }
                }
            }
        })
        const results : ConferenceRankDTO[] = rankInfos.map(rankInfo => {
            return {
                rank : rankInfo.byRank.name,
                source : rankInfo.byRank.belongsToSource.name,
                fieldOfResearch : rankInfo.inFieldOfResearch.name
            }
        }
        )
        return results;

    }
}
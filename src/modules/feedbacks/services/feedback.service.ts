import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/common";
import { FeedbackInputDTO } from "../models/feedback.input.dto";

@Injectable()
export class FeedbackService {
    constructor(
        private prismaService : PrismaService
    ) {}

    async createFeedback( input : FeedbackInputDTO){
        this.prismaService.conferenceFeedbacks.create({
            data: {
                ...input
            }
        })
    }
}
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/common";
import { TransactionHost } from "@nestjs-cls/transactional";
@Injectable() 
export class UserVerifyService {
    constructor(
        private readonly prismaService : PrismaService,
        private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    ) {}

    async createVerifyCode(userId: string, code: string) {
        const existingCode = await this.existsVerifyCode(userId, code);
        if (existingCode) {
            await this.disableVerifyCode(existingCode.id);
        }
        
        const verifyCode = await this.prismaService.userVerification.create({
            data: {
                userId,
                verificationCode: code,
                verificationCodeExpires : new Date(Date.now() +  60 * 1000), // 1 hour expiration
                isVerified: false,
            },
        });
        return verifyCode;
    }

    async existsVerifyCode(userId: string, code: string) {
        const verifyCode = await this.prismaService.userVerification.findFirst({
            where: {
                userId,
                verificationCode: code,
                isValid : true,
                verificationCodeExpires: {
                    gte: new Date(), // Check if the code is not expired
                },
            },
        });
    

        return verifyCode;
    }

    async disableVerifyCode(verifyId : string) {
        const verifyCode = await this.prismaService.userVerification.update({
            where: {
                id : verifyId,
            },
            data: {
                isValid : false,
            },
        });

        return verifyCode;
    }
}
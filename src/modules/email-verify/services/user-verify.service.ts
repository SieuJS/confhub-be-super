import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { UserVerifyDTO } from '../models/user-verify-dto';
@Injectable()
export class UserVerifyService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  async createVerifyCode(userId: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit code
    const existingCode = await this.existsVerifyCode(userId, code);
    if (existingCode) {
      await this.disableVerifyCode(existingCode.id);
    }

    const verifyCode = await this.txHost.tx.userVerification.create({
      data: {
        userId,
        verificationCode: code,
        verificationCodeExpires: new Date(Date.now() + 60 * 1000), // 1 hour expiration
        isVerified: false,
      },
    });
    return verifyCode as UserVerifyDTO;
  }

  async existsVerifyCode(userId: string, code: string) {
    const verifyCode = await this.txHost.tx.userVerification.findFirst({
      where: {
        userId,
        verificationCode: code,
        isValid: true,
        verificationCodeExpires: {
          gte: new Date(), // Check if the code is not expired
        },
      },
    });
    return verifyCode;
  }

  async disableVerifyCode(verifyId: string) {
    const verifyCode = await this.txHost.tx.userVerification.update({
      where: {
        id: verifyId,
      },
      data: {
        isValid: false,
      },
    });

    return verifyCode;
  }

  async verifyCode(userId: string, code: string) {
    const t = await this.txHost.tx.userVerification.findFirst({
      where: {
        userId,
      },
    });

    const verifyCodeFound = await this.txHost.tx.userVerification.findFirst(
      {
        where: {
          userId,
          verificationCode: code,
          isValid: true,
          verificationCodeExpires: {
            gte: new Date(Date.now()), // Check if the code is not expired
          },
        },
      },
    );
    if (!verifyCodeFound) {
      throw new Error('Invalid or expired verification code');
    }
    return verifyCodeFound;
  }

  async verifyUser(verifyCodeId: string) {
    try {
      const user = await this.txHost.tx.userVerification.update({
        where: {
          id: verifyCodeId,
        },
        data: {
          isVerified: true,
        },
      });
      return user;
    } catch (error) {
      console.error('Error verifying user:', error);
      throw new Error('Failed to verify user');
    }
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
}

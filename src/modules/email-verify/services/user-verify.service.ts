import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { UserVerifyDTO } from '../models/user-verify-dto';
import { UserVerification, PrismaClient } from 'generated/prisma_client';

@Injectable()
export class UserVerifyService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
  ) {}

  async createVerifyCode(userId: string): Promise<UserVerifyDTO> {
    // Disable any existing valid verification codes for this user
    await this.txHost.tx.userVerification.updateMany({
      where: {
        userId,
        isValid: true,
      },
      data: {
        isValid: false,
      },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit code
    const verifyCode = await this.txHost.tx.userVerification.create({
      data: {
        userId,
        verificationCode: code,
        verificationCodeExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiration
        isVerified: false,
        isValid: true,
      },
    });
    return verifyCode as UserVerifyDTO;
  }

  async existsVerifyCode(
    userId: string,
    code: string,
  ): Promise<UserVerification | null> {
    return await this.txHost.tx.userVerification.findFirst({
      where: {
        userId,
        verificationCode: code,
        isValid: true,
        verificationCodeExpires: {
          gte: new Date(),
        },
      },
    });
  }

  async disableVerifyCode(verifyId: string): Promise<UserVerification> {
    return await this.txHost.tx.userVerification.update({
      where: {
        id: verifyId,
      },
      data: {
        isValid: false,
      },
    });
  }

  async verifyCode(userId: string, code: string): Promise<UserVerification> {
    const verifyCodeFound = await this.txHost.tx.userVerification.findFirst({
      where: {
        userId,
        verificationCode: code,
        isValid: true,
        verificationCodeExpires: {
          gte: new Date(),
        },
      },
    });

    if (!verifyCodeFound) {
      throw new Error('Invalid or expired verification code');
    }

    // Disable the used verification code
    await this.disableVerifyCode(verifyCodeFound.id);

    return verifyCodeFound;
  }

  async verifyUser(verifyCodeId: string): Promise<UserVerification> {
    try {
      const user = await this.txHost.tx.userVerification.update({
        where: {
          id: verifyCodeId,
        },
        data: {
          isVerified: true,
          isValid: false, // Disable the code after successful verification
        },
      });
      return user;
    } catch (error) {
      console.error('Error verifying user:', error);
      throw new Error('Failed to verify user');
    }
  }

  async getUserVerificationStatus(
    userId: string,
  ): Promise<UserVerification | null> {
    return await this.txHost.tx.userVerification.findFirst({
      where: {
        userId,
        isVerified: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

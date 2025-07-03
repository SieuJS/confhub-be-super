import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common';
import { SourceInputDTO } from '../models/source-input.dto';
import { SourceDTO } from '../models/source.dto';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';

@Injectable()
export class SourceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  public createSource(source: SourceInputDTO): Promise<SourceDTO> {
    return this.txHost.tx.sources.create({
      data: source,
    });
  }

  public async isExistSourceName(name: string): Promise<boolean> {
    const source = await this.txHost.tx.sources.findUnique({
      where: {
        name,
      },
    });
    return source ? true : false;
  }

  public async findOrCreateSource(source: SourceInputDTO): Promise<SourceDTO> {
    const sourceI = await this.txHost.tx.sources.upsert({
      where: {
        name: source.name,
      },
      create: source,
      update: {},
    });
    return sourceI;
  }

  public async removeSource(id: string): Promise<SourceDTO> {
    // First, get the source to return it after deletion
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const sourceToDelete = await this.txHost.tx.sources.findUnique({
      where: { id },
    });

    if (!sourceToDelete) {
      throw new Error(`Source with id ${id} not found`);
    }

    // Get all ranks associated with this source
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const ranksToDelete = await this.txHost.tx.ranks.findMany({
      where: {
        sourceId: id,
      },
      select: {
        id: true,
      },
    });

    // Delete all conference ranks that reference the ranks from this source
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (ranksToDelete.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.txHost.tx.conferenceRanks.deleteMany({
        where: {
          rankId: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            in: ranksToDelete.map((rank: any) => rank.id),
          },
        },
      });
    }

    // Delete all related ranks (due to foreign key constraint)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await this.txHost.tx.ranks.deleteMany({
      where: {
        sourceId: id,
      },
    });

    // Finally delete the source
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await this.txHost.tx.sources.delete({
      where: { id },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return sourceToDelete;
  }
}

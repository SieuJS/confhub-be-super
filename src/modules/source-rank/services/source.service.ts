import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common";
import { SourceInputDTO } from "../models/source-input.dto";
import { SourceDTO } from "../models/source.dto";
import { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TransactionHost } from "@nestjs-cls/transactional";

@Injectable() 
export class SourceService {
    constructor(
    private readonly prismaService : PrismaService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>
    ) {}

    public createSource (source : SourceInputDTO) : Promise<SourceDTO> {
        return this.txHost.tx.sources.create ({
            data : source
        })
    }

    public async isExistSourceName (name : string) : Promise<boolean> {
        const source = await this.txHost.tx.sources.findUnique({
            where : {
                name
            }
        })
        return source ? true : false;
    }

    public async findOrCreateSource (source : SourceInputDTO) : Promise<SourceDTO> {
        const sourceI = await this.txHost.tx.sources.upsert({
            where : {
                name : source.name
            },
            create : source,
            update : {}
        })
        return sourceI;
    }

}
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common';
import { JournalImport } from '../../models/journal.import';
import { JournalRankInput } from '../../models/journal-rank.dto';
import { RankService, SourceService } from 'src/modules/source-rank';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';
import { CreateJournalDto } from '../../dto/journal.dto';
import * as fs from 'fs';
import * as readline from 'readline';

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(
    private prismaService: PrismaService,
    private readonly rankService: RankService,
    private readonly sourceService: SourceService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  async getAllJournalEntries() {
    return await this.prismaService.journals.findMany({});
  }

  async createOrCreateJournalEntry(journalImport: JournalImport) {
    const journalByTitle = await this.txHost.tx.journals.findFirst({
      where: {
        title: journalImport.Title,
      },
    });

    return this.txHost.tx.journals.upsert({
      where: {
        id: journalByTitle?.id || '',
      },
      update: {
        scimagoLink: journalImport.scimagoLink,
        bioxbio: journalImport.bioxbio,
        image: journalImport.Image,
        imageContext: journalImport.Image_Context,
        title: journalImport.Title,
        issn: journalImport.Issn,
        sjr: journalImport.SJR,
        hIndex: journalImport['H index'],
        scope: journalImport.Scope || '',
        publisher: journalImport.Publisher,
        country: journalImport.Country,
        emailSubmission: '',
        totalDocs: journalImport['Total Docs. (2023)'],
        totalDocs3Years: journalImport['Total Docs. (3years)'],
        totalRefs: journalImport['Total Refs.'],
        refsPerDoc: journalImport['Ref. / Doc.'],
        region: journalImport.Region,
      },
      create: {
        scimagoLink: journalImport.scimagoLink,
        bioxbio: journalImport.bioxbio,
        image: journalImport.Image,
        imageContext: journalImport.Image_Context,
        title: journalImport.Title,
        issn: journalImport.Issn,
        sjr: journalImport.SJR,
        hIndex: journalImport['H index'],
        scope: journalImport.Scope || '',
        publisher: journalImport.Publisher,
        country: journalImport.Country,
        emailSubmission: journalImport['Information.Mail'] || '',
        totalDocs: journalImport['Total Docs. (2023)'],
        totalDocs3Years: journalImport['Citable Docs. (3years)'],
        totalRefs: journalImport['Total Refs.'],
        refsPerDoc: journalImport['Ref. / Doc.'],
        region: journalImport.Region,
        coverage: journalImport.Coverage,
        areas: journalImport['Subject Area and Category.Areas'] || '',
      },
    });
  }

  async importJournalEntries(journalImport: JournalImport) {
    return this.txHost.tx.journals.create({
      data: {
        scimagoLink: journalImport.scimagoLink,
        bioxbio: journalImport.bioxbio,
        image: journalImport.Image,
        imageContext: journalImport.Image_Context,
        title: journalImport.Title,
        issn: journalImport.Issn,
        sjr: journalImport.SJR,
        hIndex: journalImport['H index'],
        scope: journalImport.Scope || '',
        publisher: journalImport.Publisher,
        country: journalImport.Country,
        emailSubmission: '',
        totalDocs: journalImport['Total Docs. (2023)'],
        totalDocs3Years: journalImport['Citable Docs. (3years)'],
        totalRefs: journalImport['Total Refs.'],
        refsPerDoc: journalImport['Ref. / Doc.'],
        region: journalImport.Region,
      },
    });
  }

  async importJournalCategory(cate: string) {
    const cateInDb = await this.txHost.tx.journalCategories.findFirst({
      where: {
        category: cate,
      },
    });
    return this.prismaService.journalCategories.upsert({
      where: {
        id: cateInDb?.id || '',
      },
      create: {
        category: cate,
      },
      update: {
        category: cate,
      },
    });
  }

  async importJournalRank(input: JournalRankInput) {
    const journal = await this.txHost.tx.journals.findFirst({
      where: {
        id: input.journalId,
      },
    });

    if (!journal) {
      throw new NotFoundException('Journal not found');
    }

    const category = await this.txHost.tx.journalCategories.findFirst({
      where: {
        category: input.category,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const source = await this.sourceService.findOrCreateSource({
      name: 'Scrimago',
      link: 'https://www.scimagojr.com/',
    });

    const rankInDb = await this.rankService.findOrCreateRank({
      name: input.quartile,
      value: 1,
      source: source,
    });

    return this.txHost.tx.journalRanks.create({
      data: {
        journalId: journal.id,
        cateId: category?.id,
        year: parseInt(input.year),
        quartile: input.quartile,
        rankId: rankInDb.id,
      },
    });
  }

  async importJournalsFromJsonl(filePath: string): Promise<void> {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let count = 0;
    for await (const line of rl) {
      try {
        const journalData = JSON.parse(line);
        await this.createJournal(journalData);
        count++;
        if (count % 100 === 0) {
          this.logger.log(`Imported ${count} journals`);
        }
      } catch (error) {
        this.logger.error(`Error importing journal: ${error.message}`);
      }
    }
    this.logger.log(`Finished importing ${count} journals`);
  }

  async createJournal(data: CreateJournalDto) {
    const { categories, fields, ...journalData }: CreateJournalDto = data;

    return this.prismaService.journals.create({
      data: {
        title: journalData.title,
        issn: journalData.issn || '',
        hIndex: journalData.hIndex?.toString() || '0',
        publisher: journalData.publisher || '',
        country: journalData.country || '',
        scimagoLink: journalData.scimagoLink || '',
        sjr: journalData.sjr?.toString() || '0',
        scope: journalData.scope || '',
        emailSubmission: journalData.email || '',
        totalDocs: journalData.totalDocs2023?.toString(),
        totalDocs3Years: journalData.totalDocs3Years?.toString(),
        totalRefs: journalData.totalRefs?.toString(),
        totalCites3Years: journalData.totalCites3Years?.toString(),
        citableDocs3Years: journalData.citableDocs3Years?.toString(),
        citesPerDoc2Years: journalData.citesPerDoc2Years?.toString(),
        refsPerDoc: journalData.refsPerDoc?.toString(),
        percentFemale: journalData.femalePercentage?.toString(),
        overton: journalData.overton?.toString(),
        sdg: journalData.sdg?.toString(),
        region: journalData.region,
        coverage: journalData.coverage,
        categories: JSON.stringify(categories),
        areas: JSON.stringify(fields),
        homepage: journalData.homepage,
        howToPublish: journalData.howToPublish,
        mail: journalData.email,
      },
    });
  }
}

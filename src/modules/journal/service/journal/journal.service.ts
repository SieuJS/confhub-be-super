import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common';
import * as JournalData from './journal_data.json';
import { JournalImport, JournalRankImport } from '../../models/journal.import';

@Injectable()
export class JournalService {
  constructor(private prismaService: PrismaService) {}

  async getAllJournalEntries() {
    return await this.prismaService.journals.findMany({});
  }

  async importJournalEntries(journalImport: JournalImport) {
    return this.prismaService.journals.create({
      data: {
        scimagoLink: journalImport.scimagoLink,
        bioxbio: journalImport.bioxbio,
        image: journalImport.Image,
        imageContext: journalImport.Image_Context,
        title: journalImport.Title,
        issn: journalImport.Issn,
        sjr: journalImport.SJR,
        hIndex: journalImport.HIndex,
        scope: journalImport.Scope,
        publisher: journalImport.Publisher,
        country: journalImport.Country,
        emailSubmission: '',
      },
    });
  }

  async importJournalCategory(cate : string){
    const cateInDb = await this.prismaService.journalCategories.findFirst({
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
    })
  }

}

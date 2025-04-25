import { Test, TestingModule } from '@nestjs/testing';
import { JournalController } from './journal.controller';
import { JournalService } from '../../service/journal/journal.service';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Journals } from 'generated/prisma_client';

describe('JournalController', () => {
  let controller: JournalController;
  let service: JournalService;
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JournalController],
      providers: [
        {
          provide: JournalService,
          useValue: {
            getAllJournalEntries: jest.fn(),
          }
        }
      ]
    }).compile();

    controller = module.get<JournalController>(JournalController);
    service = module.get<JournalService>(JournalService);
    app = module.createNestApplication();
    await app.init();
  });

  describe('GET /journal', () => {
    it('should return all journal entries', async () => {
      const mockEntries = [
        { id: 1, title: 'Journal Entry 1' } as unknown as Journals,
        { id: 2, title: 'Journal Entry 2' } as unknown as Journals,
      ];

      jest.spyOn(service, 'getAllJournalEntries').mockResolvedValue(mockEntries);

      const response = await request(app.getHttpServer())
        .get('/journal')
        .expect(200);

      expect(response.body).toEqual(mockEntries);
    })
  }
)});

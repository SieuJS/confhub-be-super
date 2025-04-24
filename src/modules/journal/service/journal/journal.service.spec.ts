import { Test, TestingModule } from '@nestjs/testing';
import { JournalService } from './journal.service';
import { CommonModule } from '../../../common';

describe('JournalService', () => {
  let service: JournalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CommonModule],
      providers: [JournalService],
    }).compile();

    service = module.get<JournalService>(JournalService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all journal entries', async () => {
    const result = await service.getAllJournalEntries();
    console.log(result)
    expect(result).toBeDefined();
  });
});

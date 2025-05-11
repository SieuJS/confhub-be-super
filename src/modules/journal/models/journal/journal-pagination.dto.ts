import { ApiProperty } from '@nestjs/swagger';
import { JournalDTO } from './journal.dto';

export class JournalPaginationDTO {
  @ApiProperty({ type: [JournalDTO] })
  data: JournalDTO[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  perPage: number;

  @ApiProperty()
  totalPages: number;
}

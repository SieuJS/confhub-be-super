import { PickType } from '@nestjs/swagger';
import { ConferenceBlacklistDTO } from './conference-added-blacklist.dto';

export class ConferenceBlacklistByDTO extends PickType(ConferenceBlacklistDTO, [
  'id',
  'userId',
  'user',
  'createdAt',
  'updatedAt',
]) {}

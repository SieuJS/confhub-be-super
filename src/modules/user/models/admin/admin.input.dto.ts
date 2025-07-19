import { OmitType, PickType } from '@nestjs/swagger';
import { AdminDto } from './admin.dto';

export class AdminInputDto extends OmitType(AdminDto, ['id']) {}

export class AdminSigninInput extends PickType(AdminDto, [
  'email',
  'password',
]) {}

import { Module } from '@nestjs/common';
import { ConferenceOrganizationSerivce } from './services';
import { CommonModule } from '../common';

@Module({
    imports: [CommonModule],
    providers: [ConferenceOrganizationSerivce],
    controllers: [],
    exports: [ConferenceOrganizationSerivce]
})
export class ConferenceOrganizationModule {}

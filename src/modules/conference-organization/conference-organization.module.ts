import { Module } from '@nestjs/common';
import { ConferenceOrganizationSerivce } from './services';
import { CommonModule } from '../common';
import { ConferenceOrganizationController } from './controllers/conference-organization.controller';

@Module({
    imports: [CommonModule],
    providers: [ConferenceOrganizationSerivce],
    controllers: [ConferenceOrganizationController],
    exports: [ConferenceOrganizationSerivce]
})
export class ConferenceOrganizationModule {}

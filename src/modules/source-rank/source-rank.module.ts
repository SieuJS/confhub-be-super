import { Module } from '@nestjs/common';
import { CommonModule } from '../common';
import { RankService } from './services/rank.service';
import { SourceService } from './services/source.service';
import { FieldOfResearchService } from './services/field-of-research.service';

@Module({
    imports : [CommonModule] ,
    providers : [RankService , SourceService , FieldOfResearchService],
    exports : [RankService , SourceService , FieldOfResearchService]
})
export class SourceRankModule {}

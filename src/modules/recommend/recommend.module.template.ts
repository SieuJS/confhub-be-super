// Template for declaring a module in NestJS
import { Module } from '@nestjs/common';
import { RecommendService } from './services/recommend.service';

@Module({
  imports: [],
  controllers: [],
  providers: [RecommendService],
  exports: [RecommendService],
})
export class RecommendModule {}

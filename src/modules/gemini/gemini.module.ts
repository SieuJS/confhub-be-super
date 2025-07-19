import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiService } from './services/gemini.service';
import { GeminiConfigService } from './config/gemini-config.service';
import { GeminiController } from './controllers/gemini.controller';

@Module({
  imports: [ConfigModule],
  controllers: [GeminiController],
  providers: [GeminiService, GeminiConfigService],
  exports: [GeminiService, GeminiConfigService],
})
export class GeminiModule {}

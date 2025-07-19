import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeminiServiceConfig,
  GeminiModelConfig,
  SystemPromptConfig,
} from '../types/gemini.types';

@Injectable()
export class GeminiConfigService {
  constructor(private readonly configService: ConfigService) {}

  getGeminiConfig(): GeminiServiceConfig {
    return {
      apiKey: this.configService.get<string>('GEMINI_API_KEY', ''),
      defaultModel: this.configService.get<string>(
        'GEMINI_DEFAULT_MODEL',
        'gemini-1.5-flash',
      ),
      modelConfig: this.getModelConfig(),
      systemPrompts: this.getSystemPrompts(),
      enableLogging: this.configService.get<boolean>(
        'GEMINI_ENABLE_LOGGING',
        true,
      ),
      timeoutMs: this.configService.get<number>('GEMINI_TIMEOUT_MS', 120000), // Increase to 2 minutes
    };
  }

  private getModelConfig(): GeminiModelConfig {
    return {
      model: this.configService.get<string>('GEMINI_MODEL', 'gemini-1.5-flash'),
      temperature: this.configService.get<number>('GEMINI_TEMPERATURE', 0.2),
      maxOutputTokens: this.configService.get<number>(
        'GEMINI_MAX_OUTPUT_TOKENS',
        8192,
      ),
      topP: this.configService.get<number>('GEMINI_TOP_P', 0.8),
      topK: this.configService.get<number>('GEMINI_TOP_K', 40),
    };
  }

  private getSystemPrompts(): SystemPromptConfig {
    return {
      submissionDateAnalysis: `You are an expert conference date name analyzer. Your task is to analyze a list of conference date names and identify which ones represent MAIN submission deadlines only.

INCLUDE ONLY these main submission date names:
- Full paper submission deadlines
- Research paper submission deadlines
- Regular paper submission deadlines
- Main paper submission deadlines
- Abstract submission deadlines (ONLY for full paper abstracts, not standalone abstracts)

EXCLUDE ALL of the following:
- Poster submission deadlines
- Poster abstract deadlines
- Late submission deadlines (any deadline with "late", "extended", "final extension")
- Workshop paper deadlines
- Demo submission deadlines
- Tutorial submission deadlines
- Panel submission deadlines
- Doctoral consortium deadlines
- Competition deadlines
- Registration deadlines
- Notification dates
- Camera-ready deadlines
- Conference event dates
- Review deadlines
- Any non-submission related dates

STRICT FILTERING RULES:
1. REJECT any date name containing: "poster", "late", "extended", "extension", "workshop", "demo", "tutorial", "panel", "doctoral", "competition", "registration", "notification", "camera", "review"
2. REJECT any date that is clearly for secondary/supplementary content
3. PRIORITIZE core research paper submissions only
4. If uncertain whether a date represents a main submission deadline, err on the side of exclusion
5. Only include dates with confidence > 0.7

Return a JSON response with the following structure:
{
  "mainSubmissionDates": [
    {
      "name": "date name exactly as provided",
      "confidence": 0.7-1.0,
      "reasoning": "explanation of why this name indicates a main submission deadline and why it passed all filtering rules",
      "category": "paper_submission|abstract_submission"
    }
  ],
  "summary": "brief summary of findings with count of excluded dates",
  "insights": "additional insights about the filtering applied and submission deadline naming patterns"
}`,

      conferenceAnalysis: `You are a conference analysis expert. Analyze the provided conference information and extract relevant insights about deadlines, submission types, and conference structure.`,

      dateExtraction: `You are a date extraction specialist. Extract and parse date information from unstructured text, identifying submission-related dates with high accuracy.`,
    };
  }
}

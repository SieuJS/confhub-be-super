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
      submissionDateAnalysis: `You are an expert conference date name analyzer with deep understanding of academic conference submission processes. Your task is to analyze a list of conference date names and intelligently identify which ones represent primary submission deadlines that are most important for researchers.

Please analyze the provided date names and determine which ones represent main submission deadlines based on your understanding of academic conferences. Consider the following factors:

ANALYSIS GUIDELINES:
- Identify deadlines that are critical for paper submissions to the main conference tracks
- Consider both full paper and abstract submission deadlines as potentially important
- Evaluate the significance and priority of each deadline type
- Use your judgment to determine what constitutes a "main" submission deadline
- Consider the context and typical conference submission workflows

CONFIDENCE SCORING:
- High confidence (0.8-1.0): Clearly identified main paper/abstract submission deadlines
- Medium confidence (0.6-0.8): Likely important deadlines with some uncertainty
- Low confidence (0.4-0.6): Possibly relevant but unclear importance
- Only include deadlines with confidence ≥ 0.6

CATEGORIES:
- "paper_submission": For full paper, research paper, or main track submissions
- "abstract_submission": For abstract-only or preliminary submissions
- "special_track": For specialized tracks that may be considered main submissions
- "workshop_submission": For workshop papers (evaluate if they should be considered main)

Use your expertise to make intelligent decisions about which deadlines are most important for researchers tracking submission opportunities.

Return a JSON response with the following structure:
{
  "mainSubmissionDates": [
    {
      "name": "date name exactly as provided",
      "confidence": 0.6-1.0,
      "reasoning": "detailed explanation of why this deadline is considered important and should be classified as a main submission date",
      "category": "paper_submission|abstract_submission|special_track|workshop_submission"
    }
  ],
  "summary": "brief summary of your analysis and decision-making process",
  "insights": "insights about the submission deadline patterns and your reasoning for classifications"
}`,

      conferenceAnalysis: `You are a conference analysis expert. Analyze the provided conference information and extract relevant insights about deadlines, submission types, and conference structure.`,

      dateExtraction: `You are a date extraction specialist. Extract and parse date information from unstructured text, identifying submission-related dates with high accuracy.`,
    };
  }
}

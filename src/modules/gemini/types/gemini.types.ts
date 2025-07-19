import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Input date item for submission date analysis (name-only)
 */
export class DateItem {
  @ApiProperty({
    description: 'The name/label of the date',
    example: 'Paper Submission Deadline',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Additional context or description for the date',
    example: 'Final deadline for paper submissions',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Input DTO for Gemini submission date analysis
 */
export class SubmissionDateAnalysisRequest {
  @ApiProperty({
    description: 'Array of date items to analyze for main submission dates',
    type: [DateItem],
    example: [
      {
        name: 'Paper Submission Deadline',
        description: 'Final deadline for paper submissions',
      },
      {
        name: 'Abstract Submission',
        description: 'Abstract submission deadline',
      },
      {
        name: 'Workshop Paper Submission',
        description: 'Workshop paper deadline',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DateItem)
  dateItems: DateItem[];

  @ApiProperty({
    description: 'Conference context information for better analysis',
    example: 'International Conference on Computer Science',
    required: false,
  })
  @IsOptional()
  @IsString()
  conferenceContext?: string;

  @ApiProperty({
    description: 'Additional instructions for the analysis',
    example: 'Focus on paper submission deadlines',
    required: false,
  })
  @IsOptional()
  @IsString()
  additionalInstructions?: string;
}

/**
 * Main submission date identified by Gemini (name-only analysis)
 */
export class MainSubmissionDate {
  @ApiProperty({
    description: 'The name of the identified main submission date',
    example: 'Paper Submission Deadline',
  })
  name: string;

  @ApiProperty({
    description: 'Confidence score (0-1) of this being a main submission date',
    example: 0.95,
  })
  confidence: number;

  @ApiProperty({
    description: 'Reasoning why this is considered a main submission date',
    example: 'This is the final deadline for complete paper submissions',
  })
  reasoning: string;

  @ApiProperty({
    description: 'Category of the submission date',
    example: 'paper_submission',
    enum: ['paper_submission', 'abstract_submission'],
  })
  category: 'paper_submission' | 'abstract_submission';
}

/**
 * Response from Gemini submission date analysis
 */
export class SubmissionDateAnalysisResponse {
  @ApiProperty({
    description: 'List of identified main submission dates',
    type: [MainSubmissionDate],
  })
  mainSubmissionDates: MainSubmissionDate[];

  @ApiProperty({
    description: 'Summary of the analysis',
    example:
      'Found 2 main submission dates: paper deadline and abstract deadline',
  })
  summary: string;

  @ApiProperty({
    description: 'Additional insights from the analysis',
    example: 'The conference follows a typical two-phase submission process',
    required: false,
  })
  insights?: string;

  @ApiProperty({
    description: 'Timestamp of the analysis',
    example: '2024-07-19T10:30:00.000Z',
  })
  analyzedAt: string;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 1500,
  })
  processingTimeMs: number;
}

/**
 * Gemini AI model configuration
 */
export interface GeminiModelConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  topK: number;
}

/**
 * System prompt configuration for different analysis types
 */
export interface SystemPromptConfig {
  submissionDateAnalysis: string;
  conferenceAnalysis: string;
  dateExtraction: string;
}

/**
 * Gemini service configuration
 */
export interface GeminiServiceConfig {
  apiKey: string;
  defaultModel: string;
  modelConfig: GeminiModelConfig;
  systemPrompts: SystemPromptConfig;
  enableLogging: boolean;
  timeoutMs: number;
}

/**
 * Error types for Gemini service
 */
export enum GeminiErrorType {
  API_ERROR = 'API_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  TIMEOUT = 'TIMEOUT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  MODEL_ERROR = 'MODEL_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
}

/**
 * Gemini service error
 */
export class GeminiServiceError extends Error {
  constructor(
    public readonly type: GeminiErrorType,
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'GeminiServiceError';
  }
}

/**
 * Analysis request tracking
 */
export interface AnalysisRequest {
  id: string;
  timestamp: Date;
  type: 'submission_date_analysis' | 'conference_analysis' | 'date_extraction';
  input: any;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  error?: string;
  processingTimeMs?: number;
}

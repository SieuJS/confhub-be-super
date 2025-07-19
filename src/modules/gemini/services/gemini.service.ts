import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
  SubmissionDateAnalysisRequest,
  SubmissionDateAnalysisResponse,
  MainSubmissionDate,
  GeminiServiceError,
  GeminiErrorType,
  AnalysisRequest,
} from '../types/gemini.types';
import { GeminiConfigService } from '../config/gemini-config.service';
import { v4 as uuidv4 } from 'uuid';

// Strong type definitions for Gemini API responses (name-only analysis)
interface ValidatedSubmissionDate {
  name: string;
  confidence: number;
  reasoning: string;
  category: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private readonly requests: Map<string, AnalysisRequest> = new Map();

  constructor(private readonly configService: GeminiConfigService) {
    this.initializeGemini();
  }

  /**
   * Type guard to check if an unknown value is a string
   */
  private isString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
  }

  /**
   * Type guard to check if an unknown value is a valid number between 0 and 1
   */
  private isValidConfidence(value: unknown): value is number {
    return typeof value === 'number' && value >= 0 && value <= 1;
  }

  /**
   * Type guard to check if an unknown value is a valid submission category
   */
  private isValidCategory(
    value: unknown,
  ): value is MainSubmissionDate['category'] {
    const validCategories = [
      'paper_submission',
      'abstract_submission',
      'special_track',
      'workshop_submission',
    ];
    return (
      typeof value === 'string' &&
      validCategories.includes(value as MainSubmissionDate['category'])
    );
  }

  /**
   * Type guard to validate a submission date object
   */
  private isValidSubmissionDateObject(
    obj: unknown,
  ): obj is ValidatedSubmissionDate {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    const candidate = obj as Record<string, unknown>;

    return (
      this.isString(candidate.name) &&
      this.isValidConfidence(candidate.confidence) &&
      this.isString(candidate.reasoning) &&
      this.isValidCategory(candidate.category)
    );
  }

  /**
   * Type guard to check if error has message property
   */
  private isErrorWithMessage(error: unknown): error is { message: string } {
    return (
      error !== null &&
      error !== undefined &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    );
  }

  /**
   * Safe error message extraction
   */
  private getErrorMessage(error: unknown): string {
    if (this.isErrorWithMessage(error)) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  private initializeGemini(): void {
    try {
      const config = this.configService.getGeminiConfig();

      if (!config.apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      this.genAI = new GoogleGenerativeAI(config.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: config.defaultModel,
        generationConfig: {
          temperature: config.modelConfig.temperature,
          topP: config.modelConfig.topP,
          topK: config.modelConfig.topK,
          maxOutputTokens: config.modelConfig.maxOutputTokens,
        },
      });

      this.logger.log('Gemini AI service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Gemini AI service', error);
      throw new GeminiServiceError(
        GeminiErrorType.API_ERROR,
        'Failed to initialize Gemini AI service',
        error as Error,
      );
    }
  }

  /**
   * Analyze submission dates to identify main submission deadlines
   */
  async analyzeSubmissionDates(
    request: SubmissionDateAnalysisRequest,
  ): Promise<SubmissionDateAnalysisResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();

    // Track the request
    const analysisRequest: AnalysisRequest = {
      id: requestId,
      timestamp: new Date(),
      type: 'submission_date_analysis',
      input: request,
      status: 'pending',
    };
    this.requests.set(requestId, analysisRequest);

    try {
      this.logger.log(
        `Starting submission date analysis for request ${requestId}`,
      );

      // Validate input
      if (!request.dateItems || request.dateItems.length === 0) {
        throw new GeminiServiceError(
          GeminiErrorType.INVALID_INPUT,
          'No date items provided for analysis',
        );
      }

      // Prepare the prompt
      const prompt = this.buildSubmissionDateAnalysisPrompt(request);

      // Log the prompt being sent (truncated for readability)
      const promptPreview =
        prompt.length > 1000 ? prompt.substring(0, 1000) + '...' : prompt;
      this.logger.log(
        `Sending prompt to Gemini (${prompt.length} characters): ${promptPreview}`,
      );

      // Call Gemini API
      const result = await this.callGeminiWithTimeout(prompt);

      // Parse and validate response
      const response = this.parseSubmissionDateResponse(result, startTime);

      // Update request status
      analysisRequest.status = 'completed';
      analysisRequest.result = response;
      analysisRequest.processingTimeMs = Date.now() - startTime;

      this.logger.log(
        `Completed submission date analysis for request ${requestId} in ${Date.now() - startTime}ms`,
      );

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Update request status
      analysisRequest.status = 'failed';
      analysisRequest.error = this.getErrorMessage(error);
      analysisRequest.processingTimeMs = processingTime;

      this.logger.error(
        `Failed submission date analysis for request ${requestId} after ${processingTime}ms`,
        error,
      );

      if (error instanceof GeminiServiceError) {
        throw error;
      }

      throw new GeminiServiceError(
        GeminiErrorType.API_ERROR,
        'Failed to analyze submission dates',
        error as Error,
      );
    }
  }

  /**
   * Build the prompt for submission date analysis
   */
  private buildSubmissionDateAnalysisPrompt(
    request: SubmissionDateAnalysisRequest,
  ): string {
    const config = this.configService.getGeminiConfig();
    const systemPrompt = config.systemPrompts.submissionDateAnalysis;

    const dateItemsText = request.dateItems
      .map(
        (item, index) =>
          `${index + 1}. Name: "${item.name}"${
            item.description ? `, Description: ${item.description}` : ''
          }`,
      )
      .join('\n');

    const contextText = request.conferenceContext
      ? `\n\nConference Context: ${request.conferenceContext}`
      : '';

    const instructionsText = request.additionalInstructions
      ? `\n\nAdditional Instructions: ${request.additionalInstructions}`
      : '';

    return `${systemPrompt}

Date Items to Analyze:
${dateItemsText}${contextText}${instructionsText}

Please analyze these dates and return a JSON response following the specified structure.`;
  }

  /**
   * Call Gemini with timeout handling
   */
  private async callGeminiWithTimeout(prompt: string): Promise<string> {
    const config = this.configService.getGeminiConfig();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new GeminiServiceError(
            GeminiErrorType.TIMEOUT,
            'Gemini API call timed out',
          ),
        );
      }, config.timeoutMs);
    });

    const apiPromise = this.model.generateContent(prompt);

    try {
      const result = await Promise.race([apiPromise, timeoutPromise]);
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new GeminiServiceError(
          GeminiErrorType.API_ERROR,
          'Empty response from Gemini API',
        );
      }

      return text;
    } catch (error) {
      if (error instanceof GeminiServiceError) {
        throw error;
      }

      // Handle specific Gemini API errors
      const errorMessage = this.getErrorMessage(error);
      if (errorMessage.includes('quota')) {
        throw new GeminiServiceError(
          GeminiErrorType.QUOTA_EXCEEDED,
          'API quota exceeded',
        );
      }

      if (errorMessage.includes('model')) {
        throw new GeminiServiceError(
          GeminiErrorType.MODEL_ERROR,
          'Model error occurred',
        );
      }

      throw new GeminiServiceError(
        GeminiErrorType.API_ERROR,
        'Gemini API call failed',
        error instanceof Error ? error : new Error(errorMessage),
      );
    }
  }

  /**
   * Parse and validate the submission date response from Gemini
   */
  private parseSubmissionDateResponse(
    rawResponse: string,
    startTime: number,
  ): SubmissionDateAnalysisResponse {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch =
        rawResponse.match(/```json\n([\s\S]*?)\n```/) ||
        rawResponse.match(/```\n([\s\S]*?)\n```/) ||
        rawResponse.match(/\{[\s\S]*\}/);

      let jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : rawResponse;

      // Attempt to fix truncated JSON by closing incomplete structures
      if (jsonText && !jsonText.trim().endsWith('}')) {
        jsonText = this.attemptJsonFix(jsonText);
      }

      const parsed: unknown = JSON.parse(jsonText);

      // Type guard for parsed response
      if (!this.isValidParsedResponse(parsed)) {
        throw new Error(
          'Invalid response format: mainSubmissionDates is required and must be an array',
        );
      }

      // Validate each main submission date
      const mainSubmissionDates: MainSubmissionDate[] =
        parsed.mainSubmissionDates.map((date: unknown, index: number) => {
          if (!this.isValidSubmissionDateObject(date)) {
            throw new Error(
              `Invalid submission date at index ${index}: missing or invalid required fields`,
            );
          }

          return {
            name: date.name,
            confidence: date.confidence,
            reasoning: date.reasoning,
            category: date.category as MainSubmissionDate['category'],
          };
        });

      const response: SubmissionDateAnalysisResponse = {
        mainSubmissionDates,
        summary: this.isString(parsed.summary)
          ? parsed.summary
          : 'Analysis completed',
        insights: this.isString(parsed.insights) ? parsed.insights : undefined,
        analyzedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
      };

      return response;
    } catch (error) {
      this.logger.error('Failed to parse Gemini response', {
        rawResponse: rawResponse.substring(0, 1000) + '...', // Truncate for logging
        error: this.getErrorMessage(error),
      });
      throw new GeminiServiceError(
        GeminiErrorType.PARSING_ERROR,
        'Failed to parse Gemini response',
        error instanceof Error ? error : new Error(this.getErrorMessage(error)),
      );
    }
  }

  /**
   * Type guard for validating parsed Gemini response
   */
  private isValidParsedResponse(parsed: unknown): parsed is {
    mainSubmissionDates: unknown[];
    summary?: unknown;
    insights?: unknown;
  } {
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    const candidate = parsed as Record<string, unknown>;
    return (
      'mainSubmissionDates' in candidate &&
      Array.isArray(candidate.mainSubmissionDates)
    );
  }

  /**
   * Get analysis request by ID
   */
  getAnalysisRequest(requestId: string): AnalysisRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * Get all analysis requests (for debugging/monitoring)
   */
  getAllAnalysisRequests(): AnalysisRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Clear old analysis requests (cleanup)
   */
  clearOldRequests(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - olderThanMs;
    let cleared = 0;

    for (const [id, request] of this.requests.entries()) {
      if (request.timestamp.getTime() < cutoffTime) {
        this.requests.delete(id);
        cleared++;
      }
    }

    this.logger.log(`Cleared ${cleared} old analysis requests`);
    return cleared;
  }

  /**
   * Health check for the Gemini service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      const testPrompt =
        'Return the text "Service is healthy" in JSON format: {"status": "healthy"}';
      const result = await this.callGeminiWithTimeout(testPrompt);

      return {
        status: 'healthy',
        details: {
          model: this.model.model,
          lastCheck: new Date().toISOString(),
          response: result.substring(0, 100), // First 100 chars
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: this.getErrorMessage(error),
          lastCheck: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Attempt to fix truncated JSON by closing incomplete structures
   */
  private attemptJsonFix(jsonText: string): string {
    try {
      // First, try to parse as-is
      JSON.parse(jsonText);
      return jsonText;
    } catch (error) {
      // If parsing fails, try to fix common truncation issues
      let fixed = jsonText.trim();

      // If it ends with incomplete property value, try to close it
      if (fixed.endsWith('"paper')) {
        fixed += '_submission"';
      } else if (fixed.endsWith('"abstract')) {
        fixed += '_submission"';
      } else if (fixed.endsWith('"special')) {
        fixed += '_track"';
      } else if (fixed.endsWith('"workshop')) {
        fixed += '_submission"';
      }

      // Count open and close braces/brackets to balance them
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;

      // Add missing closing brackets for arrays
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixed += ']';
      }

      // Add missing closing braces for objects
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixed += '}';
      }

      // Try to parse the fixed version
      try {
        JSON.parse(fixed);
        return fixed;
      } catch {
        // If still can't parse, return the original
        throw error;
      }
    }
  }
}

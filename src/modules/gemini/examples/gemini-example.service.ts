import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../services/gemini.service';
import {
  SubmissionDateAnalysisRequest,
  DateItem,
  MainSubmissionDate,
} from '../types/gemini.types';

/**
 * Example service showing how to use the Gemini service
 * for submission date analysis in a real-world scenario
 */
@Injectable()
export class GeminiExampleService {
  private readonly logger = new Logger(GeminiExampleService.name);

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Example: Analyze conference dates scraped from a website
   */
  async analyzeConferenceDates(conferenceData: {
    name: string;
    dates: Array<{ name: string; date?: string; description?: string }>;
  }): Promise<MainSubmissionDate[]> {
    try {
      const request: SubmissionDateAnalysisRequest = {
        dateItems: conferenceData.dates.map(
          (date): DateItem => ({
            name: date.name,
            description: date.description,
          }),
        ),
        conferenceContext: `Conference: ${conferenceData.name}`,
        additionalInstructions:
          'Focus on paper submission deadlines and abstract deadlines',
      };

      const result = await this.geminiService.analyzeSubmissionDates(request);

      this.logger.log(
        `Analyzed ${conferenceData.dates.length} dates for ${conferenceData.name}, found ${result.mainSubmissionDates.length} main submission dates`,
      );

      return result.mainSubmissionDates;
    } catch (error) {
      this.logger.error(
        `Failed to analyze dates for ${conferenceData.name}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Example: Process multiple conferences in batch
   */
  async batchAnalyzeConferences(
    conferences: Array<{
      id: string;
      name: string;
      dates: Array<{ name: string; date?: string; description?: string }>;
    }>,
  ): Promise<
    Array<{
      conferenceId: string;
      conferenceName: string;
      mainSubmissionDates: MainSubmissionDate[];
      processingTimeMs: number;
    }>
  > {
    const results: Array<{
      conferenceId: string;
      conferenceName: string;
      mainSubmissionDates: MainSubmissionDate[];
      processingTimeMs: number;
    }> = [];

    for (const conference of conferences) {
      const startTime = Date.now();
      try {
        const mainSubmissionDates =
          await this.analyzeConferenceDates(conference);

        results.push({
          conferenceId: conference.id,
          conferenceName: conference.name,
          mainSubmissionDates,
          processingTimeMs: Date.now() - startTime,
        });

        // Add delay between requests to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        this.logger.error(
          `Failed to process conference ${conference.name}`,
          error,
        );
        results.push({
          conferenceId: conference.id,
          conferenceName: conference.name,
          mainSubmissionDates: [],
          processingTimeMs: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Example: Filter high-confidence submission dates
   */
  filterHighConfidenceDates(
    submissionDates: MainSubmissionDate[],
    minimumConfidence: number = 0.8,
  ): MainSubmissionDate[] {
    return submissionDates.filter(
      (date) => date.confidence >= minimumConfidence,
    );
  }

  /**
   * Example: Group submission dates by category
   */
  groupSubmissionDatesByCategory(submissionDates: MainSubmissionDate[]): {
    [category: string]: MainSubmissionDate[];
  } {
    return submissionDates.reduce(
      (groups, date) => {
        const category = date.category;
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(date);
        return groups;
      },
      {} as { [category: string]: MainSubmissionDate[] },
    );
  }

  /**
   * Example: Get the most important submission date
   */
  getMostImportantSubmissionDate(
    submissionDates: MainSubmissionDate[],
  ): MainSubmissionDate | null {
    if (submissionDates.length === 0) {
      return null;
    }

    // Prioritize by category, then by confidence
    const categoryPriority = {
      paper_submission: 5,
      abstract_submission: 4,
      poster_submission: 3,
      workshop_submission: 2,
      other: 1,
    };

    return submissionDates.reduce((best, current) => {
      const bestPriority = categoryPriority[best.category] * best.confidence;
      const currentPriority =
        categoryPriority[current.category] * current.confidence;

      return currentPriority > bestPriority ? current : best;
    });
  }

  /**
   * Example usage with real conference data
   */
  async demonstrateUsage(): Promise<void> {
    // Example conference data (as might be scraped from a conference website)
    const sampleConferenceData = {
      name: 'International Conference on Machine Learning (ICML) 2024',
      dates: [
        {
          name: 'Abstract Submission Deadline',
          date: '2024-01-18T23:59:59.000Z',
          description: 'Deadline for submitting paper abstracts',
        },
        {
          name: 'Paper Submission Deadline',
          date: '2024-01-25T23:59:59.000Z',
          description: 'Final deadline for full paper submissions',
        },
        {
          name: 'Notification of Acceptance',
          date: '2024-05-01T23:59:59.000Z',
          description: 'Authors will be notified of paper acceptance',
        },
        {
          name: 'Camera-Ready Deadline',
          date: '2024-05-30T23:59:59.000Z',
          description: 'Deadline for submitting camera-ready papers',
        },
        {
          name: 'Conference Dates',
          date: '2024-07-21T00:00:00.000Z',
          description: 'Conference starts on this date',
        },
        {
          name: 'Early Registration Deadline',
          date: '2024-06-15T23:59:59.000Z',
          description: 'Deadline for early bird registration',
        },
        {
          name: 'Workshop Paper Deadline',
          date: '2024-04-15T23:59:59.000Z',
          description: 'Deadline for workshop paper submissions',
        },
      ],
    };

    try {
      this.logger.log(
        'Starting demonstration of Gemini submission date analysis...',
      );

      // Analyze the conference dates
      const mainSubmissionDates =
        await this.analyzeConferenceDates(sampleConferenceData);

      this.logger.log(
        `Found ${mainSubmissionDates.length} main submission dates:`,
      );
      mainSubmissionDates.forEach((date, index) => {
        this.logger.log(
          `${index + 1}. ${date.name} (${date.category}) - Confidence: ${(date.confidence * 100).toFixed(1)}%`,
        );
        this.logger.log(`   Reasoning: ${date.reasoning}`);
      });

      // Filter high-confidence dates
      const highConfidenceDates = this.filterHighConfidenceDates(
        mainSubmissionDates,
        0.8,
      );
      this.logger.log(
        `High-confidence dates (>=80%): ${highConfidenceDates.length}`,
      );

      // Group by category
      const groupedDates =
        this.groupSubmissionDatesByCategory(mainSubmissionDates);
      this.logger.log('Dates grouped by category:', groupedDates);

      // Get most important date
      const mostImportant =
        this.getMostImportantSubmissionDate(mainSubmissionDates);
      if (mostImportant) {
        this.logger.log(
          `Most important submission date: ${mostImportant.name}`,
        );
      }

      this.logger.log('Demonstration completed successfully!');
    } catch (error) {
      this.logger.error('Demonstration failed:', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

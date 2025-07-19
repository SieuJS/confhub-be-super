import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConferenceOrganizationSerivce } from './conference-organization.service';
import { GeminiService } from '../../gemini/services/gemini.service';
import { SubmissionDateAnalysisRequest } from '../../gemini/types/gemini.types';

@Injectable()
export class MainSubmissionDateInitializerService implements OnModuleInit {
  private readonly logger = new Logger(
    MainSubmissionDateInitializerService.name,
  );
  private initializationInProgress = false;

  constructor(
    private readonly conferenceOrganizationService: ConferenceOrganizationSerivce,
    private readonly geminiService: GeminiService,
  ) {}

  async onModuleInit() {
    // Initialize main submission dates on application startup
    await this.initializeMainSubmissionDates();
  }

  /**
   * Initialize main submission dates by analyzing existing submission date names with Gemini
   * Always runs on startup to ensure classifications are up-to-date with current filtering rules
   */
  async initializeMainSubmissionDates(): Promise<void> {
    if (this.initializationInProgress) {
      this.logger.warn(
        'Main submission date initialization already in progress, skipping...',
      );
      return;
    }

    this.initializationInProgress = true;

    try {
      this.logger.log('Starting main submission date initialization...');

      // Always re-analyze to ensure classifications are current with enhanced filtering
      const existingMainDates =
        await this.conferenceOrganizationService.getMainSubmissionDateNames();
      this.logger.log(
        `Found ${existingMainDates.length} existing main submission date classifications - will update based on current analysis`,
      );

      // Get all submission date names
      const submissionDateNames =
        await this.conferenceOrganizationService.getDatenameByType(
          'submissionDate',
        );

      if (!submissionDateNames || submissionDateNames.length === 0) {
        this.logger.warn(
          'No submission date names found, skipping main submission date initialization',
        );
        return;
      }

      this.logger.log(
        `Found ${submissionDateNames.length} submission date names to analyze`,
      );

      // Limit the number of items to analyze (same as in conference service)
      const limitedDateNames = submissionDateNames.slice(0, 100);

      this.logger.log(
        `Processing ${limitedDateNames.length} submission date names (limited from ${submissionDateNames.length})`,
      );

      // Prepare data for Gemini analysis
      const dateItems = limitedDateNames.map((name) => ({
        name,
        description: `Conference submission deadline: ${name}`,
      }));

      // Analyze with Gemini
      const geminiRequest: SubmissionDateAnalysisRequest = {
        dateItems,
        conferenceContext:
          'Academic conference submission deadlines - initialization analysis',
        additionalInstructions:
          'Identify main paper submission deadlines that should be classified as primary submission dates.',
      };

      this.logger.log('Sending request to Gemini for analysis...');
      const geminiResponse =
        await this.geminiService.analyzeSubmissionDates(geminiRequest);

      this.logger.log(
        `Gemini analysis completed. Summary: ${geminiResponse.summary}`,
      );
      if (geminiResponse.insights) {
        this.logger.log(`Insights: ${geminiResponse.insights}`);
      }

      // Extract main submission date names (high confidence only)
      const mainSubmissionDateNames = geminiResponse.mainSubmissionDates
        .filter((date) => date.confidence >= 0.7)
        .map((date) => date.name);

      this.logger.log(
        `Gemini identified ${mainSubmissionDateNames.length} main submission date types from ${limitedDateNames.length} analyzed`,
      );

      // Clear existing classifications before creating new ones
      await this.clearExistingMainSubmissionDateClassifications();

      if (mainSubmissionDateNames.length > 0) {
        // Create entries with type 'mainSubmissionDate'
        await this.createMainSubmissionDateClassifications(
          mainSubmissionDateNames,
        );

        this.logger.log(
          `Successfully updated ${mainSubmissionDateNames.length} main submission date classifications`,
        );
      } else {
        this.logger.log(
          'No main submission dates identified by Gemini - classifications cleared',
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize main submission dates', error);
      // Don't throw error to prevent application startup failure
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * Clear existing main submission date classifications
   */
  private async clearExistingMainSubmissionDateClassifications(): Promise<void> {
    const classificationOrganizedId = 'classification-main-submission-dates';
    
    const deleted = await this.conferenceOrganizationService[
      'prismaService'
    ].conferenceDates.deleteMany({
      where: {
        type: 'mainSubmissionDate',
        organizedId: classificationOrganizedId,
      },
    });

    this.logger.log(
      `Cleared ${deleted.count} existing main submission date classifications`,
    );
  }

  /**
   * Create main submission date classifications
   */
  private async createMainSubmissionDateClassifications(
    names: string[],
  ): Promise<void> {
    // For classification purposes, we'll create these entries with a special organizedId
    const classificationOrganizedId = 'classification-main-submission-dates';

    // Create or find a dummy organization for classifications
    await this.createClassificationOrganization(classificationOrganizedId);

    // Create the main submission date entries
    await this.conferenceOrganizationService.createMainSubmissionDateEntries(
      names,
      classificationOrganizedId,
    );
  }

  /**
   * Create a dummy organization for classification purposes
   */
  private async createClassificationOrganization(
    organizedId: string,
  ): Promise<void> {
    // Check if it already exists
    const existing = await this.conferenceOrganizationService[
      'prismaService'
    ].conferenceOrganizations.findUnique({
      where: { id: organizedId },
    });

    if (!existing) {
      // Create a dummy conference first
      const dummyConferenceId = 'classification-conference';
      const existingConference = await this.conferenceOrganizationService[
        'prismaService'
      ].conferences.findUnique({
        where: { id: dummyConferenceId },
      });

      if (!existingConference) {
        await this.conferenceOrganizationService[
          'prismaService'
        ].conferences.create({
          data: {
            id: dummyConferenceId,
            title: 'Classification Data',
            acronym: 'CLASSIFICATION',
            status: 'draft',
          },
        });
      }

      // Create the classification organization
      await this.conferenceOrganizationService[
        'prismaService'
      ].conferenceOrganizations.create({
        data: {
          id: organizedId,
          conferenceId: dummyConferenceId,
          accessType: 'classification',
          isAvailable: true,
          publisher: 'System',
          summerize: 'Classification data for main submission dates',
          callForPaper: '',
          link: '',
          cfpLink: '',
          impLink: '',
        },
      });
    }
  }

  /**
   * Manual trigger for re-initialization (for admin purposes)
   */
  async reinitializeMainSubmissionDates(): Promise<void> {
    this.logger.log(
      'Manual re-initialization of main submission dates triggered',
    );

    // The main initialization method already handles clearing and recreating
    await this.initializeMainSubmissionDates();
  }
}

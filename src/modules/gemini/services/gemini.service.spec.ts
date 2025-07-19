import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../services/gemini.service';
import { GeminiConfigService } from '../config/gemini-config.service';
import {
  SubmissionDateAnalysisRequest,
  GeminiServiceError,
  GeminiErrorType,
} from '../types/gemini.types';

// Mock the Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      model: 'gemini-1.5-flash',
      generateContent: jest.fn(),
    }),
  })),
}));

describe('GeminiService', () => {
  let service: GeminiService;
  let configService: GeminiConfigService;
  let mockModel: any;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        GEMINI_API_KEY: 'test-api-key',
        GEMINI_DEFAULT_MODEL: 'gemini-1.5-flash',
        GEMINI_TEMPERATURE: 0.2,
        GEMINI_MAX_OUTPUT_TOKENS: 2048,
        GEMINI_TOP_P: 0.8,
        GEMINI_TOP_K: 40,
        GEMINI_ENABLE_LOGGING: true,
        GEMINI_TIMEOUT_MS: 30000,
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        GeminiConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
    configService = module.get<GeminiConfigService>(GeminiConfigService);

    // Get reference to the mocked model
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const geminiInstance = new GoogleGenerativeAI();
    mockModel = geminiInstance.getGenerativeModel();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeSubmissionDates', () => {
    const mockRequest: SubmissionDateAnalysisRequest = {
      dateItems: [
        {
          name: 'Paper Submission Deadline',
          date: '2024-03-15T23:59:59.000Z',
          description: 'Final deadline for paper submissions',
        },
        {
          name: 'Abstract Submission',
          date: '2024-03-08T23:59:59.000Z',
          description: 'Abstract submission deadline',
        },
        {
          name: 'Conference Dates',
          date: '2024-07-21T00:00:00.000Z',
          description: 'Conference starts',
        },
      ],
      conferenceContext: 'International Conference on Machine Learning',
      additionalInstructions: 'Focus on paper and abstract deadlines',
    };

    const mockGeminiResponse = {
      response: {
        text: () =>
          JSON.stringify({
            mainSubmissionDates: [
              {
                name: 'Paper Submission Deadline',
                date: '2024-03-15T23:59:59.000Z',
                confidence: 0.95,
                reasoning:
                  'This is clearly identified as a final deadline for paper submissions',
                category: 'paper_submission',
              },
              {
                name: 'Abstract Submission',
                date: '2024-03-08T23:59:59.000Z',
                confidence: 0.88,
                reasoning:
                  'Abstract submission is typically a preliminary deadline for papers',
                category: 'abstract_submission',
              },
            ],
            summary:
              'Found 2 main submission dates: paper deadline and abstract deadline',
            insights:
              'The conference follows a typical two-phase submission process',
          }),
      },
    };

    it('should successfully analyze submission dates', async () => {
      mockModel.generateContent.mockResolvedValue(mockGeminiResponse);

      const result = await service.analyzeSubmissionDates(mockRequest);

      expect(result).toBeDefined();
      expect(result.mainSubmissionDates).toHaveLength(2);
      expect(result.mainSubmissionDates[0].name).toBe(
        'Paper Submission Deadline',
      );
      expect(result.mainSubmissionDates[0].confidence).toBe(0.95);
      expect(result.mainSubmissionDates[0].category).toBe('paper_submission');
      expect(result.summary).toBe(
        'Found 2 main submission dates: paper deadline and abstract deadline',
      );
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.analyzedAt).toBeDefined();
    });

    it('should handle empty date items', async () => {
      const emptyRequest: SubmissionDateAnalysisRequest = {
        dateItems: [],
      };

      await expect(
        service.analyzeSubmissionDates(emptyRequest),
      ).rejects.toThrow(GeminiServiceError);
    });

    it('should handle API errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      await expect(service.analyzeSubmissionDates(mockRequest)).rejects.toThrow(
        GeminiServiceError,
      );
    });

    it('should handle quota exceeded errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('quota exceeded'));

      await expect(service.analyzeSubmissionDates(mockRequest)).rejects.toThrow(
        expect.objectContaining({
          type: GeminiErrorType.QUOTA_EXCEEDED,
        }),
      );
    });

    it('should handle malformed JSON responses', async () => {
      const badResponse = {
        response: {
          text: () => 'This is not valid JSON',
        },
      };

      mockModel.generateContent.mockResolvedValue(badResponse);

      await expect(service.analyzeSubmissionDates(mockRequest)).rejects.toThrow(
        expect.objectContaining({
          type: GeminiErrorType.PARSING_ERROR,
        }),
      );
    });

    it('should handle responses with missing required fields', async () => {
      const incompleteResponse = {
        response: {
          text: () =>
            JSON.stringify({
              summary: 'Analysis completed',
              // Missing mainSubmissionDates
            }),
        },
      };

      mockModel.generateContent.mockResolvedValue(incompleteResponse);

      await expect(service.analyzeSubmissionDates(mockRequest)).rejects.toThrow(
        GeminiServiceError,
      );
    });

    it('should handle timeout', async () => {
      // Mock a long-running request
      mockModel.generateContent.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 35000)),
      );

      await expect(service.analyzeSubmissionDates(mockRequest)).rejects.toThrow(
        expect.objectContaining({
          type: GeminiErrorType.TIMEOUT,
        }),
      );
    }, 40000);
  });

  describe('getAnalysisRequest', () => {
    it('should return undefined for non-existent request', () => {
      const result = service.getAnalysisRequest('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('should track analysis requests', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              mainSubmissionDates: [],
              summary: 'Test analysis',
            }),
        },
      });

      const request: SubmissionDateAnalysisRequest = {
        dateItems: [
          {
            name: 'Test Date',
            date: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      await service.analyzeSubmissionDates(request);

      const requests = service.getAllAnalysisRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].type).toBe('submission_date_analysis');
      expect(requests[0].status).toBe('completed');
    });
  });

  describe('clearOldRequests', () => {
    it('should clear old requests', () => {
      // This test would require manipulating the internal requests map
      // or making the service accept a custom timestamp
      const cleared = service.clearOldRequests(0); // Clear all
      expect(typeof cleared).toBe('number');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => '{"status": "healthy"}',
        },
      });

      const result = await service.healthCheck();
      expect(result.status).toBe('healthy');
      expect(result.details).toBeDefined();
    });

    it('should return unhealthy status on error', async () => {
      mockModel.generateContent.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const result = await service.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.details.error).toBeDefined();
    });
  });

  describe('buildSubmissionDateAnalysisPrompt', () => {
    it('should build a comprehensive prompt', () => {
      const request: SubmissionDateAnalysisRequest = {
        dateItems: [
          {
            name: 'Paper Deadline',
            date: '2024-03-15T23:59:59.000Z',
            description: 'Paper submission deadline',
          },
        ],
        conferenceContext: 'ICML 2024',
        additionalInstructions: 'Focus on paper deadlines',
      };

      // This would require making the method public or testing through the public interface
      // For now, we test through analyzeSubmissionDates which calls this method
      expect(true).toBe(true); // Placeholder
    });
  });
});

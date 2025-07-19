# Gemini AI Module

A comprehensive NestJS module for integrating Google's Gemini AI to analyze conference submission dates and identify main deadlines.

## Features

- **Submission Date Analysis**: Identify main submission dates from a list of conference dates
- **Type-Safe Implementation**: Full TypeScript support with comprehensive type definitions
- **Structured Responses**: Well-defined DTOs and response structures
- **Error Handling**: Robust error handling with custom error types
- **Request Tracking**: Track analysis requests for monitoring and debugging
- **Health Checks**: Built-in health check endpoints
- **Configuration**: Flexible configuration through environment variables
- **Examples**: Comprehensive examples showing real-world usage

## Installation

The module uses `@google/generative-ai` package which is already installed in the project.

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional - with defaults
GEMINI_DEFAULT_MODEL=gemini-1.5-flash
GEMINI_TEMPERATURE=0.2
GEMINI_MAX_OUTPUT_TOKENS=2048
GEMINI_TOP_P=0.8
GEMINI_TOP_K=40
GEMINI_ENABLE_LOGGING=true
GEMINI_TIMEOUT_MS=30000
```

## Usage

### 1. Import the Module

```typescript
import { Module } from '@nestjs/common';
import { GeminiModule } from './modules/gemini';

@Module({
  imports: [GeminiModule],
})
export class AppModule {}
```

### 2. Basic Usage in a Service

```typescript
import { Injectable } from '@nestjs/common';
import { GeminiService, SubmissionDateAnalysisRequest } from './modules/gemini';

@Injectable()
export class ConferenceService {
  constructor(private readonly geminiService: GeminiService) {}

  async analyzeConferenceDates(dateItems: Array<{name: string; date?: string; description?: string}>) {
    const request: SubmissionDateAnalysisRequest = {
      dateItems,
      conferenceContext: 'International AI Conference',
      additionalInstructions: 'Focus on paper submission deadlines'
    };

    const result = await this.geminiService.analyzeSubmissionDates(request);
    return result.mainSubmissionDates;
  }
}
```

### 3. API Endpoints

The module provides the following REST endpoints:

- `POST /gemini/analyze-submission-dates` - Analyze submission dates
- `GET /gemini/analysis/:requestId` - Get analysis request details
- `GET /gemini/analysis` - Get all analysis requests
- `POST /gemini/cleanup` - Cleanup old analysis requests
- `GET /gemini/health` - Health check

### 4. Example Request/Response

**Request:**
```json
{
  "dateItems": [
    {
      "name": "Paper Submission Deadline",
      "date": "2024-03-15T23:59:59.000Z",
      "description": "Final deadline for paper submissions"
    },
    {
      "name": "Abstract Submission",
      "date": "2024-03-08T23:59:59.000Z",
      "description": "Abstract submission deadline"
    },
    {
      "name": "Conference Dates",
      "date": "2024-07-21T00:00:00.000Z",
      "description": "Conference starts"
    }
  ],
  "conferenceContext": "International Conference on Machine Learning",
  "additionalInstructions": "Focus on paper and abstract deadlines"
}
```

**Response:**
```json
{
  "mainSubmissionDates": [
    {
      "name": "Paper Submission Deadline",
      "date": "2024-03-15T23:59:59.000Z",
      "confidence": 0.95,
      "reasoning": "This is clearly identified as a final deadline for paper submissions",
      "category": "paper_submission"
    },
    {
      "name": "Abstract Submission",
      "date": "2024-03-08T23:59:59.000Z", 
      "confidence": 0.88,
      "reasoning": "Abstract submission is typically a preliminary deadline for papers",
      "category": "abstract_submission"
    }
  ],
  "summary": "Found 2 main submission dates: paper deadline and abstract deadline",
  "insights": "The conference follows a typical two-phase submission process",
  "analyzedAt": "2024-07-19T10:30:00.000Z",
  "processingTimeMs": 1500
}
```

## Architecture

### Components

1. **GeminiService** - Main service for AI interactions
2. **GeminiConfigService** - Configuration management
3. **GeminiController** - REST API endpoints
4. **GeminiExampleService** - Usage examples and utilities

### Types

- **DateItem** - Input date item structure
- **SubmissionDateAnalysisRequest** - Request DTO
- **SubmissionDateAnalysisResponse** - Response DTO
- **MainSubmissionDate** - Identified submission date
- **GeminiServiceError** - Custom error types

### Error Handling

The module includes comprehensive error handling:

- `API_ERROR` - Gemini API errors
- `INVALID_INPUT` - Invalid request data
- `TIMEOUT` - Request timeout
- `QUOTA_EXCEEDED` - API quota exceeded
- `MODEL_ERROR` - Model-specific errors
- `PARSING_ERROR` - Response parsing errors

## Advanced Features

### Request Tracking

All analysis requests are tracked with unique IDs:

```typescript
const request = geminiService.getAnalysisRequest(requestId);
console.log(request.status); // 'pending' | 'completed' | 'failed'
```

### Batch Processing

Process multiple conferences:

```typescript
const results = await geminiExampleService.batchAnalyzeConferences(conferences);
```

### Filtering and Grouping

```typescript
// Filter high-confidence dates
const highConfidence = geminiExampleService.filterHighConfidenceDates(dates, 0.8);

// Group by category
const grouped = geminiExampleService.groupSubmissionDatesByCategory(dates);

// Get most important date
const mostImportant = geminiExampleService.getMostImportantSubmissionDate(dates);
```

## System Prompt

The module uses a sophisticated system prompt that:

- Identifies submission-related dates
- Prioritizes final deadlines over preliminary ones
- Considers context and naming patterns
- Provides confidence scores and reasoning
- Categorizes different submission types

## Monitoring

- Request tracking for all analysis operations
- Health check endpoint for service monitoring
- Configurable logging
- Processing time metrics
- Automatic cleanup of old requests

## Best Practices

1. **Rate Limiting**: Add delays between batch requests
2. **Error Handling**: Always handle GeminiServiceError
3. **Validation**: Use the provided DTOs for input validation
4. **Configuration**: Set appropriate timeout and model parameters
5. **Monitoring**: Use health checks and request tracking
6. **Cleanup**: Regularly cleanup old analysis requests

## Testing

The module is designed to be easily testable:

```typescript
// Mock the Gemini service for testing
const mockGeminiService = {
  analyzeSubmissionDates: jest.fn().mockResolvedValue(mockResponse),
};
```

## Contributing

When extending the module:

1. Follow the existing TypeScript patterns
2. Add comprehensive type definitions
3. Include proper error handling
4. Update the documentation
5. Add examples for new features

## License

This module is part of the ConfHub project and follows the same licensing terms.

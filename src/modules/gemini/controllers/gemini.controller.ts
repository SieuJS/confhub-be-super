import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { GeminiService } from '../services/gemini.service';
import {
  SubmissionDateAnalysisRequest,
  SubmissionDateAnalysisResponse,
  AnalysisRequest,
} from '../types/gemini.types';

@ApiTags('Gemini AI')
@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('analyze-submission-dates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analyze submission dates',
    description:
      'Analyze an array of date items to identify which ones are main submission dates using Gemini AI.',
  })
  @ApiBody({
    type: SubmissionDateAnalysisRequest,
    description: 'Request containing date items to analyze',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analysis completed successfully',
    type: SubmissionDateAnalysisResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error or Gemini API error',
  })
  async analyzeSubmissionDates(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    request: SubmissionDateAnalysisRequest,
  ): Promise<SubmissionDateAnalysisResponse> {
    return this.geminiService.analyzeSubmissionDates(request);
  }

  @Get('analysis/:requestId')
  @ApiOperation({
    summary: 'Get analysis request details',
    description: 'Retrieve details of a specific analysis request by ID.',
  })
  @ApiParam({
    name: 'requestId',
    description: 'The ID of the analysis request',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analysis request found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Analysis request not found',
  })
  getAnalysisRequest(@Param('requestId') requestId: string): AnalysisRequest {
    const request = this.geminiService.getAnalysisRequest(requestId);
    if (!request) {
      throw new Error(`Analysis request with ID ${requestId} not found`);
    }
    return request;
  }

  @Get('analysis')
  @ApiOperation({
    summary: 'Get all analysis requests',
    description: 'Retrieve all analysis requests for monitoring purposes.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all analysis requests',
  })
  getAllAnalysisRequests(): AnalysisRequest[] {
    return this.geminiService.getAllAnalysisRequests();
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cleanup old analysis requests',
    description:
      'Remove old analysis requests from memory to free up resources.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cleanup completed',
  })
  cleanupOldRequests(): { cleared: number; message: string } {
    const cleared = this.geminiService.clearOldRequests();
    return {
      cleared,
      message: `Cleared ${cleared} old analysis requests`,
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Check the health status of the Gemini AI service.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is healthy',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Service is unhealthy',
  })
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    return this.geminiService.healthCheck();
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import {
  RecommendRequest,
  RecommendResponse,
} from '../models/recommend.request';

@Injectable()
export class RecommendService {
  async getRecommendations(
    request: RecommendRequest,
  ): Promise<RecommendResponse> {
    const recommendUrl = `${process.env.RECOMMENDATION_SERVER}/predict`;
    const response = await fetch(recommendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recommendations');
    }

    const data = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data;
  }
}

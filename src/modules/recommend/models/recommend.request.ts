export class RecommendRequest {
  user_id: string;
  conference_ids: string[];
}

export class RecommendResponse {
  [key: string]: number;
}

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ReviewRequest {
  files: Array<{
    path: string;
    content: string;
    diff?: string;
  }>;
  pullRequest: {
    title: string;
    description: string;
    base: string;
    head: string;
  };
  context?: {
    repository: string;
    owner: string;
    projectContext?: string;
  };
}

export interface ReviewResponse {
  summary: string;
  lineComments?: Array<{
    path: string;
    line: number;
    comment: string;
  }>;
  suggestedAction: 'approve' | 'request_changes' | 'comment';
  confidence: number;
}

export interface AIProvider {
  initialize(config: AIProviderConfig): Promise<void>;
  review(request: ReviewRequest): Promise<ReviewResponse>;
}

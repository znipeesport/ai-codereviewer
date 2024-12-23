import { AIProvider, AIProviderConfig, ReviewRequest, ReviewResponse } from './AIProvider';

export class GeminiProvider implements AIProvider {
  async initialize(config: AIProviderConfig): Promise<void> {
    throw new Error('Gemini provider is not yet implemented');
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    throw new Error('Gemini provider is not yet implemented');
  }
}

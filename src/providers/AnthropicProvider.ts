import { AIProvider, AIProviderConfig, ReviewRequest, ReviewResponse } from './AIProvider';

export class AnthropicProvider implements AIProvider {
  async initialize(config: AIProviderConfig): Promise<void> {
    throw new Error('Anthropic provider is not yet implemented');
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    throw new Error('Anthropic provider is not yet implemented');
  }
}

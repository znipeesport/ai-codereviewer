import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIProviderConfig, ReviewRequest, ReviewResponse } from './AIProvider';
import * as core from '@actions/core';
import { baseCodeReviewPrompt } from '../prompts';

export class GeminiProvider implements AIProvider {
  private config!: AIProviderConfig;
  private client!: GoogleGenerativeAI;
  private model!: GenerativeModel;

  async initialize(config: AIProviderConfig): Promise<void> {
    this.config = config;
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = this.client.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const prompt = this.buildPrompt(request);
    core.info(`Sending request to Gemini with prompt structure: ${JSON.stringify(request, null, 2)}`);

    const result = await this.model.generateContent({
      systemInstruction: baseCodeReviewPrompt,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            }
          ]
        }
      ]
    });

    const response = result.response;
    core.info(`Raw Gemini response: ${JSON.stringify(response.text(), null, 2)}`);

    return this.parseResponse(response);
  }

  private buildPrompt(request: ReviewRequest): string {
    return JSON.stringify({
      type: 'code_review',
      files: request.files,
      pr: request.pullRequest,
      context: request.context,
    });
  }

  private parseResponse(response: any): ReviewResponse {
    try {
      const content = JSON.parse(response.text());
      return {
        summary: content.summary,
        lineComments: content.comments,
        suggestedAction: content.suggestedAction,
        confidence: content.confidence,
      };
    } catch (error) {
      core.error(`Failed to parse Gemini response: ${error}`);
      return {
        summary: 'Failed to parse AI response',
        lineComments: [],
        suggestedAction: 'COMMENT',
        confidence: 0,
      };
    }
  }
}

import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, ReviewRequest, ReviewResponse } from './AIProvider';
import * as core from '@actions/core';
import { baseCodeReviewPrompt, updateReviewPrompt } from '../prompts';

export class OpenAIProvider implements AIProvider {
  private config!: AIProviderConfig;
  private client!: OpenAI;

  async initialize(config: AIProviderConfig): Promise<void> {
    this.config = config;
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    core.info(`Sending request to OpenAI with prompt structure: ${JSON.stringify(request, null, 2)}`);

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(request),
        },
        {
          role: 'user',
          content: this.buildPullRequestPrompt(request),
        },
      ],
      temperature: this.config.temperature ?? 0.3,
      response_format: { type: 'json_object' },
    });

    core.debug(`Raw OpenAI response: ${JSON.stringify(response.choices[0].message.content, null, 2)}`);

    const parsedResponse = this.parseResponse(response);
    core.info(`Parsed response: ${JSON.stringify(parsedResponse, null, 2)}`);

    return parsedResponse;
  }

  private buildPullRequestPrompt(request: ReviewRequest): string {
    return JSON.stringify({
      type: 'code_review',
      files: request.files,
      pr: request.pullRequest,
      context: request.context,
      previousReviews: request.previousReviews?.map(review => ({
        summary: review.summary,
        lineComments: review.lineComments.map(comment => ({
          path: comment.path,
          line: comment.line,
          comment: comment.comment
        }))
      }))
    });
  }

  private buildSystemPrompt(request: ReviewRequest): string {
    const isUpdate = request.context.isUpdate;
    return `
      ${baseCodeReviewPrompt}
      ${isUpdate ? updateReviewPrompt : ''}
    `;
  }

  private parseResponse(response: OpenAI.Chat.Completions.ChatCompletion): ReviewResponse {
    // Implement response parsing
    const content = JSON.parse(response.choices[0].message.content ?? '{}');
    return {
      summary: content.summary,
      lineComments: content.comments,
      suggestedAction: content.suggestedAction,
      confidence: content.confidence,
    };
  }
}

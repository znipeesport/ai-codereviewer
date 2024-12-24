import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, ReviewRequest, ReviewResponse } from './AIProvider';
import * as core from '@actions/core';

export class OpenAIProvider implements AIProvider {
  private config!: AIProviderConfig;
  private client!: OpenAI;

  async initialize(config: AIProviderConfig): Promise<void> {
    this.config = config;
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const prompt = this.buildPrompt(request);
    core.info(`Sending request to OpenAI with prompt structure: ${JSON.stringify(request, null, 2)}`);

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert code reviewer. Analyze the provided code changes and provide detailed, actionable feedback. Format your response as JSON with the following structure: { "summary": "overall review", "comments": [{"path": "file_path", "line": number, "comment": "comment text"}], "suggestedAction": "approve|request_changes|comment", "confidence": number }. The suggestedAction must be one of these exact values: "approve", "request_changes", or "comment".',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: this.config.temperature ?? 0.3,
      response_format: { type: 'json_object' },
    });

    core.info(`Raw OpenAI response: ${JSON.stringify(response.choices[0].message.content, null, 2)}`);

    const parsedResponse = this.parseResponse(response);
    core.info(`Parsed response: ${JSON.stringify(parsedResponse, null, 2)}`);

    return parsedResponse;
  }

  private buildPrompt(request: ReviewRequest): string {
    return JSON.stringify({
      type: 'code_review',
      files: request.files,
      pr: request.pullRequest,
      context: request.context,
    });
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

import * as core from '@actions/core';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { ReviewService } from './services/ReviewService';
import { GitHubService } from './services/GitHubService';
import { DiffService } from './services/DiffService';
import { readFileSync } from 'fs';

async function main() {
  try {
    // Get inputs
    const provider = core.getInput('AI_PROVIDER');
    const model = core.getInput('AI_MODEL');
    const apiKey = core.getInput('AI_API_KEY');
    const githubToken = core.getInput('GITHUB_TOKEN');

    // Initialize AI provider
    const aiProvider = getProvider(provider);
    await aiProvider.initialize({
      apiKey,
      model,
      temperature: 0.3,
    });

    // Initialize services
    const githubService = new GitHubService(githubToken);
    const diffService = new DiffService(githubToken);
    const reviewService = new ReviewService(
      aiProvider,
      githubService,
      diffService,
    );

    // Get PR number from GitHub context
    const prNumber = getPRNumberFromContext();
    
    // Perform review
    const review = await reviewService.performReview(prNumber);
    
    core.info(`Review completed with ${review.lineComments?.length ?? 0} comments`);
    
  } catch (error: unknown) {
    core.setFailed(`Action failed: ${(error as Error).message}`);
  }
}

function getProvider(provider: string) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'google':
      return new GeminiProvider();
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

function getPRNumberFromContext(): number {
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) {
      throw new Error('GITHUB_EVENT_PATH is not set');
    }

    const { pull_request } = JSON.parse(
      readFileSync(eventPath, 'utf8')
    );

    if (!pull_request?.number) {
      throw new Error('Could not get pull request number from event payload');
    }

    return pull_request.number;
  } catch (error) {
    throw new Error(`Failed to get PR number: ${error}`);
  }
}

main().catch(error => {
  core.setFailed(`Unhandled error: ${error.message}`);
});

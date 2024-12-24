import { AIProvider } from '../providers/AIProvider';
import { GitHubService } from '../services/GitHubService';
import { DiffService } from '../services/DiffService';
import { ReviewResponse } from '../providers/AIProvider';
import * as core from '@actions/core';

export class ReviewService {
  constructor(
    private aiProvider: AIProvider,
    private githubService: GitHubService,
    private diffService: DiffService,
  ) {}

  async performReview(prNumber: number): Promise<ReviewResponse> {
    core.info(`Starting review for PR #${prNumber}`);

    // Get PR details
    const prDetails = await this.githubService.getPRDetails(prNumber);
    core.info(`PR title: ${prDetails.title}`);

    // Get modified files from diff
    const modifiedFiles = await this.diffService.getRelevantFiles(prDetails);
    core.info(`Modified files length: ${modifiedFiles.length}`);

    // Get full content for each modified file
    const filesWithContent = await Promise.all(
      modifiedFiles.map(async (file) => ({
        path: file.path,
        content: await this.githubService.getFileContent(file.path, prDetails.head),
        originalContent: await this.githubService.getFileContent(file.path, prDetails.base),
        diff: file.diff,
      }))
    );

    // Get repository context (package.json, readme, etc)
    const contextFiles = await this.getRepositoryContext();

    // Perform AI review
    const review = await this.aiProvider.review({
      files: filesWithContent,
      contextFiles,
      pullRequest: {
        title: prDetails.title,
        description: prDetails.description,
        base: prDetails.base,
        head: prDetails.head,
      },
      context: {
        repository: process.env.GITHUB_REPOSITORY ?? '',
        owner: process.env.GITHUB_REPOSITORY_OWNER ?? '',
        projectContext: process.env.INPUT_PROJECT_CONTEXT,
      },
    });

    // Submit review
    await this.githubService.submitReview(prNumber, {
      ...review,
      suggestedAction: this.normalizeReviewEvent(review.suggestedAction),
    });

    return review;
  }

  private async getRepositoryContext(): Promise<Array<{path: string, content: string}>> {
    const contextFiles = ['package.json', 'README.md']; // TODO: This should be configurable
    const results = [];

    for (const file of contextFiles) {
      try {
        const content = await this.githubService.getFileContent(file);
        if (content) {
          results.push({ path: file, content });
        }
      } catch (error) {
        // File might not exist, skip it
      }
    }

    return results;
  }

  private normalizeReviewEvent(action: string): 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' {
    if (!action) {
      return 'COMMENT';
    }

    const eventMap: Record<string, 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'> = {
      'approve': 'APPROVE',
      'request_changes': 'REQUEST_CHANGES',
      'comment': 'COMMENT',
    };

    return eventMap[action.toLowerCase()] || 'COMMENT';
  }
}

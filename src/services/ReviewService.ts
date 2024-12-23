import { AIProvider } from '../providers/AIProvider';
import { GitHubService } from '../services/GitHubService';
import { DiffService } from '../services/DiffService';
import { ReviewResponse } from '../providers/AIProvider';

export class ReviewService {
  constructor(
    private aiProvider: AIProvider,
    private githubService: GitHubService,
    private diffService: DiffService,
  ) {}

  async performReview(prNumber: number): Promise<ReviewResponse> {
    // Get PR details
    const prDetails = await this.githubService.getPRDetails(prNumber);

    // Get relevant files
    const files = await this.diffService.getRelevantFiles(prDetails);
    
    // Get full content for modified files
    const filesWithContent = await Promise.all(
      files.map(async (file: { path: string; diff: string }) => ({
        path: file.path,
        content: await this.githubService.getFileContent(file.path),
        diff: file.diff,
      }))
    );

    // Perform AI review
    const review = await this.aiProvider.review({
      files: filesWithContent,
      pullRequest: {
        title: prDetails.title,
        description: prDetails.description,
        base: prDetails.base,
        head: prDetails.head,
      },
      context: {
        repository: process.env.GITHUB_REPOSITORY ?? '',
        owner: process.env.GITHUB_REPOSITORY_OWNER ?? '',
      },
    });

    // Submit review
    await this.githubService.submitReview(prNumber, review);

    return review;
  }
}

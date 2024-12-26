import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { ReviewResponse } from '../providers/AIProvider';

export interface PRDetails {
  owner: string;
  repo: string;
  number: number;
  title: string;
  description: string;
  base: string;
  head: string;
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    [this.owner, this.repo] = (process.env.GITHUB_REPOSITORY ?? '/').split('/');
  }

  async getPRDetails(prNumber: number): Promise<PRDetails> {
    const { data: pr } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return {
      owner: this.owner,
      repo: this.repo,
      number: prNumber,
      title: pr.title,
      description: pr.body ?? '',
      base: pr.base.sha,
      head: pr.head.sha,
    };
  }

  async getFileContent(path: string, ref?: string): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref,
      });

      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString();
      }
      throw new Error('Not a file');
    } catch (error) {
      core.warning(`Failed to get content for ${path}: ${error}`);
      return '';
    }
  }

  async submitReview(prNumber: number, review: ReviewResponse) {
    const { summary, lineComments = [], suggestedAction } = review;

    // Convert line comments to GitHub review comments format
    const allComments = await Promise.all(lineComments.map(async comment => {
      try {
        // Get the position in the diff for this line
        const position = await this.getDiffPosition(prNumber, comment.path, comment.line);

        return {
          path: comment.path,
          position, // Use diff position instead of line number
          body: comment.comment
        };
      } catch (error) {
        core.warning(`Failed to get diff position for ${comment.path}: ${error}`);
        return null;
      }
    }));

    const comments = allComments.filter(comment => comment !== null);

    core.info(`Submitting review with comments: ${JSON.stringify(comments, null, 2)}`);

    await this.octokit.pulls.createReview({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      body: summary,
      comments,
      event: suggestedAction.toUpperCase() as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
    });
  }

  private async getDiffPosition(prNumber: number, filePath: string, line: number): Promise<number> {
    const { data: files } = await this.octokit.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    });

    const file = files.find(f => f.filename === filePath);
    if (!file) {
      throw new Error(`File ${filePath} not found in PR diff`);
    }

    core.debug(`Processing diff for ${filePath}:`);
    core.debug(file.patch || '');

    // Parse the patch and find the position
    const patch = file.patch || '';
    let position = 0;
    let currentLine = 0;
    let inHunk = false;

    for (const patchLine of patch.split('\n')) {
      if (patchLine.startsWith('@@')) {
        // Parse hunk header
        const match = patchLine.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          currentLine = parseInt(match[1], 10) - 1;
          inHunk = true;
        }
      } else if (inHunk) {
        position++;
        if (patchLine.startsWith('+') || !patchLine.startsWith('-')) {
          currentLine++;
          core.debug(`Line ${currentLine} at position ${position}`);
          if (currentLine === line) {
            return position;
          }
        }
      }
    }

    core.error(`Failed to find line ${line} in diff. Last line processed: ${currentLine}`);
    throw new Error(`Line ${line} not found in diff for ${filePath}`);
  }

  async getLastReviewedCommit(prNumber: number): Promise<string | null> {
    const { data: reviews } = await this.octokit.pulls.listReviews({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    // Find the last review from our bot
    const lastBotReview = reviews
      .reverse()
      .find(review => review.user?.login === 'github-actions[bot]');

    if (!lastBotReview) return null;

    // Get the commit SHA at the time of the review
    const { data: commits } = await this.octokit.pulls.listCommits({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    const reviewDate = new Date(lastBotReview.submitted_at!);
    const lastCommit = commits
      .reverse()
      .find(commit => commit.commit.committer?.date &&
        new Date(commit.commit.committer.date) <= reviewDate);

    return lastCommit?.sha || null;
  }

  async getPreviousReviews(prNumber: number): Promise<Array<{
    commit: string | null;
    summary: string;
    lineComments: Array<{
      path: string;
      line: number;
      comment: string;
    }>;
  }>> {
    const { data: reviews } = await this.octokit.pulls.listReviews({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    // Filter to bot reviews and fetch their comments
    const botReviews =reviews.filter(review => review.user?.login === 'github-actions[bot]');

    core.debug(`Found ${botReviews.length} bot reviews`);

    const botReviewsWithComments = await Promise.all(
      botReviews.map(async review => {
        const { data: comments } = await this.octokit.pulls.listReviewComments({
          owner: this.owner,
          repo: this.repo,
          pull_number: prNumber,
          review_id: review.id
          });

          return {
            commit: review.commit_id,
            summary: review.body || '',
            lineComments: comments.map(comment => ({
              path: comment.path,
              line: comment.line || 0,
              comment: comment.body
            }))
          };
        })
    );

    return botReviewsWithComments;
  }
}

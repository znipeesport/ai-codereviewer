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
    
    // Convert our line comments to GitHub's expected format
    const comments = lineComments.map(comment => ({
      path: comment.path,
      position: comment.line,
      body: comment.comment
    }));

    await this.octokit.pulls.createReview({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      body: summary,
      comments,
      event: suggestedAction.toUpperCase() as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
    });
  }
}

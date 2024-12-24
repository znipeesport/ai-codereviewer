import parseDiff, { File } from 'parse-diff';
import { minimatch } from 'minimatch';
import * as core from '@actions/core';
import { PRDetails } from './GitHubService';

export class DiffService {
  private excludePatterns: string[];

  constructor() {
    this.excludePatterns = core.getInput('EXCLUDE_PATTERNS')
      .split(',')
      .map(p => p.trim());
  }

  async getRelevantFiles(prDetails: PRDetails): Promise<Array<{ path: string; diff: string }>> {
    const response = await fetch(
      `https://api.github.com/repos/${prDetails.owner}/${prDetails.repo}/pulls/${prDetails.number}.diff`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3.diff'
        }
      }
    );

    if (!response.ok) {
      core.error(`Failed to fetch diff: ${await response.text()}`);
      throw new Error(`Failed to fetch diff: ${response.statusText}`);
    }

    const diffText = await response.text();
    core.info(`Diff text length: ${diffText.length}`);

    const files = parseDiff(diffText);
    return this.filterRelevantFiles(files);
  }

  private filterRelevantFiles(files: File[]): Array<{ path: string; diff: string }> {
    return files
      .filter(file => {
        const shouldInclude = !this.excludePatterns.some(pattern => 
          minimatch(file.to ?? '', pattern)
        );
        if (!shouldInclude) {
          core.debug(`Excluding file: ${file.to}`);
        }
        return shouldInclude;
      })
      .map(file => ({
        path: file.to ?? '',
        diff: this.formatDiff(file),
      }));
  }

  private formatDiff(file: File): string {
    return file.chunks
      .map(chunk => {
        const changes = chunk.changes
          .map(c => {
            const lineNum = c.type === 'normal' 
              ? `${c.ln1},${c.ln2}`
              : c.ln || '';
            return `${c.type}${lineNum} ${c.content}`;
          })
          .join('\n');
        return `@@ ${chunk.content} @@\n${changes}`;
      })
      .join('\n');
  }
}

import parseDiff, { File } from 'parse-diff';
import { minimatch } from 'minimatch';
import * as core from '@actions/core';
import { PRDetails } from './GitHubService';

export class DiffService {
  private excludePatterns: string[];
  private githubToken: string;

  constructor(githubToken: string) {
    this.githubToken = githubToken;
    this.excludePatterns = core.getInput('EXCLUDE_PATTERNS')
      .split(',')
      .map(p => p.trim());
  }

  async getRelevantFiles(
    prDetails: PRDetails, 
    lastReviewedCommit?: string | null
  ): Promise<Array<{ path: string; diff: string }>> {
    const baseUrl = `https://api.github.com/repos/${prDetails.owner}/${prDetails.repo}`;
    const diffUrl = lastReviewedCommit ? 
      `${baseUrl}/compare/${lastReviewedCommit}...${prDetails.head}` :
      `${baseUrl}/pulls/${prDetails.number}`;

    const response = await fetch(diffUrl, {
      headers: {
        'Authorization': `Bearer ${this.githubToken}`,
        'Accept': 'application/vnd.github.v3.diff',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      core.error(`Failed to fetch diff from ${diffUrl}: ${errorText}`);
      throw new Error(`Failed to fetch diff: ${response.statusText}`);
    }

    const diffText = await response.text();
    core.debug(`Full diff text length: ${diffText.length}`);

    const files = parseDiff(diffText);
    core.info(`Found ${files.length} files in diff`);

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

  getModifiedLines(diff: string): Array<{ start: number; end: number }> {
    const files = parseDiff(diff);
    const modifiedLines: Array<{ start: number; end: number }> = [];

    for (const file of files) {
      for (const chunk of file.chunks) {
        let currentLine = chunk.newStart;
        let currentBlock: { start: number; end: number } | null = null;

        for (const change of chunk.changes) {
          if (change.type === 'add' || change.type === 'normal') {
            if (change.type === 'add') {
              if (!currentBlock) {
                currentBlock = { start: currentLine, end: currentLine + 1 };
                modifiedLines.push(currentBlock);
              } else {
                currentBlock.end = currentLine + 1;
              }
            } else if (change.type === 'normal' && currentBlock) {
              currentBlock = null;
            }
            currentLine++;
          }
        }
      }
    }

    return modifiedLines;
  }

  extractRelevantContext(fullContent: string, diff: string, contextLines: number = 10): string {
    const modifiedLines = this.getModifiedLines(diff);
    const lines = fullContent.split('\n');
    const relevantSections: Array<{ start: number; end: number }> = [];

    // Merge nearby sections
    for (const block of modifiedLines) {
      const start = Math.max(0, block.start - contextLines);
      const end = Math.min(lines.length, block.end + contextLines);

      if (relevantSections.length > 0 && start <= relevantSections[relevantSections.length - 1].end) {
        relevantSections[relevantSections.length - 1].end = end;
      } else {
        relevantSections.push({ start, end });
      }
    }

    return this.formatRelevantSections(lines, relevantSections);
  }

  private formatRelevantSections(lines: string[], sections: Array<{ start: number; end: number }>): string {
    const result: string[] = [];
    let lastEnd = 0;

    for (const section of sections) {
      if (section.start > lastEnd) {
        result.push('// ... skipped unchanged code ...');
      }
      result.push(...lines.slice(section.start, section.end));
      lastEnd = section.end;
    }

    if (lastEnd < lines.length) {
      result.push('// ... skipped unchanged code ...');
    }

    return result.join('\n');
  }
}

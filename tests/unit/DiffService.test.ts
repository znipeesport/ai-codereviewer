import { DiffService } from '../../src/services/DiffService';
import parseDiff from 'parse-diff';

jest.mock('parse-diff');

describe('DiffService', () => {
  let diffService: DiffService;

  beforeEach(() => {
    process.env.INPUT_EXCLUDE_PATTERNS = '**/*.md,**/*.json';
    diffService = new DiffService();
  });

  it('should filter out excluded files', async () => {
    const mockFiles = [
      { to: 'src/main.ts', chunks: [] },
      { to: 'README.md', chunks: [] },
      { to: 'package.json', chunks: [] }
    ];

    (parseDiff as jest.Mock).mockReturnValue(mockFiles);

    const result = await diffService.getRelevantFiles({
      owner: 'test',
      repo: 'test',
      number: 1,
      title: '',
      description: '',
      base: '',
      head: ''
    });

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/main.ts');
  });

  it('should format diff correctly', async () => {
    const mockFile = {
      to: 'src/main.ts',
      chunks: [{
        content: '@@ -1,3 +1,3 @@',
        changes: [
          { type: 'normal', ln1: 1, ln2: 1, content: 'unchanged line' },
          { type: '-', ln: 2, content: 'removed line' },
          { type: '+', ln2: 2, content: 'added line' }
        ]
      }]
    };

    (parseDiff as jest.Mock).mockReturnValue([mockFile]);

    const result = await diffService.getRelevantFiles({
      owner: 'test',
      repo: 'test',
      number: 1,
      title: '',
      description: '',
      base: '',
      head: ''
    });

    expect(result[0].diff).toContain('normal1,1 unchanged line');
    expect(result[0].diff).toContain('-2 removed line');
    expect(result[0].diff).toContain('+ added line');
  });
});

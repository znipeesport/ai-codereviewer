import { ReviewService } from '../../src/services/ReviewService';
import { GitHubService } from '../../src/services/GitHubService';
import { DiffService } from '../../src/services/DiffService';
import { OpenAIProvider } from '../../src/providers/OpenAIProvider';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';

// Mock the modules
jest.mock('@octokit/rest');
jest.mock('openai');

describe('Pull Request Review Flow', () => {
  const mockPRData = {
    owner: 'test-owner',
    repo: 'test-repo',
    number: 123,
    title: 'Test PR',
    description: 'Test Description',
    base: 'base-sha',
    head: 'head-sha',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';
    process.env.GITHUB_TOKEN = 'fake-token';
  });

  it('should perform a complete review flow', async () => {
    // Setup Octokit mock
    const mockOctokitResponse = {
      pulls: {
        get: jest.fn().mockResolvedValue({ data: mockPRData }),
        createReview: jest.fn().mockResolvedValue({}),
      },
      repos: {
        getContent: jest.fn().mockResolvedValue({
          data: { content: Buffer.from('mock content').toString('base64') },
        }),
      },
    };
    
    (Octokit as jest.MockedClass<typeof Octokit>).mockImplementation(() => {
      return mockOctokitResponse as any;
    });

    // Mock OpenAI client
    const mockOpenAIResponse = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: 'Test review summary',
                  comments: [{
                    path: 'src/main.ts',
                    line: 2,
                    comment: 'Consider using const for immutable values'
                  }],
                  suggestedAction: 'comment',
                  confidence: 0.9
                })
              }
            }]
          })
        }
      }
    };

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => {
      return mockOpenAIResponse as any;
    });

    // Initialize services
    const githubService = new GitHubService('fake-token');
    const diffService = new DiffService();
    const aiProvider = new OpenAIProvider();
    
    // Initialize the AI provider
    await aiProvider.initialize({
      apiKey: 'fake-key',
      model: 'gpt-4',
      temperature: 0.3
    });

    const reviewService = new ReviewService(
      aiProvider,
      githubService,
      diffService
    );

    // Perform the review
    await reviewService.performReview(123);

    // Verify GitHub calls
    expect(mockOctokitResponse.pulls.get).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 123
    });

    // Verify OpenAI calls
    expect(mockOpenAIResponse.chat.completions.create).toHaveBeenCalled();

    // Verify review submission
    expect(mockOctokitResponse.pulls.createReview).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      pull_number: 123,
      body: 'Test review summary',
      comments: [
        {
          path: 'src/main.ts',
          line: 2,
          comment: 'Consider using const for immutable values'
        }
      ],
      event: 'comment'
    });
  });
});

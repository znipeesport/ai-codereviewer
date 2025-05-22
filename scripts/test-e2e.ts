import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config();

// Load the PR ID
const owner = process.argv[2];
const repo = process.argv[3];
const prId = process.argv[4];
const projectContext = process.argv[4] || '';

// Read the PR payload
const prPayload = JSON.parse(
  readFileSync(resolve(__dirname, `./pull-requests/test-pr-payload-${prId}.json`), 'utf8')
);

// Set required environment variables for the action
process.env.GITHUB_EVENT_PATH = resolve(__dirname, `./pull-requests/test-pr-payload-${prId}.json`);
process.env.GITHUB_WORKSPACE = resolve(__dirname, '..');
process.env.GITHUB_REPOSITORY = `${owner}/${repo}`;
process.env.GITHUB_CONTEXT = JSON.stringify({
  event: prPayload,
  payload: prPayload
});

// IMPORTANT: Make sure the token is set before setting INPUT_GITHUB_TOKEN
process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;

// Set action inputs (these would normally come from action.yml)
process.env.INPUT_GITHUB_TOKEN = process.env.GITHUB_TOKEN;
process.env.INPUT_AI_PROVIDER = process.env.INPUT_AI_PROVIDER || 'openai';
process.env.INPUT_AI_API_KEY = process.env.INPUT_AI_API_KEY || process.env.OPENAI_API_KEY;
process.env.INPUT_AI_MODEL = process.env.INPUT_AI_MODEL || 'gpt-4o-mini';
// process.env.INPUT_REVIEW_MAX_COMMENTS = process.env.INPUT_REVIEW_MAX_COMMENTS || '10';
process.env.INPUT_EXCLUDE_PATTERNS = '**/*.lock,**/*.json,**/*.md';
process.env.INPUT_APPROVE_REVIEWS = 'true';
process.env.INPUT_REVIEW_PROJECT_CONTEXT = projectContext;

// Run the action
require('../lib/src/main');

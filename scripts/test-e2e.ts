import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config();

// Set required environment variables for the action
process.env.GITHUB_EVENT_PATH = resolve(__dirname, './pull-requests/test-pr-payload-982.json');
process.env.GITHUB_WORKSPACE = resolve(__dirname, '..');
process.env.GITHUB_REPOSITORY = 'demandio/simplycodes-extension';

// IMPORTANT: Make sure the token is set before setting INPUT_GITHUB_TOKEN
process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;

// Set action inputs (these would normally come from action.yml)
process.env.INPUT_GITHUB_TOKEN = process.env.GITHUB_TOKEN;
process.env.INPUT_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
process.env.INPUT_OPENAI_API_MODEL = 'gpt-4';
process.env.INPUT_REVIEW_MAX_COMMENTS = '10';
process.env.INPUT_EXCLUDE = '**/*.md,**/*.json';
process.env.INPUT_APPROVE_REVIEWS = 'false';
process.env.INPUT_REVIEW_PROJECT_CONTEXT = 'This is a browser extension for SimplyCodes';

// Run the action
require('../lib/main');

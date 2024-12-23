import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const token = process.env.GITHUB_TOKEN;
const owner = 'demandio';
const repo = 'simplycodes-extension';
const pr_number = 982;

async function generatePRPayload() {
  const octokit = new Octokit({ auth: token });
  
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pr_number,
  });

  // Format as GitHub webhook payload
  const payload = {
    action: 'opened',
    pull_request: pr,
    repository: {
      name: repo,
      owner: {
        login: owner
      }
    },
    number: pr_number
  };

  const fileName = `scripts/pull-requests/test-pr-payload-${pr_number}.json`;
  fs.writeFileSync(fileName, JSON.stringify(payload, null, 2));
  console.log(`Payload saved to ${fileName}`);
}

generatePRPayload().catch(console.error);

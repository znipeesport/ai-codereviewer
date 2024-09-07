import { readFileSync } from "fs";
import * as core from "@actions/core";
import { Configuration, OpenAIApi } from "openai";
import { Octokit } from "@octokit/rest";
import parseDiff, { Chunk, File } from "parse-diff";
import minimatch from "minimatch";

const GITHUB_TOKEN: string = core.getInput("GITHUB_TOKEN");
const OPENAI_API_KEY: string = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL: string = core.getInput("OPENAI_API_MODEL");
const REVIEW_MAX_COMMENTS: string = core.getInput("REVIEW_MAX_COMMENTS");
const REVIEW_PROJECT_CONTEXT: string = core.getInput("REVIEW_PROJECT_CONTEXT");

const RESPONSE_TOKENS = 1024;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
  title: string;
  description: string;
}

interface AICommentResponse {
  file: string;
  lineNumber: string;
  reviewComment: string;
}

interface GithubComment {
  body: string;
  path: string;
  line: number;
}

async function getPRDetails(): Promise<PRDetails> {
  console.log("Fetching PR details...");
  const { repository, number } = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH || "", "utf8")
  );
  const prResponse = await octokit.pulls.get({
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: number,
  });
  console.log(`PR details fetched for PR #${number}`);
  return {
    owner: repository.owner.login,
    repo: repository.name,
    pull_number: number,
    title: prResponse.data.title ?? "",
    description: prResponse.data.body ?? "",
  };
}

async function getDiff(
  owner: string,
  repo: string,
  pull_number: number
): Promise<string | null> {
  console.log(`Fetching diff for PR #${pull_number}...`);
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: "diff" },
  });
  // @ts-expect-error - response.data is a string
  return response.data;
}

async function analyzeCode(
  changedFiles: File[],
  prDetails: PRDetails
): Promise<Array<GithubComment>> {
  console.log("Analyzing code...");
  const prompt = createPrompt(changedFiles, prDetails);
  const aiResponse = await getAIResponse(prompt);

  const comments: Array<GithubComment> = [];

  if (aiResponse) {
    const newComments = createComments(changedFiles, aiResponse);

    if (newComments) {
      comments.push(...newComments);
    }
  }

  console.log(`Analysis complete. Generated ${comments.length} comments.`);
  return comments;
}

function createPrompt(changedFiles: File[], prDetails: PRDetails): string {
  console.log("Creating prompt for AI...");
  const problemOutline = `Your task is to review pull requests (PR). Instructions:
- Provide the response in following JSON format:  [{"file": <file name>,  "lineNumber":  <line_number>, "reviewComment": "<review comment>"}]
- DO NOT give positive comments or compliments.
- DO NOT give advice on renaming variable names or writing more descriptive variables.
- Provide comments and suggestions ONLY if there is something to improve, otherwise return an empty array.
- Provide at most ${REVIEW_MAX_COMMENTS} comments. It's up to you how to decide which comments to include.
- Write the comment in GitHub Markdown format.
- Use the given description only for the overall context and only comment the code.
${
  REVIEW_PROJECT_CONTEXT
    ? `- Additional context regarding this PR's project: ${REVIEW_PROJECT_CONTEXT}`
    : ""
}
- IMPORTANT: NEVER suggest adding comments to the code.
- IMPORTANT: Evaluate the entire diff in the PR before adding any comments.

Pull request title: ${prDetails.title}
Pull request description:

---
${prDetails.description}
---

TAKE A DEEP BREATH AND WORK ON THIS THIS PROBLEM STEP-BY-STEP.
`;

  const diffChunksPrompt = new Array();

  for (const file of changedFiles) {
    if (file.to === "/dev/null") continue; // Ignore deleted files
    for (const chunk of file.chunks) {
      diffChunksPrompt.push(createPromptForDiffChunk(file, chunk));
    }
  }

  console.log("Prompt created successfully.");
  return `${problemOutline}\n ${diffChunksPrompt.join("\n")}`;
}

function createPromptForDiffChunk(file: File, chunk: Chunk): string {
  return `\n
  Review the following code diff in the file "${file.to}". Git diff to review:

  \`\`\`diff
  ${chunk.content}
  ${chunk.changes
    // @ts-expect-error - ln and ln2 exists where needed
    .map((c) => `${c.ln ? c.ln : c.ln2} ${c.content}`)
    .join("\n")}
  \`\`\`
  `;
}

async function getAIResponse(
  prompt: string
): Promise<Array<AICommentResponse>> {
  console.log("Sending request to OpenAI API...");
  const queryConfig = {
    model: OPENAI_API_MODEL,
    temperature: 0.2,
    max_tokens: RESPONSE_TOKENS,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  try {
    const response = await openai.createChatCompletion({
      ...queryConfig,
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    });

    if (response.status !== 200) {
      throw new Error(`OpenAI API returned non-200 status: ${response.status}`);
    }

    console.log("Received response from OpenAI API.");
    const res = response.data.choices[0].message?.content?.trim() || "[]";
    return JSON.parse(res);
  } catch (error: any) {
    console.error("Error Message:", error?.message || error);

    if (error?.response) {
      console.error("Response Data:", error.response.data);
      console.error("Response Status:", error.response.status);
      console.error("Response Headers:", error.response.headers);
    }

    if (error?.config) {
      console.error("Config:", error.config);
    }

    core.setFailed(`OpenAI API request failed: ${error.message}`);
    throw error;
  }
}

function createComments(
  changedFiles: File[],
  aiResponses: Array<AICommentResponse>
): Array<GithubComment> {
  console.log("Creating GitHub comments from AI responses...");
  return aiResponses
    .flatMap((aiResponse) => {
      const file = changedFiles.find((file) => file.to === aiResponse.file);

      return {
        body: aiResponse.reviewComment,
        path: file?.to ?? "",
        line: Number(aiResponse.lineNumber),
      };
    })
    .filter((comments) => comments.path !== "");
}

async function createReviewComment(
  owner: string,
  repo: string,
  pull_number: number,
  comments: Array<GithubComment>
): Promise<void> {
  console.log(`Creating review comment for PR #${pull_number}...`);
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number,
    comments,
    event: "COMMENT",
  });
  console.log("Review comment created successfully.");
}

async function main() {
  try {
    console.log("Starting AI code review process...");
    const prDetails = await getPRDetails();
    let diff: string | null;
    const eventData = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8")
    );

    console.log(`Processing ${eventData.action} event...`);
    if (eventData.action === "opened") {
      diff = await getDiff(
        prDetails.owner,
        prDetails.repo,
        prDetails.pull_number
      );
    } else if (eventData.action === "synchronize") {
      const newBaseSha = eventData.before;
      const newHeadSha = eventData.after;

      console.log(`Comparing commits: ${newBaseSha} -> ${newHeadSha}`);
      const response = await octokit.repos.compareCommits({
        headers: {
          accept: "application/vnd.github.v3.diff",
        },
        owner: prDetails.owner,
        repo: prDetails.repo,
        base: newBaseSha,
        head: newHeadSha,
      });

      diff = String(response.data);
    } else {
      console.log("Unsupported event:", process.env.GITHUB_EVENT_NAME);
      return;
    }

    if (!diff) {
      console.log("No diff found");
      return;
    }

    const changedFiles = parseDiff(diff);
    console.log(`Found ${changedFiles.length} changed files.`);

    const excludePatterns = core
      .getInput("exclude")
      .split(",")
      .map((s) => s.trim());

    const filteredDiff = changedFiles.filter((file) => {
      return !excludePatterns.some((pattern) =>
        minimatch(file.to ?? "", pattern)
      );
    });
    console.log(`After filtering, ${filteredDiff.length} files remain.`);

    const comments = await analyzeCode(filteredDiff, prDetails);
    if (comments.length > 0) {
      await createReviewComment(
        prDetails.owner,
        prDetails.repo,
        prDetails.pull_number,
        comments
      );
    } else {
      console.log("No comments to post.");
    }
    console.log("AI code review process completed successfully.");
  } catch (error: any) {
    console.error("Error:", error);
    core.setFailed(`Action failed: ${error.message}`);
  }
}

main();

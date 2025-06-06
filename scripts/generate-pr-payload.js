"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const token = process.env.GITHUB_TOKEN;
const owner = 'demandio';
const repo = 'simplycodes-extension';
const pr_number = 982;
async function generatePRPayload() {
    const octokit = new rest_1.Octokit({ auth: token });
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

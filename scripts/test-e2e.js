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
const dotenv = __importStar(require("dotenv"));
const path_1 = require("path");
// Load environment variables
dotenv.config();
// Set required environment variables for the action
process.env.GITHUB_EVENT_PATH = (0, path_1.resolve)(__dirname, './pull-requests/test-pr-payload-982.json');
process.env.GITHUB_WORKSPACE = (0, path_1.resolve)(__dirname, '..');
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

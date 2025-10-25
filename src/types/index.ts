/**
 * @module types
 * @description This module defines the TypeScript interfaces and types used throughout the application.
 * It includes types for Google API responses, authentication tokens, and the standardized
 * request and response structures for the worker's endpoints.
 */

import { D1Database } from "@cloudflare/workers-types";

// Environment interface for Cloudflare Workers
export interface Env {
  // D1 Database bindings
  DB: D1Database;
  
  // KV bindings
  KV: KVNamespace;
  
  // Vectorize bindings
  VECTORIZE: VectorizeIndex;
  
  // AI bindings
  AI: Ai;
  
  // Service bindings
  AI_AGENT_WORKER: Fetcher;
  
  // Environment variables
  WORKSPACE_TOOLS_VERSION: string;
  GOOGLE_AUTH_BASE: string;
  GOOGLE_TOKEN_URL: string;
  GOOGLE_API_BASE: string;
  OAUTH_REDIRECT_URI: string;
  DEFAULT_USER: string;
  
  // API Keys (secrets)
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_SERVICE_ACCOUNT_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  
  // CORS and security
  ALLOWED_ORIGINS?: string;
  API_KEY?: string;
}

// Google API response types and interfaces

/**
 * @interface GoogleAuthToken
 * @description Represents an OAuth 2.0 token for authenticating with Google APIs.
 */
export interface GoogleAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope: string;
}

/**
 * @interface GoogleApiError
 * @description Defines the structure of a standard error response from a Google API.
 */
export interface GoogleApiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

// Gmail types

/**
 * @interface GmailMessage
 * @description Represents a single email message from the Gmail API.
 * Note: This is an abridged version of the full API response.
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body: { data?: string };
    }>;
  };
  internalDate: string;
}

/**
 * @interface GmailThread
 * @description Represents an email thread from the Gmail API, containing multiple messages.
 */
export interface GmailThread {
  id: string;
  snippet: string;
  messages: GmailMessage[];
}

/**
 * @interface GmailSearchResult
 * @description Represents the result of a search query to the Gmail API.
 */
export interface GmailSearchResult {
  messages?: Array<{ id: string; threadId: string }>;
  threads?: Array<{ id: string; snippet: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

// Drive types

/**
 * @interface DriveFile
 * @description Represents a file or folder in Google Drive.
 * Note: This is an abridged version of the full API response.
 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
  owners?: Array<{ displayName: string; emailAddress: string }>;
}

/**
 * @interface DriveSearchResult
 * @description Represents the result of a file search query to the Drive API.
 */
export interface DriveSearchResult {
  files: DriveFile[];
  nextPageToken?: string;
}

// Google Docs types

/**
 * @interface DocsDocument
 * @description Represents a Google Docs document.
 * Note: This is an abridged version of the full API response.
 */
export interface DocsDocument {
  documentId: string;
  title: string;
  body: {
    content: Array<{
      paragraph?: {
        elements: Array<{
          textRun?: { content: string };
        }>;
      };
    }>;
  };
  revisionId: string;
}

/**
 * @interface DocsComment
 * @description Represents a comment in a Google Docs document.
 */
export interface DocsComment {
  commentId: string;
  content: string;
  author: { displayName: string };
  createdTime: string;
  quotedFileContent?: {
    value: string;
  };
}

// Google Sheets types

/**
 * @interface SheetsSpreadsheet
 * @description Represents a Google Sheets spreadsheet.
 * Note: This is an abridged version of the full API response.
 */
export interface SheetsSpreadsheet {
  spreadsheetId: string;
  properties: {
    title: string;
  };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
    };
  }>;
}

/**
 * @interface SheetsValues
 * @description Represents a range of values from a Google Sheets spreadsheet.
 */
export interface SheetsValues {
  range: string;
  majorDimension: string;
  values: string[][];
}

/**
 * @interface SheetsComment
 * @description Represents a comment (note) in a Google Sheets spreadsheet.
 */
export interface SheetsComment {
  commentId: string;
  content: string;
  author: { displayName: string };
  createdTime: string;
}

// Google Slides types

/**
 * @interface SlidesPageElement
 * @description Represents an element on a Google Slides slide, such as a shape or text box.
 */
export interface SlidesPageElement {
  objectId?: string;
  shape?: {
    objectId?: string;
    text?: {
      textElements: Array<{
        textRun?: { content: string };
      }>;
    };
  };
}

/**
 * @interface SlidesSlide
 * @description Represents a single slide in a Google Slides presentation.
 */
export interface SlidesSlide {
  objectId: string;
  pageElements?: SlidesPageElement[];
}

/**
 * @interface SlidesPresentation
 * @description Represents a Google Slides presentation.
 * Note: This is an abridged version of the full API response.
 */
export interface SlidesPresentation {
  presentationId: string;
  title: string;
  slides?: SlidesSlide[];
  revisionId: string;
}

/**
 * @interface SlidesComment
 * @description Represents a comment in a Google Slides presentation.
 */
export interface SlidesComment {
  commentId: string;
  content: string;
  author: { displayName: string };
  createdTime: string;
}

// Apps Script types

/**
 * @interface AppsScriptProject
 * @description Represents a Google Apps Script project.
 */
export interface AppsScriptProject {
  scriptId: string;
  title: string;
  files: Array<{
    name: string;
    type: string;
    source: string;
  }>;
  createTime: string;
  updateTime: string;
}

/**
 * @interface AppsScriptDeployment
 * @description Represents a deployment of a Google Apps Script project.
 */
export interface AppsScriptDeployment {
  deploymentId: string;
  entryPoints: Array<{
    entryPointType: string;
    webApp?: {
      url: string;
      executeAs: string;
      access: string;
    };
  }>;
  updateTime: string;
  versionNumber: number;
}

// Common request/response types

/**
 * @interface WorkspaceToolRequest
 * @description A generic interface for request bodies sent to the worker's endpoints.
 */
export interface WorkspaceToolRequest {
  user?: string;
  [key: string]: any;
}

/**
 * @interface WorkspaceToolResponse
 * @description The standardized response structure for all endpoints in the worker.
 * @template T The type of the data payload.
 */
export interface WorkspaceToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string | ApiError;
  timestamp: string;
}

/**
 * @interface ApiError
 * @description Enhanced error structure for API responses.
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * @interface EmbeddingResult
 * @description Represents the result of an embedding generation request.
 */
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Specific response types for better type safety

/**
 * @interface GmailSearchResponse
 * @description Response type for Gmail search operations.
 */
export interface GmailSearchResponse {
  messages: Array<{ id: string; threadId: string }>;
  resultSizeEstimate: number;
  nextPageToken?: string;
  query: string;
}

/**
 * @interface GmailMessageResponse
 * @description Response type for Gmail message operations.
 */
export interface GmailMessageResponse {
  messageId: string;
  threadId: string;
  snippet: string;
  textContent?: string;
  htmlContent?: string;
  headers: {
    from: string;
    to: string;
    subject: string;
    date: string;
  };
  internalDate: string;
}

/**
 * @interface DocumentReadResponse
 * @description Response type for document read operations.
 */
export interface DocumentReadResponse {
  documentId: string;
  title: string;
  revisionId: string;
  paragraphs: string[];
  paragraphCount: number;
  fullText: string;
}

/**
 * @interface CommentResponse
 * @description Response type for comment operations.
 */
export interface CommentResponse {
  commentId: string;
  content: string;
  author?: {
    displayName: string;
    emailAddress: string;
  };
  createdTime: string;
  quotedFileContent?: {
    value: string;
  };
}

/**
 * @interface EmailDraftResponse
 * @description Response type for email draft operations.
 */
export interface EmailDraftResponse {
  draft: {
    id: string;
    message: {
      id: string;
      threadId: string;
      to: string;
      subject: string;
      text: string;
      cc?: string;
      bcc?: string;
    };
  };
  aiAssistance?: {
    enabled: boolean;
    contentGenerated: boolean;
    details?: any;
    analysis?: any;
    fallbackUsed: boolean;
  };
  recommendations: string[];
}

// A2A (Agent-to-Agent) Protocol Types

/**
 * @interface A2AAgentCard
 * @description Represents an A2A agent's discovery card (/.well-known/agent.json)
 */
export interface A2AAgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    workspaceIntegration: boolean;
    crossServiceOrchestration: boolean;
  };
  skills: A2ASkill[];
}

/**
 * @interface A2ASkill
 * @description Represents a skill that an A2A agent can perform
 */
export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  parameters?: {
    [key: string]: {
      type: string;
      description: string;
      required: boolean;
      default?: any;
    };
  };
}

/**
 * @interface A2AExecuteRequest
 * @description Request structure for executing a skill via A2A protocol
 */
export interface A2AExecuteRequest {
  skill: string;
  parameters: {
    [key: string]: any;
  };
  metadata?: {
    requestId?: string;
    timestamp?: string;
    source?: string;
  };
}

/**
 * @interface A2AExecuteResponse
 * @description Response structure for A2A skill execution
 */
export interface A2AExecuteResponse {
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId?: string;
    timestamp: string;
    executionTime?: number;
  };
}

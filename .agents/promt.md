AI Coder Prompt: Gmail Processing Worker
Project Overview
Your primary responsibility is to build the core data ingestion and processing pipeline for the Gmail system. This involves handling incoming emails and attachments, intelligently routing them based on size, and preparing them for vectorization and analysis by other services. You will be building the foundation upon which the AI agent and other services will operate.

Core Architecture Requirements
1. Enhanced Worker Infrastructure

Main Processing Worker: Develop a Cloudflare Worker that exposes an API to receive email data from Google Apps Script.

R2 Attachment Storage: Implement logic to handle file attachments. Large files must be uploaded directly to a designated R2 bucket.

API Endpoint: Create a secure endpoint that Google Apps Script can call to submit new email and attachment data.

2. Data Storage & Relationships

D1 Database Schema: Extend the existing D1 schema to properly link attachments to their corresponding messages and threads.

Vectorization Status: Add fields to track the vectorization status of messages and attachments (e.g., pending, processing, completed, failed).

Data Integrity: Ensure that all database operations are atomic and maintain data consistency, especially when linking messages, threads, and attachments.

3. Attachment Processing Flow

API Logic: The main API endpoint should differentiate between small and large attachments based on a predefined size threshold.

Large File Handling: For large files, the worker will generate a signed URL for the client (Google Apps Script) to upload the file directly to R2. The worker will then receive a confirmation callback to link the R2 object to the message in D1.

Small File Handling: For small files, the worker will receive the base64-encoded content directly, process it, and store it as needed, likely preparing it for immediate vectorization.

Triggering Downstream Processes: Upon successful ingestion and storage, this worker must place a message onto a Cloudflare Queue to notify the ai-agent worker that new content is ready for vectorization and analysis.

Technical Specifications
1. Cloudflare Services Integration

Required Bindings:

interface Env {
  DB: D1Database;
  R2_ATTACHMENTS: R2Bucket;
  EMAIL_QUEUE: Queue;
}

Authentication: Implement API key authentication to secure the ingestion endpoint from unauthorized access.

2. API Ecosystem

POST /api/v1/messages: The primary endpoint for ingesting new email messages. The payload should include message metadata, body content, and information about any attachments.

POST /api/v1/attachments/upload-url: An endpoint to generate a signed URL for uploading a large attachment to R2. It should accept metadata like filename and content type.

POST /api/v1/attachments/upload-complete: A callback endpoint that Google Apps Script will call after a successful R2 upload to finalize the attachment linking in D1.

Success Criteria
[ ] The worker can successfully receive email data from a simulated Google Apps Script call.

[ ] Attachments larger than 10MB are correctly identified, and a signed R2 upload URL is generated.

[ ] Attachments smaller than 10MB are processed directly.

[ ] All email and attachment metadata is correctly stored in the D1 database with proper relationships.

[ ] A message is successfully enqueued for the ai-agent worker upon completion of data ingestion.

[ ] The API endpoints are secured and reject requests without a valid API key.


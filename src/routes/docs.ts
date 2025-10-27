/**
 * @module docsRoutes
 * @description Provides Hono routes for interacting with the Google Docs API.
 * This module includes functionalities for reading documents, creating new documents from Markdown,
 * updating content, and managing comments.
 * @requires hono
 * @requires ../index
 * @requires ../types
 * @requires ../utils/google-api
 */

import { Hono } from "hono";
import { Env } from "../types";
import { DocsDocument, WorkspaceToolResponse } from "../types";
import { GoogleApiClient } from "../utils/google-api";
import { validateDocumentReadRequest, validateCommentRequest } from "../utils/validation";

/**
 * Hono router for Google Docs API endpoints.
 * @type {Hono<{ Bindings: Env }>}
 */
export const docsRoutes = new Hono<{ Bindings: Env & Record<string, unknown> }>();

/**
 * @route POST /read
 * @description Reads a Google Docs document and returns its content as an array of paragraphs.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the document's title and paragraphs.
 * @example
 * // Request body
 * {
 *   "documentId": "your-document-id",
 *   "user": "user-identifier"
 * }
 */
docsRoutes.post("/read", async (c) => {
  try {
    const requestData = await c.req.json();
    
    // Validate input
    const validation = validateDocumentReadRequest(requestData);
    if (!validation.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid document request',
          details: validation.errors
        }
      }, 400);
    }

    const { documentId, user } = validation.sanitizedData!;

    const googleApi = new GoogleApiClient(c.env);

    const document: DocsDocument = await googleApi.makeRequest(
      `/docs/v1/documents/${documentId}`,
      { method: "GET" },
      user
    );

    // Extract text content by paragraphs
    const paragraphs: string[] = [];

    if (document.body?.content) {
      for (const element of document.body.content) {
        if (element.paragraph?.elements) {
          let paragraphText = "";
          for (const paragraphElement of element.paragraph.elements) {
            if (paragraphElement.textRun?.content) {
              paragraphText += paragraphElement.textRun.content;
            }
          }
          if (paragraphText.trim()) {
            paragraphs.push(paragraphText.trim());
          }
        }
      }
    }

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        documentId,
        title: document.title,
        revisionId: document.revisionId,
        paragraphs,
        paragraphCount: paragraphs.length,
        fullText: paragraphs.join('\n\n'),
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Docs read error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Google Docs document",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /read/json
 * @description Reads a Google Docs document and returns its full JSON structure.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the complete document structure.
 * @example
 * // Request body
 * {
 *   "documentId": "your-document-id",
 *   "user": "user-identifier"
 * }
 */
docsRoutes.post("/read/json", async (c) => {
  try {
    const { documentId, user } = await c.req.json();

    if (!documentId) {
      return c.json({ error: "documentId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const document: DocsDocument = await googleApi.makeRequest(
      `/docs/v1/documents/${documentId}`,
      { method: "GET" },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        documentId,
        title: document.title,
        revisionId: document.revisionId,
        structure: document.body,
        metadata: {
          contentElements: document.body?.content?.length || 0,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Docs read JSON error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Google Docs document as JSON",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /create/markdown
 * @description Creates a new Google Docs document from a Markdown string.
 * Note: The Markdown parsing is very basic and only supports simple formatting.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with the details of the newly created document.
 * @example
 * // Request body
 * {
 *   "title": "My Markdown Doc",
 *   "markdown": "# Hello\n\nThis is a test.",
 *   "user": "user-identifier"
 * }
 */
docsRoutes.post("/create/markdown", async (c) => {
  try {
    const { title, markdown, user } = await c.req.json();

    if (!title || !markdown) {
      return c.json({ error: "title and markdown parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Create empty document
    const document = await googleApi.makeRequest(
      `/docs/v1/documents`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
        }),
      },
      user
    );

    // Convert markdown to simple text (basic implementation)
    // In a real implementation, you'd want a proper markdown parser
    let text = markdown
      .replace(/^# (.*$)/gim, '$1\n') // Headers
      .replace(/^## (.*$)/gim, '$1\n')
      .replace(/^### (.*$)/gim, '$1\n')
      .replace(/\*\*(.*?)\*\*/gim, '$1') // Bold
      .replace(/\*(.*?)\*/gim, '$1') // Italic
      .replace(/^\* (.*$)/gim, '• $1') // Bullet points
      .replace(/^\d+\. (.*$)/gim, '$1'); // Numbered lists

    // Insert text content
    if (text.trim()) {
      await googleApi.makeRequest(
        `/docs/v1/documents/${document.documentId}:batchUpdate`,
        {
          method: "POST",
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: text,
                },
              },
            ],
          }),
        },
        user
      );
    }

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        documentId: document.documentId,
        title: document.title,
        revisionId: document.revisionId,
        webViewLink: `https://docs.google.com/document/d/${document.documentId}/edit`,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Docs create from markdown error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create Google Docs document from markdown",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /comments/create
 * @description Creates a comment in a Google Docs document using the Drive API v3.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with the details of the created comment.
 * @example
 * // Request body
 * {
 *   "documentId": "your-document-id",
 *   "comment": "This is a comment.",
 *   "textToComment": "specific text", // Optional
 *   "user": "user-identifier"
 * }
 */
docsRoutes.post("/comments/create", async (c) => {
  try {
    const requestData = await c.req.json();
    
    // Validate input
    const validation = validateCommentRequest(requestData);
    if (!validation.isValid) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid comment request',
          details: validation.errors
        }
      }, 400);
    }

    const { comment, textToComment, user } = validation.sanitizedData!;
    const { documentId } = requestData; // documentId validation is handled separately

    const googleApi = new GoogleApiClient(c.env);

    // Use Drive API v3 for comment creation
    let commentRequest: any = {
      content: comment,
    };

    // If specific text is provided, find it and anchor the comment
    if (textToComment) {
      const document: DocsDocument = await googleApi.makeRequest(
        `/docs/v1/documents/${documentId}`,
        { method: "GET" },
        user
      );

      // Simple text search to find anchor point
      let fullText = "";
      let searchIndex = 1;

      if (document.body?.content) {
        for (const element of document.body.content) {
          if (element.paragraph?.elements) {
            for (const paragraphElement of element.paragraph.elements) {
              if (paragraphElement.textRun?.content) {
                const content = paragraphElement.textRun.content;
                const foundIndex = content.indexOf(textToComment);
                if (foundIndex !== -1) {
                  commentRequest.quotedFileContent = {
                    value: textToComment
                  };
                  break;
                }
                searchIndex += content.length;
              }
            }
            if (commentRequest.quotedFileContent) break;
          }
        }
      }
    }

    // Use Drive API v3 for comment creation
    const commentResult = await googleApi.makeRequest(
      `/drive/v3/files/${documentId}/comments`,
      {
        method: "POST",
        body: JSON.stringify(commentRequest),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        documentId,
        commentId: commentResult.id,
        content: comment,
        textToComment,
        hasAnchor: !!commentRequest.quotedFileContent,
        author: commentResult.author,
        createdTime: commentResult.createdTime,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Docs create comment error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create comment in Google Docs document",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /comments/read
 * @description Reads all comments from a Google Docs document using the Drive API v3.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing a list of comments.
 * @example
 * // Request body
 * {
 *   "documentId": "your-document-id",
 *   "user": "user-identifier"
 * }
 */
docsRoutes.post("/comments/read", async (c) => {
  try {
    const { documentId, user } = await c.req.json();

    if (!documentId) {
      return c.json({ error: "documentId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Use Drive API v3 for comment reading
    const commentsResult = await googleApi.makeRequest(
      `/drive/v3/files/${documentId}/comments`,
      { method: "GET" },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        documentId,
        comments: commentsResult.comments || [],
        commentCount: commentsResult.comments?.length || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Docs read comments error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read comments from Google Docs document",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

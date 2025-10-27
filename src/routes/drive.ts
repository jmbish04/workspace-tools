/**
 * @module driveRoutes
 * @description Provides Hono routes for interacting with the Google Drive API.
 * This module includes functionalities for searching files and reading file content,
 * with special handling for exporting Google Workspace documents.
 * @requires hono
 * @requires ../index
 * @requires ../types
 * @requires ../utils/google-api
 */

import { Hono } from "hono";
import { Env } from "../types";
import { DriveFile, DriveSearchResult, WorkspaceToolResponse } from "../types";
import { GoogleApiClient } from "../utils/google-api";

/**
 * Hono router for Google Drive API endpoints.
 * @type {Hono<{ Bindings: Env }>}
 */
export const driveRoutes = new Hono<{ Bindings: Env & Record<string, unknown> }>();

/**
 * @route POST /search
 * @description Searches for files in Google Drive based on a query and optional type filter.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing a list of files matching the search criteria.
 * @example
 * // Request body
 * {
 *   "query": "report",
 *   "type": "spreadsheet", // Optional: document, presentation, image, etc.
 *   "user": "user-identifier",
 *   "maxResults": 20
 * }
 */
driveRoutes.post("/search", async (c) => {
  try {
    const { query, type, user, maxResults = 20 } = await c.req.json();

    if (!query) {
      return c.json({ error: "Query parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Build search query with type filter
    let searchQuery = `name contains '${query}' or fullText contains '${query}'`;

    if (type) {
      const mimeTypeMap: { [key: string]: string } = {
        document: "application/vnd.google-apps.document",
        spreadsheet: "application/vnd.google-apps.spreadsheet",
        presentation: "application/vnd.google-apps.presentation",
        image: "image/",
        video: "video/",
        pdf: "application/pdf",
        folder: "application/vnd.google-apps.folder"
      };

      if (mimeTypeMap[type]) {
        if (type === "image" || type === "video") {
          searchQuery += ` and mimeType contains '${mimeTypeMap[type]}'`;
        } else {
          searchQuery += ` and mimeType='${mimeTypeMap[type]}'`;
        }
      }
    }

    // Add trashed filter
    searchQuery += " and trashed=false";

    const searchParams = new URLSearchParams({
      q: searchQuery,
      pageSize: Math.min(maxResults, 100).toString(),
      fields: "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,owners),nextPageToken",
    });

    const result: DriveSearchResult = await googleApi.makeRequest(
      `/drive/v3/files?${searchParams.toString()}`,
      { method: "GET" },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        files: result.files || [],
        fileCount: result.files?.length || 0,
        nextPageToken: result.nextPageToken,
        query: searchQuery,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Drive search error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to search Google Drive",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /file/read
 * @description Reads the content of a file from Google Drive.
 * For Google Workspace files (Docs, Sheets, Slides), it exports them to a specified format.
 * For other text-based files, it returns the raw content.
 * For binary files, it returns metadata and a download link.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the file's content and metadata.
 * @example
 * // Request body for a Google Doc
 * {
 *   "fileId": "your-doc-id",
 *   "user": "user-identifier",
 *   "format": "txt" // e.g., pdf, docx, txt, html
 * }
 * @example
 * // Request body for a regular text file
 * {
 *   "fileId": "your-file-id",
 *   "user": "user-identifier"
 * }
 */
driveRoutes.post("/file/read", async (c) => {
  try {
    const { fileId, user, format } = await c.req.json();

    if (!fileId) {
      return c.json({ error: "fileId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get file metadata first
    const fileMetadata: DriveFile = await googleApi.makeRequest(
      `/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink`,
      { method: "GET" },
      user
    );

    let content: any = null;
    let contentType = fileMetadata.mimeType;

    // Handle Google Workspace native files
    if (fileMetadata.mimeType.includes("google-apps")) {
      if (!format) {
        return c.json({
          error: "Format parameter required for Google Workspace files. Options: pdf, docx, xlsx, pptx, txt, html"
        }, 400);
      }

      const exportMimeTypes: { [key: string]: string } = {
        pdf: "application/pdf",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        txt: "text/plain",
        html: "text/html"
      };

      if (!exportMimeTypes[format]) {
        return c.json({ error: `Unsupported export format: ${format}` }, 400);
      }

      const exportResponse = await googleApi.makeRequest(
        `/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeTypes[format])}`,
        { method: "GET" },
        user
      );

      content = exportResponse;
      contentType = exportMimeTypes[format];
    } else {
      // Regular file download
      const downloadResponse = await googleApi.makeRequest(
        `/drive/v3/files/${fileId}?alt=media`,
        { method: "GET" },
        user
      );

      // For text files, return as string
      if (fileMetadata.mimeType.startsWith("text/") || fileMetadata.mimeType === "application/json") {
        content = downloadResponse;
      } else {
        // For binary files, return metadata only
        content = {
          message: "Binary file - content not included",
          downloadUrl: `/drive/v3/files/${fileId}?alt=media`,
          size: fileMetadata.size
        };
      }
    }

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        fileId,
        name: fileMetadata.name,
        mimeType: fileMetadata.mimeType,
        contentType,
        size: fileMetadata.size,
        content,
        webViewLink: fileMetadata.webViewLink,
        createdTime: fileMetadata.createdTime,
        modifiedTime: fileMetadata.modifiedTime,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Drive read file error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Google Drive file",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @module slidesRoutes
 * @description Provides Hono routes for interacting with the Google Slides API.
 * This module includes functionalities for creating presentations, reading slides,
 * updating content, and inserting new slides.
 * @requires hono
 * @requires ../index
 * @requires ../types
 * @requires ../utils/google-api
 */

import { Hono } from "hono";
import { Env } from "../types";
import { SlidesPresentation, WorkspaceToolResponse } from "../types";
import { GoogleApiClient } from "../utils/google-api";

/**
 * Hono router for Google Slides API endpoints.
 * @type {Hono<{ Bindings: Env }>}
 */
export const slidesRoutes = new Hono<{ Bindings: Env & Record<string, unknown> }>();

/**
 * @route POST /create
 * @description Creates a new Google Slides presentation with a specified title.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the new presentation's details.
 * @example
 * // Request body
 * {
 *   "title": "My New Presentation",
 *   "user": "user-identifier"
 * }
 */
slidesRoutes.post("/create", async (c) => {
  try {
    const { title, user } = await c.req.json();

    if (!title) {
      return c.json({ error: "title parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const presentation = await googleApi.makeRequest(
      `/slides/v1/presentations`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
        }),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        presentationId: presentation.presentationId,
        title: presentation.title,
        webViewLink: `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`,
        slideCount: presentation.slides?.length || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Slides create error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create Google Slides presentation",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /read
 * @description Reads the content of an entire Google Slides presentation, extracting text from each slide.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with the presentation's metadata and extracted text content.
 * @example
 * // Request body
 * {
 *   "presentationId": "your-presentation-id",
 *   "user": "user-identifier"
 * }
 */
slidesRoutes.post("/read", async (c) => {
  try {
    const { presentationId, user } = await c.req.json();

    if (!presentationId) {
      return c.json({ error: "presentationId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const presentation: SlidesPresentation = await googleApi.makeRequest(
      `/slides/v1/presentations/${presentationId}`,
      { method: "GET" },
      user
    );

    // Extract text content from slides
    const slides = presentation.slides?.map((slide, index) => {
      let textContent = "";

      slide.pageElements?.forEach(element => {
        if (element.shape?.text?.textElements) {
          element.shape.text.textElements.forEach(textElement => {
            if (textElement.textRun?.content) {
              textContent += textElement.textRun.content;
            }
          });
        }
      });

      return {
        slideIndex: index,
        objectId: slide.objectId,
        textContent: textContent.trim(),
      };
    }) || [];

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        presentationId,
        title: presentation.title,
        revisionId: presentation.revisionId,
        slides,
        slideCount: slides.length,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Slides read error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Google Slides presentation",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /slide/read
 * @description Reads the text content of a specific slide within a presentation.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with the slide's title, text content, and other details.
 * @example
 * // Request body
 * {
 *   "presentationId": "your-presentation-id",
 *   "slideIndex": 0,
 *   "user": "user-identifier"
 * }
 */
slidesRoutes.post("/slide/read", async (c) => {
  try {
    const { presentationId, slideIndex, user } = await c.req.json();

    if (!presentationId || slideIndex === undefined) {
      return c.json({ error: "presentationId and slideIndex parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const presentation: SlidesPresentation = await googleApi.makeRequest(
      `/slides/v1/presentations/${presentationId}`,
      { method: "GET" },
      user
    );    if (!presentation.slides || slideIndex >= presentation.slides.length) {
      return c.json({ error: "Slide index out of range" }, 404);
    }

    const slide = presentation.slides[slideIndex];
    if (!slide) {
      return c.json({ error: "Slide not found" }, 404);
    }

    let textContent = "";
    let title = "";

    // Extract text content and identify title
    slide.pageElements?.forEach(element => {
      if (element.shape?.text?.textElements) {
        let elementText = "";
        element.shape.text.textElements.forEach(textElement => {
          if (textElement.textRun?.content) {
            elementText += textElement.textRun.content;
          }
        });

        // First text element is often the title
        if (!title && elementText.trim()) {
          title = elementText.trim();
        } else {
          textContent += elementText;
        }
      }
    });

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        presentationId,
        slideIndex,
        objectId: slide.objectId,
        title: title || `Slide ${slideIndex + 1}`,
        textContent: textContent.trim(),
        elementCount: slide.pageElements?.length || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Slides read slide error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Google Slides slide",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /slide/update
 * @description Updates the content of a specific slide by clearing existing text and inserting new content.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response confirming the update.
 * @example
 * // Request body
 * {
 *   "presentationId": "your-presentation-id",
 *   "slideIndex": 0,
 *   "content": {
 *     "title": "New Title",
 *     "text": "New body text."
 *   },
 *   "user": "user-identifier"
 * }
 */
slidesRoutes.post("/slide/update", async (c) => {
  try {
    const { presentationId, slideIndex, content, user } = await c.req.json();

    if (!presentationId || slideIndex === undefined || !content) {
      return c.json({ error: "presentationId, slideIndex, and content parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get current presentation
    const presentation: SlidesPresentation = await googleApi.makeRequest(
      `/slides/v1/presentations/${presentationId}`,
      { method: "GET" },
      user
    );

    if (!presentation.slides || slideIndex >= presentation.slides.length) {
      return c.json({ error: "Slide index out of range" }, 404);
    }

    const slide = presentation.slides[slideIndex];
    if (!slide) {
      return c.json({ error: "Slide not found" }, 404);
    }

    const requests: any[] = [];

    // Clear existing text content
    slide.pageElements?.forEach(element => {
      if (element.shape?.text && element.shape.objectId) {
        requests.push({
          deleteText: {
            objectId: element.shape.objectId,
            textRange: {
              type: "ALL",
            },
          },
        });
      }
    });

    // Add new content
    if (content.title && slide.pageElements?.[0]?.shape?.objectId) {
      requests.push({
        insertText: {
          objectId: slide.pageElements[0].shape.objectId,
          text: content.title,
        },
      });
    }

    if (content.text && slide.pageElements?.[1]?.shape?.objectId) {
      requests.push({
        insertText: {
          objectId: slide.pageElements[1].shape.objectId,
          text: content.text,
        },
      });
    }

    if (requests.length > 0) {
      await googleApi.makeRequest(
        `/slides/v1/presentations/${presentationId}:batchUpdate`,
        {
          method: "POST",
          body: JSON.stringify({ requests }),
        },
        user
      );
    }

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        presentationId,
        slideIndex,
        updatedElements: requests.length,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Slides update error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to update Google Slides slide",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /slide/insert
 * @description Inserts a new slide with a title and body into a presentation at a specified index.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with details of the newly inserted slide.
 * @example
 * // Request body
 * {
 *   "presentationId": "your-presentation-id",
 *   "insertIndex": 1,
 *   "content": {
 *     "title": "New Slide Title",
 *     "text": "Content for the new slide."
 *   },
 *   "user": "user-identifier"
 * }
 */
slidesRoutes.post("/slide/insert", async (c) => {
  try {
    const { presentationId, insertIndex, content, user } = await c.req.json();

    if (!presentationId || insertIndex === undefined || !content) {
      return c.json({ error: "presentationId, insertIndex, and content parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Create new slide
    const slideId = `slide_${Date.now()}`;
    const titleId = `title_${Date.now()}`;
    const contentId = `content_${Date.now()}`;

    const requests = [
      {
        createSlide: {
          objectId: slideId,
          insertionIndex: insertIndex,
          slideLayoutReference: {
            predefinedLayout: "TITLE_AND_BODY",
          },
        },
      },
    ];

    const result = await googleApi.makeRequest(
      `/slides/v1/presentations/${presentationId}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({ requests }),
      },
      user
    );

    // Add content to the new slide
    const contentRequests = [];

    if (content.title) {
      contentRequests.push({
        insertText: {
          objectId: result.replies[0].createSlide.pageElements[0].objectId,
          text: content.title,
        },
      });
    }

    if (content.text) {
      contentRequests.push({
        insertText: {
          objectId: result.replies[0].createSlide.pageElements[1].objectId,
          text: content.text,
        },
      });
    }

    if (contentRequests.length > 0) {
      await googleApi.makeRequest(
        `/slides/v1/presentations/${presentationId}:batchUpdate`,
        {
          method: "POST",
          body: JSON.stringify({ requests: contentRequests }),
        },
        user
      );
    }

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        presentationId,
        insertIndex,
        slideId,
        title: content.title,
        text: content.text,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Slides insert error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to insert slide in Google Slides",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /comments/create
 * @description Creates a comment on a Google Slides presentation using the Drive API v3.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with the details of the created comment.
 */
slidesRoutes.post("/comments/create", async (c) => {
  try {
    const { presentationId, slideIndex, comment, user } = await c.req.json();

    if (!presentationId || slideIndex === undefined || !comment) {
      return c.json({ error: "presentationId, slideIndex, and comment parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get presentation to find slide object ID
    const presentation: SlidesPresentation = await googleApi.makeRequest(
      `/slides/v1/presentations/${presentationId}`,
      { method: "GET" },
      user
    );

    if (!presentation.slides || slideIndex >= presentation.slides.length) {
      return c.json({ error: "Slide index out of range" }, 404);
    }

    const slide = presentation.slides[slideIndex];

    // Use Drive API v3 for comment creation
    const commentRequest = {
      content: comment,
      quotedFileContent: {
        value: `Slide ${slideIndex + 1}`
      }
    };

    const commentResult = await googleApi.makeRequest(
      `/drive/v3/files/${presentationId}/comments`,
      {
        method: "POST",
        body: JSON.stringify(commentRequest),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        presentationId,
        slideIndex,
        commentId: commentResult.id,
        content: comment,
        author: commentResult.author,
        createdTime: commentResult.createdTime,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Slides create comment error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create comment in Google Slides",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /comments/read
 * @description Reads all comments from a Google Slides presentation using the Drive API v3.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing a list of comments.
 */
slidesRoutes.post("/comments/read", async (c) => {
  try {
    const { presentationId, user } = await c.req.json();

    if (!presentationId) {
      return c.json({ error: "presentationId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Use Drive API v3 for comment reading
    const commentsResult = await googleApi.makeRequest(
      `/drive/v3/files/${presentationId}/comments`,
      { method: "GET" },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        presentationId,
        comments: commentsResult.comments || [],
        commentCount: commentsResult.comments?.length || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Slides read comments error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read comments from Google Slides",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

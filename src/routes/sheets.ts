/**
 * @module sheetsRoutes
 * @description Provides Hono routes for interacting with the Google Sheets API.
 * This module includes functionalities for creating spreadsheets, reading and writing data,
 * managing individual sheets, and handling cell notes (comments).
 * @requires hono
 * @requires ../index
 * @requires ../types
 * @requires ../utils/google-api
 */

import { Hono } from "hono";
import { Env } from "../types";
import { SheetsSpreadsheet, SheetsValues, WorkspaceToolResponse } from "../types";
import { GoogleApiClient } from "../utils/google-api";

/**
 * Hono router for Google Sheets API endpoints.
 * @type {Hono<{ Bindings: Env }>}
 */
export const sheetsRoutes = new Hono<{ Bindings: Env }>();

/**
 * @route POST /create
 * @description Creates a new Google Sheets spreadsheet with a specified title.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the new spreadsheet's details.
 * @example
 * // Request body
 * {
 *   "title": "My New Spreadsheet",
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/create", async (c) => {
  try {
    const { title, user } = await c.req.json();

    if (!title) {
      return c.json({ error: "title parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const spreadsheet = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets`,
      {
        method: "POST",
        body: JSON.stringify({
          properties: {
            title,
          },
        }),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId: spreadsheet.spreadsheetId,
        title: spreadsheet.properties.title,
        webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`,
        sheets: spreadsheet.sheets?.map((sheet: any) => ({
          sheetId: sheet.properties.sheetId,
          title: sheet.properties.title,
        })) || [],
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets create error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create Google Sheets spreadsheet",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /read
 * @description Reads all data from all sheets in a Google Sheets spreadsheet.
 * Note: This can be slow and memory-intensive for large spreadsheets.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with the content of the entire spreadsheet.
 * @example
 * // Request body
 * {
 *   "spreadsheetId": "your-spreadsheet-id",
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/read", async (c) => {
  try {
    const { spreadsheetId, user } = await c.req.json();

    if (!spreadsheetId) {
      return c.json({ error: "spreadsheetId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const spreadsheet: SheetsSpreadsheet = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}?includeGridData=true`,
      { method: "GET" },
      user
    );

    // Extract data from all sheets
    const sheetsData = spreadsheet.sheets?.map((sheet: any) => {
      const data: string[][] = [];

      if (sheet.data?.[0]?.rowData) {
        for (const row of sheet.data[0].rowData) {
          const rowValues: string[] = [];
          if (row.values) {
            for (const cell of row.values) {
              rowValues.push(cell.formattedValue || cell.userEnteredValue?.stringValue || "");
            }
          }
          data.push(rowValues);
        }
      }

      return {
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title,
        data,
        rowCount: data.length,
        columnCount: data[0]?.length || 0,
      };
    }) || [];

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId,
        title: spreadsheet.properties.title,
        sheets: sheetsData,
        sheetCount: sheetsData.length,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets read error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Google Sheets spreadsheet",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /sheets/names
 * @description Retrieves the names and IDs of all sheets within a spreadsheet.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with a list of sheets.
 * @example
 * // Request body
 * {
 *   "spreadsheetId": "your-spreadsheet-id",
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/sheets/names", async (c) => {
  try {
    const { spreadsheetId, user } = await c.req.json();

    if (!spreadsheetId) {
      return c.json({ error: "spreadsheetId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const spreadsheet: SheetsSpreadsheet = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { method: "GET" },
      user
    );

    const sheetNames = spreadsheet.sheets?.map(sheet => ({
      sheetId: sheet.properties.sheetId,
      title: sheet.properties.title,
    })) || [];

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId,
        sheets: sheetNames,
        sheetCount: sheetNames.length,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets get names error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to get sheet names",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /sheet/read
 * @description Reads data from a specific sheet and range within a spreadsheet.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the values from the specified range.
 * @example
 * // Request body
 * {
 *   "spreadsheetId": "your-spreadsheet-id",
 *   "sheetName": "Sheet1",
 *   "range": "A1:B2",
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/sheet/read", async (c) => {
  try {
    const { spreadsheetId, sheetName, range, user } = await c.req.json();

    if (!spreadsheetId || !sheetName) {
      return c.json({ error: "spreadsheetId and sheetName parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const rangeParam = range ? `${sheetName}!${range}` : sheetName;

    const values: SheetsValues = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeParam)}`,
      { method: "GET" },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId,
        sheetName,
        range: values.range,
        values: values.values || [],
        rowCount: values.values?.length || 0,
        columnCount: values.values?.[0]?.length || 0,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets read sheet error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read Google Sheets sheet",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /sheet/create
 * @description Creates a new sheet (tab) within an existing spreadsheet.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with the details of the newly created sheet.
 * @example
 * // Request body
 * {
 *   "spreadsheetId": "your-spreadsheet-id",
 *   "sheetName": "New Sheet",
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/sheet/create", async (c) => {
  try {
    const { spreadsheetId, sheetName, user } = await c.req.json();

    if (!spreadsheetId || !sheetName) {
      return c.json({ error: "spreadsheetId and sheetName parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const result = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        }),
      },
      user
    );

    const newSheet = result.replies?.[0]?.addSheet?.properties;

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId,
        sheetId: newSheet?.sheetId,
        sheetName: newSheet?.title,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets create sheet error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create new sheet",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /sheet/update
 * @description Updates a range of cells in a specific sheet with new values.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response confirming the number of updated cells.
 * @example
 * // Request body
 * {
 *   "spreadsheetId": "your-spreadsheet-id",
 *   "sheetName": "Sheet1",
 *   "range": "A1",
 *   "values": [["new value"]],
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/sheet/update", async (c) => {
  try {
    const { spreadsheetId, sheetName, range, values, user } = await c.req.json();

    if (!spreadsheetId || !sheetName || !range || !values) {
      return c.json({ error: "spreadsheetId, sheetName, range, and values parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const rangeParam = `${sheetName}!${range}`;

    const result = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeParam)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({
          range: rangeParam,
          majorDimension: "ROWS",
          values,
        }),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId,
        sheetName,
        range: rangeParam,
        updatedCells: result.updatedCells,
        updatedColumns: result.updatedColumns,
        updatedRows: result.updatedRows,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets update error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to update Google Sheets data",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /sheet/insert
 * @description Inserts new rows with data at a specific index in a sheet.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response confirming the number of inserted rows.
 * @example
 * // Request body
 * {
 *   "spreadsheetId": "your-spreadsheet-id",
 *   "sheetName": "Sheet1",
 *   "insertIndex": 1,
 *   "values": [["new", "row"]],
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/sheet/insert", async (c) => {
  try {
    const { spreadsheetId, sheetName, insertIndex, values, user } = await c.req.json();

    if (!spreadsheetId || !sheetName || insertIndex === undefined || !values) {
      return c.json({ error: "spreadsheetId, sheetName, insertIndex, and values parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // First get the sheet ID
    const spreadsheet: SheetsSpreadsheet = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { method: "GET" },
      user
    );

    const sheet = spreadsheet.sheets?.find(s => s.properties.title === sheetName);
    if (!sheet) {
      return c.json({ error: `Sheet '${sheetName}' not found` }, 404);
    }

    // Insert rows
    const requests = [
      {
        insertDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: "ROWS",
            startIndex: insertIndex,
            endIndex: insertIndex + values.length,
          },
        },
      },
    ];

    await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({ requests }),
      },
      user
    );

    // Update the inserted rows with values
    const rangeParam = `${sheetName}!A${insertIndex + 1}`;

    await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(rangeParam)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({
          range: rangeParam,
          majorDimension: "ROWS",
          values,
        }),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId,
        sheetName,
        insertIndex,
        insertedRows: values.length,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets insert rows error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to insert rows in Google Sheets",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /comments/create
 * @description Creates a note on a specific cell in a sheet.
 * Note: This creates a "note" (black triangle), not a threaded "comment".
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response confirming the creation of the note.
 * @example
 * // Request body
 * {
 *   "spreadsheetId": "your-spreadsheet-id",
 *   "sheetName": "Sheet1",
 *   "cell": "A1",
 *   "comment": "This is a note.",
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/comments/create", async (c) => {
  try {
    const { spreadsheetId, sheetName, cell, comment, user } = await c.req.json();

    if (!spreadsheetId || !sheetName || !cell || !comment) {
      return c.json({ error: "spreadsheetId, sheetName, cell, and comment parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get sheet ID
    const spreadsheet: SheetsSpreadsheet = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      { method: "GET" },
      user
    );

    const sheet = spreadsheet.sheets?.find(s => s.properties.title === sheetName);
    if (!sheet) {
      return c.json({ error: `Sheet '${sheetName}' not found` }, 404);
    }

    // Parse cell reference (e.g., "A1" -> {row: 0, col: 0})
    const cellMatch = cell.match(/^([A-Z]+)(\d+)$/);
    if (!cellMatch) {
      return c.json({ error: "Invalid cell reference format" }, 400);
    }

    const columnLetters = cellMatch[1];
    const rowNumber = parseInt(cellMatch[2]) - 1;

    // Convert column letters to number
    let columnNumber = 0;
    for (let i = 0; i < columnLetters.length; i++) {
      columnNumber = columnNumber * 26 + (columnLetters.charCodeAt(i) - 64);
    }
    columnNumber -= 1;

    const commentRequest = {
      requests: [
        {
          addNote: {
            location: {
              sheetId: sheet.properties.sheetId,
              rowIndex: rowNumber,
              columnIndex: columnNumber,
            },
            note: comment,
          },
        },
      ],
    };

    await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify(commentRequest),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId,
        sheetName,
        cell,
        comment,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets create comment error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create comment in Google Sheets",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /comments/read
 * @description Reads all cell notes from a spreadsheet.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing a list of all notes.
 * @example
 * // Request body
 * {
 *   "spreadsheetId": "your-spreadsheet-id",
 *   "user": "user-identifier"
 * }
 */
sheetsRoutes.post("/comments/read", async (c) => {
  try {
    const { spreadsheetId, user } = await c.req.json();

    if (!spreadsheetId) {
      return c.json({ error: "spreadsheetId parameter is required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get spreadsheet with notes/comments
    const spreadsheet = await googleApi.makeRequest(
      `/sheets/v4/spreadsheets/${spreadsheetId}?includeGridData=true&fields=sheets.data.rowData.values.note`,
      { method: "GET" },
      user
    );

    const comments: any[] = [];

    spreadsheet.sheets?.forEach((sheet: any, sheetIndex: number) => {
      sheet.data?.[0]?.rowData?.forEach((row: any, rowIndex: number) => {
        row.values?.forEach((cell: any, colIndex: number) => {
          if (cell.note) {
            // Convert back to cell reference
            const columnLetter = String.fromCharCode(65 + colIndex);
            const cellRef = `${columnLetter}${rowIndex + 1}`;

            comments.push({
              sheetName: sheet.properties?.title || `Sheet${sheetIndex + 1}`,
              cell: cellRef,
              note: cell.note,
            });
          }
        });
      });
    });

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        spreadsheetId,
        comments,
        commentCount: comments.length,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Sheets read comments error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to read comments from Google Sheets",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

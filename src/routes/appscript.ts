/**
 * @module appsScriptRoutes
 * @description Provides Hono routes for interacting with the Google Apps Script API.
 * This module allows for the creation, reading, updating, and deployment of Apps Script projects.
 * It includes helpers for scaffolding new projects, particularly web apps.
 * @requires hono
 * @requires ../index
 * @requires ../types
 * @requires ../utils/google-api
 */

import { Hono } from "hono";
import { Env } from "../types";
import { WorkspaceToolResponse } from "../types";
import { GoogleApiClient } from "../utils/google-api";
import { templateManager } from "../utils/html-template-manager-clean";

/**
 * Hono router for Google Apps Script API endpoints.
 * @type {Hono<{ Bindings: Env }>}
 */
export const appsScriptRoutes = new Hono<{ Bindings: Env }>();

/**
 * @route POST /create
 * @description Creates a new Google Apps Script project with the provided title and code.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response containing the new project's details or an error.
 * @example
 * // Request body
 * {
 *   "title": "My New Script",
 *   "code": "function myFunction() { Logger.log('Hello, world!'); }",
 *   "user": "user-identifier"
 * }
 */
appsScriptRoutes.post("/create", async (c) => {
  try {
    const { title, code, user } = await c.req.json();

    if (!title || !code) {
      return c.json({ error: "title and code parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    const project = await googleApi.makeRequest(
      `/script/v1/projects`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          files: [
            {
              name: "Code",
              type: "SERVER_JS",
              source: code,
            },
          ],
        }),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        scriptId: project.scriptId,
        title: project.title,
        createTime: project.createTime,
        webViewLink: `https://script.google.com/d/${project.scriptId}/edit`,
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Apps Script create error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create Google Apps Script project",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /webapp/create
 * @description Creates a new Google Apps Script project from a default web app template.
 * The template includes basic routing and best practice comments for LLM usage.
 * @param {object} c - The Hono context object.
 * @returns {Promise<Response>} A JSON response with the new web app project's details and deployment instructions.
 * @example
 * // Request body
 * {
 *   "title": "My Web App",
 *   "description": "A simple web app.",
 *   "user": "user-identifier"
 * }
 */
appsScriptRoutes.post("/webapp/create", async (c) => {
  try {
    const { title, description, user } = await c.req.json();

    if (!title || !description) {
      return c.json({ error: "title and description parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Default webapp template with LLM usage rules
    const webappCode = `
/**
 * ${description}
 *
 * LLM USAGE RULES FOR GOOGLE APPS SCRIPT:
 *
 * 1. DOGET/DOPOST FUNCTIONS:
 *    - Always use doGet(e) for GET requests and doPost(e) for POST requests
 *    - Access parameters via e.parameter.paramName or e.postData
 *    - Return HtmlService.createHtmlOutput() or ContentService.createTextOutput()
 *
 * 2. HTML TEMPLATES WITH INCLUDE SYSTEM:
 *    - Use HtmlService.createTemplateFromFile() for HTML files
 *    - Set template options: template.options = { APP_TITLE: "My App", APP_DESCRIPTION: "..." }
 *    - Use <?!= options.VARIABLE_NAME || "default" ?> in HTML templates
 *    - Include files with <?!= include('filename'); ?> (without .html extension)
 *    - Separate files: inc_styles.html (CSS), inc_clientJS.html (JavaScript)
 *    - Call template.evaluate() to render the final HTML
 *
 * 3. TEMPLATE STRUCTURE:
 *    - main.html: Base template with header, content area, footer
 *    - inc_styles.html: All CSS styling, responsive design, components
 *    - inc_clientJS.html: All client-side JavaScript, google.script.run helpers
 *    - Use options object to pass data: options.APP_TITLE, options.APP_DESCRIPTION, etc.
 *
 * 4. CLIENT-SERVER COMMUNICATION:
 *    - Use google.script.run for client-to-server calls
 *    - Add .withSuccessHandler() and .withFailureHandler() for async responses
 *    - Example: google.script.run.withSuccessHandler(success).withFailureHandler(error).serverFunction(params)
 *
 * 5. PERMISSIONS:
 *    - Request only necessary scopes in manifest (appsscript.json)
 *    - Common scopes: drive, gmail, sheets, docs, calendar
 *
 * 6. DEPLOYMENT:
 *    - Use "New deployment" with type "Web app"
 *    - Set execute as "Me" and access to "Anyone" for public access
 *    - Always deploy as new version to maintain stable URLs
 *
 * 7. BEST PRACTICES:
 *    - Use PropertiesService for configuration
 *    - Implement error handling with try-catch
 *    - Use Utilities.sleep() for rate limiting
 *    - Cache data with CacheService when possible
 *    - Keep HTML, CSS, and JS in separate include files for maintainability
 */

// Include function for template system
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'home';

    switch(action) {
      case 'home':
        return showHomePage();
      case 'api':
        return handleApiRequest(e);
      default:
        return createErrorResponse('Unknown action: ' + action);
    }
  } catch (error) {
    console.error('doGet error:', error);
    return createErrorResponse('Server error: ' + error.message);
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents || '{}');
    const action = postData.action || e.parameter.action;

    switch(action) {
      case 'submit':
        return handleFormSubmission(postData);
      case 'webhook':
        return handleWebhook(postData);
      default:
        return createJsonResponse({error: 'Unknown action: ' + action});
    }
  } catch (error) {
    console.error('doPost error:', error);
    return createJsonResponse({error: 'Server error: ' + error.message});
  }
}

function showHomePage() {
  // Create template from file and set options
  const template = HtmlService.createTemplateFromFile('main');

  // Set template options/variables
  template.options = {
    APP_TITLE: '${title}',
    APP_DESCRIPTION: '${description}',
    MAIN_CONTENT: \`
      <div class="card">
        <div class="card-header">
          <h3>Welcome to your Web App</h3>
        </div>
        <div class="card-body">
          <p>This is a sample web application built with Google Apps Script.</p>
          <h4>API Endpoints:</h4>
          <ul>
            <li><code>?action=api&method=status</code> - Get status</li>
            <li><code>POST with action=submit</code> - Submit data</li>
          </ul>
          <button class="btn btn-primary" onclick="testApi()">Test API</button>
          <div id="result" class="mt-3"></div>
        </div>
      </div>
    \`
  };

  // Evaluate template and return HTML output
  const htmlOutput = template.evaluate();
  return htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
`;

    const project = await googleApi.makeRequest(
      `/script/v1/projects`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          files: [
            {
              name: "Code",
              type: "SERVER_JS",
              source: webappCode,
            },
          ],
        }),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        scriptId: project.scriptId,
        title: project.title,
        description,
        createTime: project.createTime,
        webViewLink: `https://script.google.com/d/${project.scriptId}/edit`,
        deploymentInstructions: [
          "1. Open the script in Google Apps Script editor",
          "2. Click 'Deploy' > 'New deployment'",
          "3. Choose type 'Web app'",
          "4. Set 'Execute as' to 'Me'",
          "5. Set 'Who has access' as needed",
          "6. Click 'Deploy' to get the web app URL"
        ],
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Apps Script create webapp error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create Google Apps Script web app",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * @route POST /webapp/create-with-templates
 * @description Creates a complete Google Apps Script web app project with template files.
 * This demonstrates the proper way to use Apps Script templates with the include system,
 * options object setup, and separate HTML files for styles and JavaScript.
 * @example
 * // Request body
 * {
 *   "title": "My Template Web App",
 *   "description": "A web app using the template system",
 *   "user": "user-identifier",
 *   "options": {
 *     "APP_TITLE": "Custom App Title",
 *     "APP_DESCRIPTION": "Custom description"
 *   }
 * }
 */
appsScriptRoutes.post("/webapp/create-with-templates", async (c) => {
  try {
    const { title, description, user, options = {} } = await c.req.json();

    if (!title || !description) {
      return c.json({ error: "title and description parameters are required" }, 400);
    }

    const googleApi = new GoogleApiClient(c.env);

    // Get template content using the correct method
    const mainHtml = templateManager.getRawTemplateContent('main.html');
    const stylesHtml = templateManager.getRawTemplateContent('inc_styles.html');
    const clientJsHtml = templateManager.getRawTemplateContent('inc_clientJS.html');

    // Create the main Apps Script code that properly uses templates
    const mainCode = `/**
 * ${description}
 *
 * TEMPLATE SYSTEM USAGE DEMONSTRATION:
 *
 * This Apps Script project demonstrates the proper way to use HTML templates
 * with the include system and options object for dynamic content.
 *
 * Key concepts:
 * 1. HtmlService.createTemplateFromFile() creates a template object
 * 2. template.options = {} sets variables accessible in HTML as <?!= options.VARIABLE ?>
 * 3. include() function loads other HTML files (styles, JavaScript)
 * 4. template.evaluate() renders the final HTML with all includes and variables
 */

// Include function for template system - REQUIRED for <?!= include() ?>
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'home';

    switch(action) {
      case 'home':
        return showHomePage();
      case 'api':
        return handleApiRequest(e);
      default:
        return createErrorResponse('Unknown action: ' + action);
    }
  } catch (error) {
    console.error('doGet error:', error);
    return createErrorResponse('Server error: ' + error.message);
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents || '{}');
    const action = postData.action || e.parameter.action;

    switch(action) {
      case 'submit':
        return handleFormSubmission(postData);
      case 'saveUserData':
        return saveUserData(postData);
      default:
        return createJsonResponse({error: 'Unknown action: ' + action});
    }
  } catch (error) {
    console.error('doPost error:', error);
    return createJsonResponse({error: 'Server error: ' + error.message});
  }
}

function showHomePage() {
  // Create template from main HTML file
  const template = HtmlService.createTemplateFromFile('main');

  // Set template options - these become available as options.VARIABLE in HTML
  template.options = {
    APP_TITLE: '${options.APP_TITLE || title}',
    APP_DESCRIPTION: '${options.APP_DESCRIPTION || description}',
    MAIN_CONTENT: \`
      <div class="row">
        <div class="col-6">
          <div class="card">
            <div class="card-header">
              <h3>Sample Form</h3>
            </div>
            <div class="card-body">
              <form id="sampleForm" data-server-function="saveUserData">
                <div class="form-group">
                  <label class="form-label" for="name">Name *</label>
                  <input type="text" id="name" name="name" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label" for="email">Email *</label>
                  <input type="email" id="email" name="email" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary">Submit</button>
              </form>
            </div>
          </div>
        </div>
        <div class="col-6">
          <div class="card">
            <div class="card-header">
              <h3>Quick Actions</h3>
            </div>
            <div class="card-body">
              <button class="btn btn-success mb-2" data-action="getStatus">Check Status</button>
              <button class="btn btn-secondary" data-action="fetchData">Load Data</button>
            </div>
          </div>
        </div>
      </div>
    \`
  };

  // Evaluate template with all includes and variables
  const htmlOutput = template.evaluate();
  return htmlOutput
    .setTitle(template.options.APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function handleApiRequest(e) {
  const method = e.parameter.method || 'status';

  switch(method) {
    case 'status':
      return createJsonResponse({
        status: 'active',
        timestamp: new Date().toISOString(),
        title: '${title}',
        description: '${description}'
      });
    default:
      return createJsonResponse({error: 'Unknown API method: ' + method});
  }
}

function handleFormSubmission(data) {
  return createJsonResponse({
    success: true,
    message: 'Form submitted successfully',
    received: data,
    timestamp: new Date().toISOString()
  });
}

function saveUserData(data) {
  // Example server function called from client
  try {
    // Here you would typically save to a spreadsheet, database, etc.
    console.log('Saving user data:', data);

    return {
      success: true,
      message: 'User data saved successfully',
      data: data,
      savedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Server functions callable from client via google.script.run
function getStatus() {
  return {
    status: 'online',
    timestamp: new Date().toISOString(),
    message: 'Server is running normally'
  };
}

function fetchData() {
  return {
    data: [
      { id: 1, name: 'Sample Item 1', status: 'active' },
      { id: 2, name: 'Sample Item 2', status: 'inactive' }
    ],
    timestamp: new Date().toISOString()
  };
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  const template = HtmlService.createTemplateFromFile('main');
  template.options = {
    APP_TITLE: 'Error',
    APP_DESCRIPTION: 'An error occurred',
    MAIN_CONTENT: \`
      <div class="error">
        <h3>⚠️ Error</h3>
        <p>\${message}</p>
        <button onclick="history.back()" class="btn btn-secondary">Go Back</button>
      </div>
    \`
  };

  return template.evaluate();
}`;

    // Create the project with multiple files
    const files = [
      {
        name: "Code",
        type: "SERVER_JS",
        source: mainCode,
      },
      {
        name: "main",
        type: "HTML",
        source: mainHtml,
      },
      {
        name: "inc_styles",
        type: "HTML",
        source: stylesHtml,
      },
      {
        name: "inc_clientJS",
        type: "HTML",
        source: clientJsHtml,
      }
    ];

    const project = await googleApi.makeRequest(
      `/script/v1/projects`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          files,
        }),
      },
      user
    );

    const response: WorkspaceToolResponse = {
      success: true,
      data: {
        scriptId: project.scriptId,
        title: project.title,
        createTime: project.createTime,
        webViewLink: `https://script.google.com/d/${project.scriptId}/edit`,
        deploymentInstructions: {
          step1: "Click 'Deploy' > 'New deployment'",
          step2: "Select type 'Web app'",
          step3: "Set 'Execute as' to 'Me'",
          step4: "Set 'Who has access' to 'Anyone'",
          step5: "Click 'Deploy' and copy the web app URL"
        },
        templateSystemInfo: {
          mainTemplate: "main.html - Base template with options variables",
          includes: [
            "inc_styles.html - All CSS styling and responsive design",
            "inc_clientJS.html - Client-side JavaScript with google.script.run helpers"
          ],
          optionsUsage: "Set template.options = { APP_TITLE: 'value', ... } before template.evaluate()",
          includeFunction: "include() function required for <?!= include('filename'); ?> tags"
        },
        filesCreated: files.map(f => f.name)
      },
      timestamp: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error: any) {
    console.error("Template webapp creation error:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to create template web app",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

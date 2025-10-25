export interface TemplateVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface TemplateConfig {
  templates: Record<string, {
    file: string;
    description: string;
    variables: string[];
  }>;
  includes: Record<string, {
    file: string;
    description: string;
  }>;
  defaultVariables: Record<string, string>;
}

// Template configuration - references external files only
const DEFAULT_CONFIG: TemplateConfig = {
  templates: {
    main: {
      file: "main.html",
      description: "Basic SPA skeleton with header, main content area, footer, loading states, and error handling",
      variables: [
        "APP_TITLE",
        "APP_DESCRIPTION",
        "MAIN_CONTENT"
      ]
    },
    example_spa: {
      file: "example_spa.html",
      description: "Complete example SPA with forms, buttons, tables, and interactive elements",
      variables: [
        "APP_TITLE",
        "APP_DESCRIPTION",
        "APP_VERSION",
        "LAST_UPDATED",
        "ENVIRONMENT"
      ]
    }
  },
  includes: {
    inc_styles: {
      file: "inc_styles.html",
      description: "Comprehensive CSS styling with responsive design, components, and utilities"
    },
    inc_clientJS: {
      file: "inc_clientJS.html",
      description: "Client-side JavaScript with google.script.run helpers, form handling, validation, and state management"
    }
  },
  defaultVariables: {
    APP_TITLE: "My Google Apps Script Web App",
    APP_DESCRIPTION: "A modern web application built with Google Apps Script",
    APP_VERSION: "1.0.0",
    LAST_UPDATED: "2025-08-17",
    ENVIRONMENT: "Production",
    MAIN_CONTENT: "<div class=\"card\"><div class=\"card-body\"><h3>Welcome!</h3><p>Your application content goes here.</p></div></div>"
  }
};

export class HTMLTemplateManager {
  private config: TemplateConfig = DEFAULT_CONFIG;

  constructor() {
    // Configuration loaded from static config
  }

  /**
   * Get list of available templates
   */
  getAvailableTemplates(): string[] {
    return Object.keys(this.config.templates);
  }

  /**
   * Get template information
   */
  getTemplateInfo(templateName: string) {
    const template = this.config.templates[templateName];
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }
    return template;
  }

  /**
   * Get template manifest with file references and usage instructions
   */
  getTemplateManifest() {
    return {
      templates: Object.entries(this.config.templates).map(([name, config]) => ({
        name,
        description: config.description,
        variables: config.variables,
        file: config.file
      })),
      includes: Object.entries(this.config.includes).map(([name, config]) => ({
        name,
        description: config.description,
        file: config.file
      })),
      defaultVariables: this.config.defaultVariables,
      templatePath: '/templates/html/',
      usage: {
        note: 'Template files are located in templates/html/ directory',
        main: 'Main template files (main.html, example_spa.html)',
        includes: 'Include files (inc_styles.html, inc_clientJS.html)',
        variables: 'Use <?!= options.VARIABLE_NAME ?> in HTML templates',
        appsScript: 'Copy HTML files to Apps Script project and use template.options = {...}'
      }
    };
  }

  /**
   * Get file paths for external template files
   */
  getTemplateFilePaths(templateName?: string): Record<string, string> {
    const basePath = 'templates/html/';
    
    if (templateName) {
      const template = this.getTemplateInfo(templateName);
      return {
        main: basePath + template.file,
        styles: basePath + this.config.includes.inc_styles.file,
        clientJS: basePath + this.config.includes.inc_clientJS.file
      };
    }

    return {
      config: basePath + 'template_config.json',
      main: basePath + 'main.html',
      example_spa: basePath + 'example_spa.html',
      styles: basePath + 'inc_styles.html',
      clientJS: basePath + 'inc_clientJS.html'
    };
  }

  /**
   * Get Apps Script project structure for template
   */
  getAppsScriptProjectStructure(templateName: string, variables: Record<string, string> = {}) {
    const template = this.getTemplateInfo(templateName);
    const mergedVariables = { ...this.config.defaultVariables, ...variables };

    return {
      files: [
        {
          name: 'Code',
          type: 'SERVER_JS',
          content: `// Include function for template system
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet() {
  const template = HtmlService.createTemplateFromFile('${template.file.replace('.html', '')}');
  
  // Set template options
  template.options = ${JSON.stringify(mergedVariables, null, 2)};
  
  return template.evaluate()
    .setTitle('${mergedVariables.APP_TITLE}')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Add your server functions here
function saveUserData(data) {
  // Your implementation
  return { success: true, data: data };
}

function getServerStatus() {
  return { status: 'online', timestamp: new Date().toISOString() };
}`
        },
        {
          name: template.file.replace('.html', ''),
          type: 'HTML',
          filePath: `templates/html/${template.file}`,
          note: 'Copy content from this file'
        },
        {
          name: 'inc_styles',
          type: 'HTML',
          filePath: 'templates/html/inc_styles.html',
          note: 'Copy content from this file'
        },
        {
          name: 'inc_clientJS',
          type: 'HTML',
          filePath: 'templates/html/inc_clientJS.html',
          note: 'Copy content from this file'
        }
      ],
      instructions: [
        '1. Create a new Google Apps Script project',
        '2. Replace Code.gs with the generated server code',
        '3. Create HTML files by copying content from the specified template files',
        '4. Deploy as a web app with "Execute as: Me" and "Access: Anyone"',
        '5. Test the deployment URL'
      ]
    };
  }

  /**
   * Generate template usage instructions with external file references
   */
  generateTemplateInstructions(templateName: string, variables: Record<string, string> = {}): string {
    const template = this.getTemplateInfo(templateName);
    const mergedVariables = { ...this.config.defaultVariables, ...variables };
    const filePaths = this.getTemplateFilePaths(templateName);

    return `Template Usage Instructions for '${templateName}':

Files Required:
- Main Template: ${filePaths.main}
- CSS Styles: ${filePaths.styles}
- Client JavaScript: ${filePaths.clientJS}

Template Variables:
${JSON.stringify(mergedVariables, null, 2)}

Apps Script Setup:
1. Copy HTML files from templates/html/ to your Apps Script project
2. Use HtmlService.createTemplateFromFile('${template.file.replace('.html', '')}')
3. Set template.options = { ... } with your variables
4. Call template.evaluate() to render

Template Syntax:
- Variables: <?!= options.VARIABLE_NAME || "default" ?>
- Includes: <?!= include('inc_styles'); ?>

File References:
- Template uses external files in templates/html/ directory
- No inline content included in this manager
- Copy actual file contents to Apps Script project`;
  }
}

// Export singleton instance
export const templateManager = new HTMLTemplateManager();

// Template constants
const MAIN_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{APP_TITLE}}</title>
    <?!= include('inc_styles'); ?>
</head>
<body>
    <div id="app">
        <header class="header">
            <div class="container">
                <h1 class="app-title">{{APP_TITLE}}</h1>
                <p class="app-description">{{APP_DESCRIPTION}}</p>
            </div>
        </header>

        <main class="main">
            <div class="container">
                <!-- Loading State -->
                <div id="loading" class="loading" style="display: none;">
                    <div class="loading-spinner"></div>
                    <p>Loading...</p>
                </div>

                <!-- Main Content -->
                <div id="content" class="content">
                    {{MAIN_CONTENT}}
                </div>

                <!-- Error Display -->
                <div id="error" class="error" style="display: none;">
                    <div class="error-content">
                        <h3>⚠️ Error</h3>
                        <p id="error-message"></p>
                        <button onclick="retryOperation()" class="btn btn-primary">Retry</button>
                    </div>
                </div>
            </div>
        </main>

        <footer class="footer">
            <div class="container">
                <p>&copy; 2024 Powered by Google Apps Script</p>
            </div>
        </footer>
    </div>

    <?!= include('inc_clientJS'); ?>
</body>
</html>`;

const STYLES_HTML_TEMPLATE = `<style>
/* Reset and Base Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f5f5f5;
}

/* Container */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem 0;
    text-align: center;
}

.app-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
}

.app-description {
    font-size: 1.1rem;
    opacity: 0.9;
}

/* Main Content */
.main {
    min-height: calc(100vh - 200px);
    padding: 2rem 0;
}

/* Loading State */
.loading {
    text-align: center;
    padding: 3rem 0;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Error State */
.error {
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
}

.error-content h3 {
    color: #c33;
    margin-bottom: 0.5rem;
}

/* Buttons */
.btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-primary {
    background: #667eea;
    color: white;
}

.btn-primary:hover {
    background: #5a6fd8;
    transform: translateY(-1px);
}

.btn-secondary {
    background: #6c757d;
    color: white;
}

.btn-secondary:hover {
    background: #5a6268;
}

/* Forms */
.form-group {
    margin-bottom: 1rem;
}

.form-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #555;
}

.form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s ease;
}

.form-control:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Cards */
.card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
}

.card-header {
    border-bottom: 1px solid #eee;
    padding-bottom: 1rem;
    margin-bottom: 1rem;
}

.card-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
}

/* Tables */
.table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
}

.table th,
.table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #eee;
}

.table th {
    background: #f8f9fa;
    font-weight: 600;
    color: #555;
}

/* Footer */
.footer {
    background: #333;
    color: white;
    text-align: center;
    padding: 1rem 0;
    margin-top: auto;
}

/* Responsive Design */
@media (max-width: 768px) {
    .container {
        padding: 0 15px;
    }
    
    .app-title {
        font-size: 2rem;
    }
    
    .main {
        padding: 1rem 0;
    }
}
</style>`;

const CLIENT_JS_TEMPLATE = `<script>
// Global app state
let appState = {
    isLoading: false,
    error: null,
    data: null
};

// Utility functions
function showLoading() {
    appState.isLoading = true;
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

function hideLoading() {
    appState.isLoading = false;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
}

function showError(message) {
    appState.error = message;
    document.getElementById('error-message').textContent = message;
    document.getElementById('error').style.display = 'block';
    document.getElementById('content').style.display = 'none';
}

function hideError() {
    appState.error = null;
    document.getElementById('error').style.display = 'none';
    document.getElementById('content').style.display = 'block';
}

function retryOperation() {
    hideError();
    // Implement retry logic here
    console.log('Retrying operation...');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initialized');
    
    // Add event listeners for forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            console.log('Form submitted:', data);
            
            // Show loading state
            showLoading();
            
            // Simulate API call
            setTimeout(() => {
                hideLoading();
                console.log('Form processed successfully');
            }, 1000);
        });
    });
    
    // Add event listeners for buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (this.onclick) return; // Skip if already has onclick handler
            
            console.log('Button clicked:', this.textContent);
            
            // Add visual feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
});
</script>`;

// Static template content - in a real implementation, these would be loaded from files
const TEMPLATE_CONTENT: Record<string, string> = {
  'main.html': MAIN_HTML_TEMPLATE,
  'inc_styles.html': STYLES_HTML_TEMPLATE,
  'inc_clientJS.html': CLIENT_JS_TEMPLATE,

  'example_spa.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{APP_TITLE}}</title>
    <?!= include('inc_styles'); ?>
</head>
<body>
    <div id="app">
        <header class="header">
            <div class="container">
                <h1 class="app-title">{{APP_TITLE}}</h1>
                <p class="app-description">{{APP_DESCRIPTION}}</p>
            </div>
        </header>

        <main class="main">
            <div class="container">
                <!-- Loading State -->
                <div id="loading" class="loading">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>

                <!-- Main Content Area -->
                <div id="content" class="content">
                    <div class="row">
                        <div class="col-6">
                            <div class="card">
                                <div class="card-header">
                                    <h3>User Data Form</h3>
                                </div>
                                <div class="card-body">
                                    <form id="userForm" data-server-function="saveUserData">
                                        <div class="form-group">
                                            <label class="form-label" for="name">Name *</label>
                                            <input type="text" id="name" name="name" class="form-control" required>
                                        </div>

                                        <div class="form-group">
                                            <label class="form-label" for="email">Email *</label>
                                            <input type="email" id="email" name="email" class="form-control" required>
                                        </div>

                                        <div class="form-group">
                                            <label class="form-label" for="department">Department</label>
                                            <select id="department" name="department" class="form-control">
                                                <option value="">Select Department</option>
                                                <option value="engineering">Engineering</option>
                                                <option value="marketing">Marketing</option>
                                                <option value="sales">Sales</option>
                                                <option value="hr">Human Resources</option>
                                            </select>
                                        </div>

                                        <div class="form-group">
                                            <label class="form-label" for="message">Message</label>
                                            <textarea id="message" name="message" class="form-control" rows="4" placeholder="Enter your message here..."></textarea>
                                        </div>

                                        <button type="submit" class="btn btn-primary">Submit Data</button>
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
                                    <button class="btn btn-success mb-3" data-action="getStatus">
                                        Check Server Status
                                    </button>

                                    <button class="btn btn-secondary mb-3" data-action="fetchUserData">
                                        Load User Data
                                    </button>

                                    <button class="btn btn-primary mb-3" data-action="generateReport" data-params='{"type": "monthly"}'>
                                        Generate Monthly Report
                                    </button>

                                    <button class="btn btn-danger" onclick="clearAllData()">
                                        Clear All Data
                                    </button>
                                </div>
                            </div>

                            <div class="card">
                                <div class="card-header">
                                    <h3>System Info</h3>
                                </div>
                                <div class="card-body">
                                    <table class="table">
                                        <tr>
                                            <td><strong>App Version</strong></td>
                                            <td>{{APP_VERSION}}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Last Updated</strong></td>
                                            <td>{{LAST_UPDATED}}</td>
                                        </tr>
                                        <tr>
                                            <td><strong>Environment</strong></td>
                                            <td>{{ENVIRONMENT}}</td>
                                        </tr>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Error Display -->
                <div id="error" class="error" style="display: none;">
                    <div class="error-content">
                        <h3>⚠️ Error</h3>
                        <p id="error-message"></p>
                        <button onclick="retryOperation()" class="btn btn-primary">Retry</button>
                    </div>
                </div>
            </div>
        </main>

        <footer class="footer">
            <div class="container">
                <p>&copy; 2024 Powered by Google Apps Script | {{APP_TITLE}}</p>
            </div>
        </footer>
    </div>

    <?!= include('inc_clientJS'); ?>
</body>
</html>`,

};

// Export the template content
export { TEMPLATE_CONTENT };

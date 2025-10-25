# HTML Template System for Google Apps Script

This template system provides a comprehensive framework for building modern Single Page Applications (SPAs) that can be deployed as Google Apps Script web apps. The system is designed to work seamlessly with Model Context Protocol (MCP) where an AI worker can dynamically fill in templates and deploy them to Apps Script.

## Overview

The template system consists of:

1. **Main Templates** - Complete HTML documents with templating placeholders
2. **Include Files** - Reusable components (CSS, JavaScript)
3. **Template Manager** - TypeScript utility for processing templates
4. **API Routes** - Endpoints for generating and deploying templates

## Template Structure

### Main Templates

Located in `/templates/html/`:

- `main.html` - Basic SPA skeleton with header, content area, footer, loading states, and error handling
- `example_spa.html` - Complete example with forms, buttons, tables, and interactive elements

### Include Files

- `inc_styles.html` - Comprehensive CSS with responsive design, component styles, and utilities
- `inc_clientJS.html` - Client-side JavaScript with `google.script.run` helpers, form handling, validation, and state management

### Template Configuration

`template_config.json` defines:
- Available templates and their variables
- Include file mappings
- Default variable values

## Template Variables

Templates use `{{VARIABLE_NAME}}` syntax for substitution:

```html
<title>{{APP_TITLE}}</title>
<p>{{APP_DESCRIPTION}}</p>
```

Common variables:
- `APP_TITLE` - Application title
- `APP_DESCRIPTION` - Application description
- `APP_VERSION` - Version number
- `LAST_UPDATED` - Last update date
- `ENVIRONMENT` - Environment (Production, Development, etc.)
- `MAIN_CONTENT` - Main content area HTML

## Include Syntax

Templates use Apps Script include syntax:

```html
<?!= include('inc_styles'); ?>
<?!= include('inc_clientJS'); ?>
```

The template manager processes these during generation.

## Google Apps Script Integration

### Client-Side JavaScript Features

The `inc_clientJS.html` provides:

**State Management:**
```javascript
window.AppState = {
    loading: false,
    error: null,
    data: null
};
```

**UI Utilities:**
```javascript
showLoading()
hideLoading()
showContent()
showError(message)
clearError()
```

**Server Communication:**
```javascript
// Promise-based google.script.run wrapper
callServerFunction('functionName', parameters)
    .then(result => {
        displayResult('Success!', result);
    })
    .catch(error => {
        // Error automatically displayed
        console.error(error);
    });
```

**Automatic Form Handling:**
```html
<form id="myForm" data-server-function="saveData">
    <input name="name" required>
    <button type="submit">Submit</button>
</form>
```

**Button Actions:**
```html
<button data-action="getStatus">Check Status</button>
<button data-action="generateReport" data-params='{"type": "monthly"}'>
    Generate Report
</button>
```

### Server-Side Function Examples

```javascript
function saveUserData(data) {
    // Server-side data handling
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty('userData_' + new Date().getTime(), JSON.stringify(data));

    return {
        success: true,
        message: 'Data saved successfully'
    };
}

function getUserData() {
    // Retrieve user data
    const properties = PropertiesService.getScriptProperties();
    return properties.getProperties();
}
```

## API Endpoints

### Get Available Templates
```
GET /appscript/templates
```

Returns list of available templates, includes, and default variables.

### Generate HTML from Template
```
POST /appscript/templates/generate
{
    "templateName": "main",
    "variables": {
        "APP_TITLE": "My App",
        "APP_DESCRIPTION": "Description"
    },
    "outputFormat": "html" // or "appsscript"
}
```

### Preview Template
```
POST /appscript/templates/preview
{
    "templateName": "example_spa",
    "variables": { ... }
}
```

Returns HTML directly for browser preview.

### Create Apps Script Project from Template
```
POST /appscript/webapp/create-from-template
{
    "title": "My Web App",
    "description": "App description",
    "templateName": "example_spa",
    "variables": {
        "APP_TITLE": "Custom Title"
    },
    "user": "user-identifier"
}
```

Creates a complete Apps Script project with:
- Main server-side code with routing
- HTML template file
- Proper include structure
- Example server functions

### Create Custom Template
```
POST /appscript/templates/custom
{
    "baseName": "main",
    "variables": { ... },
    "additionalCSS": "body { background: blue; }",
    "additionalJS": "console.log('Custom JS');"
}
```

## Usage Examples

### 1. Basic Template Generation

```typescript
import { templateManager } from './utils/html-template-manager';

const html = templateManager.generateHTML('main', {
    APP_TITLE: 'My Application',
    APP_DESCRIPTION: 'A powerful web app',
    MAIN_CONTENT: '<div class="welcome">Welcome!</div>'
});
```

### 2. Apps Script Project Creation

```javascript
// Creates a complete deployable project
const result = await fetch('/appscript/webapp/create-from-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: 'Employee Portal',
        description: 'Company employee management portal',
        templateName: 'example_spa',
        variables: {
            APP_TITLE: 'Employee Portal',
            APP_VERSION: '2.0.0',
            ENVIRONMENT: 'Production'
        }
    })
});
```

### 3. MCP Integration

When used with MCP, an AI worker can:

1. Choose appropriate template based on requirements
2. Fill in variables dynamically
3. Add custom CSS/JS if needed
4. Deploy to Apps Script automatically

```javascript
// MCP worker example
async function createWebApp(requirements) {
    const template = selectBestTemplate(requirements);
    const variables = extractVariables(requirements);

    const project = await createFromTemplate({
        templateName: template,
        variables: variables,
        title: requirements.title
    });

    return project;
}
```

## Styling System

The CSS framework provides:

**Responsive Grid:**
```html
<div class="row">
    <div class="col-6">Half width</div>
    <div class="col-6">Half width</div>
</div>
```

**Component Classes:**
```html
<button class="btn btn-primary">Primary Button</button>
<div class="card">
    <div class="card-header">Header</div>
    <div class="card-body">Content</div>
</div>
```

**Utility Classes:**
```html
<div class="text-center mt-4 mb-2">Centered with margins</div>
```

## Form Validation

Built-in client-side validation:

```javascript
const isValid = validateForm('myForm', {
    name: { required: true, minLength: 2 },
    email: { required: true, email: true },
    message: { maxLength: 500 }
});
```

## Error Handling

Automatic error display with retry functionality:

```javascript
// Errors are automatically caught and displayed
callServerFunction('riskyOperation')
    .catch(error => {
        // UI shows error with retry button
        // User can press Ctrl/Cmd+R to retry
    });
```

## Deployment Workflow

1. **Generate Template** - Use API to create HTML from template
2. **Create Project** - Generate Apps Script project with template
3. **Deploy Web App** - Use Apps Script interface to deploy
4. **Configure Access** - Set permissions and sharing

The system handles the complete workflow from template to deployed web application.

## Best Practices

1. **Use Variables** - Always use template variables instead of hardcoding
2. **Validate Input** - Use built-in validation or add custom rules
3. **Handle Errors** - Leverage automatic error handling system
4. **Mobile First** - Templates are responsive by default
5. **Server Functions** - Keep server functions focused and simple
6. **Caching** - Use PropertiesService or CacheService for data storage

## Extending Templates

To create new templates:

1. Create HTML file in `/templates/html/`
2. Add entry to `template_config.json`
3. Use `{{VARIABLE}}` syntax for replaceable content
4. Include CSS/JS with `<?!= include('filename'); ?>`
5. Test with preview endpoint

## Security Considerations

- Always validate user input on server side
- Use appropriate Apps Script execution permissions
- Sanitize data before storing in PropertiesService
- Consider data encryption for sensitive information
- Test with various user permission levels

This template system provides a complete foundation for building modern, interactive web applications that can be quickly deployed as Google Apps Script web apps, perfect for rapid prototyping and production use cases.

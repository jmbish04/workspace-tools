import { CLIENT_JS_TEMPLATE, MAIN_HTML_TEMPLATE, STYLES_HTML_TEMPLATE } from './template-content';

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

// Static template content
const TEMPLATE_CONTENT: Record<string, string> = {
  'main.html': MAIN_HTML_TEMPLATE,
  'inc_styles.html': STYLES_HTML_TEMPLATE,
  'inc_clientJS.html': CLIENT_JS_TEMPLATE,
  'example_spa.html': MAIN_HTML_TEMPLATE // Using main template for example
};

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
    // In a Cloudflare Workers environment, we use static content
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
   * Load template content from static content
   */
  private loadTemplateContent(filename: string): string {
    if (TEMPLATE_CONTENT[filename]) {
      return TEMPLATE_CONTENT[filename];
    }
    throw new Error(`Template file '${filename}' not found`);
  }

  /**
   * Get raw template content by filename - PUBLIC METHOD
   */
  getRawTemplateContent(filename: string): string {
    return this.loadTemplateContent(filename);
  }

  /**
   * Get all template content (for bulk operations) - PUBLIC METHOD
   */
  getAllTemplateContent(): Record<string, string> {
    return { ...TEMPLATE_CONTENT };
  }

  /**
   * Process template variables in content
   */
  private processVariables(content: string, variables: Record<string, string>): string {
    let processedContent = content;

    // Replace all {{VARIABLE}} placeholders
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, value);
    });

    return processedContent;
  }

  /**
   * Process includes in the template
   */
  private processIncludes(content: string): string {
    const includeRegex = /<\?\!=\s*include\('([^']+)'\);\s*\?>/g;
    let processedContent = content;
    let match;

    while ((match = includeRegex.exec(content)) !== null) {
      const includeName = match[1];
      const includeConfig = this.config.includes[includeName];

      if (includeConfig) {
        const includeContent = this.loadTemplateContent(includeConfig.file);
        processedContent = processedContent.replace(match[0], includeContent);
      } else {
        console.warn(`Include '${includeName}' not found in configuration`);
        processedContent = processedContent.replace(match[0], `<!-- Include '${includeName}' not found -->`);
      }
    }

    return processedContent;
  }

  /**
   * Generate HTML from template
   */
  generateHTML(templateName: string, variables: Record<string, string> = {}): string {
    const template = this.getTemplateInfo(templateName);

    // Merge default variables with provided variables
    const mergedVariables = {
      ...this.config.defaultVariables,
      ...variables
    };

    // Load template content
    let content = this.loadTemplateContent(template.file);

    // Process includes first
    content = this.processIncludes(content);

    // Then process variables
    content = this.processVariables(content, mergedVariables);

    return content;
  }

  /**
   * Get template preview (for development/testing)
   */
  getTemplatePreview(templateName: string, variables: Record<string, string> = {}): string {
    return this.generateHTML(templateName, variables);
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(templateName: string, variables: Record<string, string>): { valid: boolean; missing: string[]; extra: string[] } {
    const template = this.getTemplateInfo(templateName);
    const requiredVars = template.variables;
    const providedVars = Object.keys(variables);

    const missing = requiredVars.filter(varName => !providedVars.includes(varName) && !this.config.defaultVariables[varName]);
    const extra = providedVars.filter(varName => !requiredVars.includes(varName));

    return {
      valid: missing.length === 0,
      missing,
      extra
    };
  }

  /**
   * Get template manifest (for MCP tools)
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
      defaultVariables: this.config.defaultVariables
    };
  }
}

// Export singleton instance
export const templateManager = new HTMLTemplateManager();

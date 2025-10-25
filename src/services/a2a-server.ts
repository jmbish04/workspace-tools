/**
 * @module a2a-server
 * @description A2A (Agent-to-Agent) server implementation for exposing this Cloudflare Worker
 * as an A2A-enabled agent following the A2A protocol standard
 */

import { Context } from 'hono';
import { Logger } from '../utils/logger';
import { A2AAgentCard, A2AExecuteRequest, A2AExecuteResponse, WorkspaceToolResponse } from '../types';

/**
 * A2A Server for handling incoming A2A requests
 */
export class A2AServer {
  private logger: Logger;
  private agentCard: A2AAgentCard;

  constructor(logger: Logger, workerUrl: string) {
    this.logger = logger;
    this.agentCard = this.createAgentCard(workerUrl);
  }

  /**
   * Create the agent card for this Cloudflare Worker
   */
  private createAgentCard(workerUrl: string): A2AAgentCard {
    return {
      name: "Cloudflare Workspace Agent",
      description: "Advanced Google Workspace automation agent with Gmail, Drive, Docs, Sheets, and Slides capabilities",
      url: workerUrl,
      version: "1.0.0",
      defaultInputModes: ["text", "application/json"],
      defaultOutputModes: ["text", "application/json"],
      capabilities: {
        streaming: false,
        pushNotifications: true,
        workspaceIntegration: true,
        crossServiceOrchestration: true
      },
      skills: [
        {
          id: "gmail_operations",
          name: "Gmail Operations",
          description: "Send, read, search, and manage Gmail messages",
          tags: ["gmail", "email", "communication"],
          parameters: {
            operation: {
              type: "string",
              description: "Operation type: send, read, search, list",
              required: true
            },
            params: {
              type: "object",
              description: "Operation-specific parameters",
              required: true
            }
          }
        },
        {
          id: "drive_management",
          name: "Google Drive Management",
          description: "Create, read, update, delete files and folders in Google Drive",
          tags: ["drive", "files", "storage"],
          parameters: {
            operation: {
              type: "string",
              description: "Operation type: create, read, update, delete, search",
              required: true
            },
            params: {
              type: "object",
              description: "Operation-specific parameters",
              required: true
            }
          }
        },
        {
          id: "sheets_data",
          name: "Google Sheets Data Operations",
          description: "Read, write, analyze data in Google Sheets",
          tags: ["sheets", "spreadsheets", "data"],
          parameters: {
            operation: {
              type: "string",
              description: "Operation type: read, write, create, update",
              required: true
            },
            params: {
              type: "object",
              description: "Operation-specific parameters including spreadsheetId and range",
              required: true
            }
          }
        },
        {
          id: "slides_presentations",
          name: "Google Slides Presentations",
          description: "Create and modify Google Slides presentations",
          tags: ["slides", "presentations", "visual"],
          parameters: {
            operation: {
              type: "string",
              description: "Operation type: create, read, update, add_slide",
              required: true
            },
            params: {
              type: "object",
              description: "Operation-specific parameters",
              required: true
            }
          }
        },
        {
          id: "email_processing",
          name: "Email Processing & Analysis",
          description: "Advanced email processing with spam detection and thread analysis",
          tags: ["email", "ai", "analysis", "spam-detection"],
          parameters: {
            operation: {
              type: "string",
              description: "Operation type: analyze, process_thread, spam_check",
              required: true
            },
            params: {
              type: "object",
              description: "Processing parameters",
              required: true
            }
          }
        },
        {
          id: "cross_service_orchestration",
          name: "Cross-Service Orchestration",
          description: "Orchestrate workflows across multiple Google Workspace services",
          tags: ["orchestration", "workflow", "automation"],
          parameters: {
            workflow: {
              type: "string",
              description: "Workflow type: email_to_doc, data_to_presentation, file_sync",
              required: true
            },
            params: {
              type: "object",
              description: "Workflow-specific parameters",
              required: true
            }
          }
        }
      ]
    };
  }

  /**
   * Get the agent card (for /.well-known/agent.json endpoint)
   */
  getAgentCard(): A2AAgentCard {
    return this.agentCard;
  }

  /**
   * Execute a skill requested by another A2A agent
   */
  async executeSkill(request: A2AExecuteRequest, c: Context): Promise<A2AExecuteResponse> {
    const startTime = Date.now();
    const requestId = request.metadata?.requestId || crypto.randomUUID();
    
    this.logger.info(`🔄 A2A skill execution requested: ${request.skill}`, {
      requestId,
      skill: request.skill,
      source: request.metadata?.source
    });

    try {
      // Find the skill
      const skill = this.agentCard.skills.find(s => s.id === request.skill);
      if (!skill) {
        throw new Error(`Unknown skill: ${request.skill}. Available skills: ${this.agentCard.skills.map(s => s.id).join(', ')}`);
      }

      // Execute the skill
      let result: any;
      
      switch (request.skill) {
        case 'gmail_operations':
          result = await this.executeGmailOperations(request.parameters, c);
          break;
          
        case 'drive_management':
          result = await this.executeDriveManagement(request.parameters, c);
          break;
          
        case 'sheets_data':
          result = await this.executeSheetsData(request.parameters, c);
          break;
          
        case 'slides_presentations':
          result = await this.executeSlidesOperations(request.parameters, c);
          break;
          
        case 'email_processing':
          result = await this.executeEmailProcessing(request.parameters, c);
          break;
          
        case 'cross_service_orchestration':
          result = await this.executeCrossServiceOrchestration(request.parameters, c);
          break;
          
        default:
          throw new Error(`Skill execution not implemented: ${request.skill}`);
      }

      const executionTime = Date.now() - startTime;
      this.logger.info(`✅ A2A skill execution completed: ${request.skill} in ${executionTime}ms`);

      return {
        success: true,
        result,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          executionTime
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`❌ A2A skill execution failed: ${request.skill}`, error);

      return {
        success: false,
        error: {
          code: 'SKILL_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : error
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          executionTime
        }
      };
    }
  }

  /**
   * Execute Gmail operations
   */
  private async executeGmailOperations(params: any, c: Context): Promise<any> {
    const { operation, params: opParams } = params;
    const baseUrl = new URL(c.req.url).origin;
    
    switch (operation) {
      case 'send':
        const sendResponse = await fetch(`${baseUrl}/gmail/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        return await sendResponse.json();
        
      case 'search':
        const searchResponse = await fetch(`${baseUrl}/gmail/search?${new URLSearchParams(opParams)}`);
        return await searchResponse.json();
        
      case 'list':
        const listResponse = await fetch(`${baseUrl}/gmail/messages?${new URLSearchParams(opParams)}`);
        return await listResponse.json();
        
      case 'read':
        const readResponse = await fetch(`${baseUrl}/gmail/messages/${opParams.messageId}`);
        return await readResponse.json();
        
      default:
        throw new Error(`Unknown Gmail operation: ${operation}`);
    }
  }

  /**
   * Execute Drive management operations
   */
  private async executeDriveManagement(params: any, c: Context): Promise<any> {
    const { operation, params: opParams } = params;
    const baseUrl = new URL(c.req.url).origin;
    
    switch (operation) {
      case 'search':
        const searchResponse = await fetch(`${baseUrl}/drive/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        
        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          throw new Error(`Drive search failed: ${searchResponse.status} - ${errorText}`);
        }
        
        return await searchResponse.json();
        
      case 'create':
        const createResponse = await fetch(`${baseUrl}/drive/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        return await createResponse.json();
        
      case 'read':
        const readResponse = await fetch(`${baseUrl}/drive/file/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: opParams.fileId,
            user: opParams.user || 'default'
          })
        });
        
        if (!readResponse.ok) {
          const errorText = await readResponse.text();
          throw new Error(`Drive read failed: ${readResponse.status} - ${errorText}`);
        }
        
        return await readResponse.json();
        
      default:
        throw new Error(`Unknown Drive operation: ${operation}`);
    }
  }

  /**
   * Execute Sheets data operations
   */
  private async executeSheetsData(params: any, c: Context): Promise<any> {
    const { operation, params: opParams } = params;
    const baseUrl = new URL(c.req.url).origin;
    
    switch (operation) {
      case 'read':
        const readResponse = await fetch(`${baseUrl}/sheets/${opParams.spreadsheetId}/values/${opParams.range}`);
        return await readResponse.json();
        
      case 'write':
        const writeResponse = await fetch(`${baseUrl}/sheets/${opParams.spreadsheetId}/values/${opParams.range}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        return await writeResponse.json();
        
      case 'create':
        const createResponse = await fetch(`${baseUrl}/sheets/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        return await createResponse.json();
        
      default:
        throw new Error(`Unknown Sheets operation: ${operation}`);
    }
  }

  /**
   * Execute Slides operations
   */
  private async executeSlidesOperations(params: any, c: Context): Promise<any> {
    const { operation, params: opParams } = params;
    const baseUrl = new URL(c.req.url).origin;
    
    switch (operation) {
      case 'create':
        const createResponse = await fetch(`${baseUrl}/slides/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        return await createResponse.json();
        
      case 'read':
        const readResponse = await fetch(`${baseUrl}/slides/${opParams.presentationId}`);
        return await readResponse.json();
        
      default:
        throw new Error(`Unknown Slides operation: ${operation}`);
    }
  }

  /**
   * Execute email processing operations
   */
  private async executeEmailProcessing(params: any, c: Context): Promise<any> {
    const { operation, params: opParams } = params;
    const baseUrl = new URL(c.req.url).origin;
    
    switch (operation) {
      case 'analyze':
        const analyzeResponse = await fetch(`${baseUrl}/email-processing/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        return await analyzeResponse.json();
        
      case 'process_thread':
        const processResponse = await fetch(`${baseUrl}/thread-processor/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        return await processResponse.json();
        
      case 'spam_check':
        const spamResponse = await fetch(`${baseUrl}/email-processing/spam-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opParams)
        });
        return await spamResponse.json();
        
      default:
        throw new Error(`Unknown email processing operation: ${operation}`);
    }
  }

  /**
   * Execute cross-service orchestration workflows
   */
  private async executeCrossServiceOrchestration(params: any, c: Context): Promise<any> {
    const { workflow, params: workflowParams } = params;
    
    switch (workflow) {
      case 'email_to_doc':
        return await this.orchestrateEmailToDoc(workflowParams, c);
        
      case 'data_to_presentation':
        return await this.orchestrateDataToPresentation(workflowParams, c);
        
      case 'file_sync':
        return await this.orchestrateFileSync(workflowParams, c);
        
      default:
        throw new Error(`Unknown workflow: ${workflow}`);
    }
  }

  /**
   * Orchestrate Email to Document workflow
   */
  private async orchestrateEmailToDoc(params: any, c: Context): Promise<any> {
    const { emailId, documentTitle } = params;
    const baseUrl = new URL(c.req.url).origin;
    
    try {
      // 1. Get email content
      const emailResponse = await fetch(`${baseUrl}/gmail/messages/${emailId}`);
      const emailData = await emailResponse.json() as { success: boolean; data?: any };
      
      if (!emailData.success) {
        throw new Error('Failed to fetch email data');
      }
      
      // 2. Create document with email content
      const createDocResponse = await fetch(`${baseUrl}/docs/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: documentTitle || `Email: ${emailData.data?.subject || 'Untitled'}`,
          content: [
            { text: `Subject: ${emailData.data?.subject || 'No Subject'}\n` },
            { text: `From: ${emailData.data?.from || 'Unknown'}\n` },
            { text: `Date: ${emailData.data?.date || 'Unknown'}\n\n` },
            { text: `Content:\n${emailData.data?.body || 'No content'}\n` }
          ]
        })
      });
      
      const docData = await createDocResponse.json() as { data?: any };
      
      return {
        workflow: 'email_to_doc',
        emailId,
        documentId: docData.data?.documentId,
        documentUrl: docData.data?.webViewLink,
        status: 'completed'
      };
      
    } catch (error) {
      throw new Error(`Email to document workflow failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Orchestrate Data to Presentation workflow
   */
  private async orchestrateDataToPresentation(params: any, c: Context): Promise<any> {
    const { spreadsheetId, range, presentationTitle } = params;
    const baseUrl = new URL(c.req.url).origin;
    
    try {
      // 1. Get data from sheets
      const sheetResponse = await fetch(`${baseUrl}/sheets/${spreadsheetId}/values/${range}`);
      const sheetData = await sheetResponse.json() as { success: boolean; data?: any };
      
      if (!sheetData.success) {
        throw new Error('Failed to fetch sheet data');
      }
      
      // 2. Create presentation with data
      const createPresResponse = await fetch(`${baseUrl}/slides/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: presentationTitle || `Data Presentation from ${spreadsheetId}`,
          slides: [{
            title: 'Data Overview',
            content: sheetData.data?.values || []
          }]
        })
      });
      
      const presData = await createPresResponse.json() as { data?: any };
      
      return {
        workflow: 'data_to_presentation',
        spreadsheetId,
        presentationId: presData.data?.presentationId,
        presentationUrl: presData.data?.webViewLink,
        status: 'completed'
      };
      
    } catch (error) {
      throw new Error(`Data to presentation workflow failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Orchestrate File Sync workflow
   */
  private async orchestrateFileSync(params: any, c: Context): Promise<any> {
    const { sourceFileId, targetFolderId, syncType } = params;
    const baseUrl = new URL(c.req.url).origin;
    
    try {
      // Implementation depends on sync type
      const syncResponse = await fetch(`${baseUrl}/drive/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFileId,
          targetFolderId,
          syncType
        })
      });
      
      const syncData = await syncResponse.json() as { success: boolean; [key: string]: any };
      
      return {
        workflow: 'file_sync',
        sourceFileId,
        targetFolderId,
        syncType,
        status: syncData.success ? 'completed' : 'failed',
        result: syncData
      };
      
    } catch (error) {
      throw new Error(`File sync workflow failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

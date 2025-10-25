/**
 * @module email-reply-agent
 * @description Agent responsible for generating email replies based on the content of the original email.
 * It analyzes the tone, formality, and content of the original email to generate an appropriate reply.
 */

import { BaseAgent, AgentResponse } from "./base-agent";

/**
 * @interface EmailReplyInput
 * @description Defines the input structure for the EmailReplyAgent.
 * It includes the original email content and optional context for generating the reply.
 */
export interface EmailReplyInput {
  originalEmail: {
    subject: string;
    body: string;
    sender: string;
    recipient: string;
  };
  context?: {
    tone?: "formal" | "informal" | "neutral";
    urgency?: "low" | "medium" | "high";
    purpose?: string;
  };
}

/**
 * @class EmailReplyAgent
 * @description Agent responsible for generating email replies based on the content of the original email.
 * It analyzes the tone, formality, and content of the original email to generate an appropriate reply.
 */
export class EmailReplyAgent extends BaseAgent {
  /**
   * Generates the system prompt for the EmailReplyAgent.
   * @param {any} [context] Optional context to tailor the system prompt.
   * @returns {string} The system prompt.
   */
  getSystemPrompt(context?: any): string {
    return `You are an AI assistant specialized in generating professional email replies. Your task is to analyze the original email and generate an appropriate reply that matches the tone, formality, and context of the original message.

Guidelines:
- Match the formality level of the original email
- Maintain a professional tone while being personable
- Address all points raised in the original email
- Use appropriate greetings and closings
- Keep the reply concise but comprehensive
- If the original email is urgent, acknowledge the urgency in your reply
- If the original email contains questions, ensure all questions are answered
- Use proper email etiquette and formatting

Context: ${context ? JSON.stringify(context) : 'No additional context provided'}`;
  }

  /**
   * Formats the user input into a full prompt for the AI model.
   * @param {EmailReplyInput} input The user-provided input for the agent.
   * @param {any} [context] Optional context to help format the prompt.
   * @returns {string} The formatted prompt.
   */
  formatPrompt(input: EmailReplyInput, context?: any): string {
    const { originalEmail, context: inputContext } = input;
    const combinedContext = { ...context, ...inputContext };

    return `Please generate a professional email reply based on the following original email:

**Original Email Details:**
- From: ${originalEmail.sender}
- To: ${originalEmail.recipient}
- Subject: ${originalEmail.subject}
- Body: ${originalEmail.body}

**Reply Requirements:**
- Tone: ${combinedContext?.tone || 'Match the original email'}
- Urgency: ${combinedContext?.urgency || 'medium'}
- Purpose: ${combinedContext?.purpose || 'Reply to the original email'}

Please generate a complete email reply that includes:
1. Appropriate greeting
2. Acknowledgment of the original email
3. Response to any questions or points raised
4. Professional closing
5. Your signature

Format the reply as a complete email with proper structure.`;
  }

  /**
   * Post-processes the agent's response to ensure it meets the requirements for email replies.
   * @param {AgentResponse} response The response from the agent.
   * @returns {AgentResponse} The post-processed response.
   */
  postProcessResponse(response: AgentResponse): AgentResponse {
    // Extract the best response content
    const bestResponse = response.aggregatedResult?.bestResponse;
    if (!bestResponse?.content) {
      return response;
    }

    // Basic validation and formatting
    let processedContent = bestResponse.content.trim();

    // Ensure the reply starts with a proper greeting
    if (!processedContent.toLowerCase().includes('dear') && !processedContent.toLowerCase().includes('hello') && !processedContent.toLowerCase().includes('hi')) {
      processedContent = `Dear ${response.prompt.match(/From: (.+)/)?.[1] || 'Colleague'},\n\n${processedContent}`;
    }

    // Ensure the reply ends with a proper closing
    if (!processedContent.toLowerCase().includes('sincerely') && !processedContent.toLowerCase().includes('best regards') && !processedContent.toLowerCase().includes('thanks')) {
      processedContent += '\n\nBest regards,\n[Your Name]';
    }

    // Update the best response with processed content
    if (response.aggregatedResult?.bestResponse) {
      response.aggregatedResult.bestResponse.content = processedContent;
    }

    return response;
  }
}

/**
 * @module email-analysis-agent
 * @description Agent responsible for analyzing emails to determine their tone, formality, and other characteristics.
 * It provides insights into the email's content and suggests improvements.
 */

import { BaseAgent, AgentResponse } from "./base-agent";

/**
 * @interface EmailAnalysisInput
 * @description Defines the input structure for the EmailAnalysisAgent.
 * It includes the email content and optional context for analysis.
 */
export interface EmailAnalysisInput {
  email: {
    subject: string;
    body: string;
    sender: string;
    recipient: string;
  };
  analysisType?: "tone" | "formality" | "completeness" | "all";
  context?: {
    expectedTone?: "formal" | "informal" | "neutral";
    expectedFormality?: "high" | "medium" | "low";
    purpose?: string;
  };
}

/**
 * @interface EmailAnalysisResult
 * @description Defines the structure of the analysis result.
 * It includes various metrics and insights about the email.
 */
export interface EmailAnalysisResult {
  tone: {
    primary: string;
    secondary?: string;
    confidence: number;
  };
  formality: {
    level: "high" | "medium" | "low";
    score: number;
    indicators: string[];
  };
  completeness: {
    score: number;
    missingElements: string[];
    suggestions: string[];
  };
  politeness: {
    level: "high" | "medium" | "low";
    score: number;
    indicators: string[];
  };
  directness: {
    level: "high" | "medium" | "low";
    score: number;
    indicators: string[];
  };
  overallQuality: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

/**
 * @class EmailAnalysisAgent
 * @description Agent responsible for analyzing emails to determine their tone, formality, and other characteristics.
 * It provides insights into the email's content and suggests improvements.
 */
export class EmailAnalysisAgent extends BaseAgent {
  /**
   * Generates the system prompt for the EmailAnalysisAgent.
   * @param {any} [context] Optional context to tailor the system prompt.
   * @returns {string} The system prompt.
   */
  getSystemPrompt(context?: any): string {
    return `You are an AI assistant specialized in analyzing emails for tone, formality, completeness, and other characteristics. Your task is to provide detailed insights and recommendations for improving email communication.

Analysis Guidelines:
- Tone Analysis: Identify the primary and secondary tones (e.g., professional, friendly, urgent, apologetic)
- Formality Assessment: Evaluate the level of formality based on language, structure, and conventions
- Completeness Check: Assess if the email contains all necessary information and elements
- Politeness Evaluation: Determine the level of politeness and courtesy
- Directness Assessment: Evaluate how direct or indirect the communication is
- Quality Scoring: Provide an overall quality score with specific strengths and weaknesses

Context: ${context ? JSON.stringify(context) : 'No additional context provided'}`;
  }

  /**
   * Formats the user input into a full prompt for the AI model.
   * @param {EmailAnalysisInput} input The user-provided input for the agent.
   * @param {any} [context] Optional context to help format the prompt.
   * @returns {string} The formatted prompt.
   */
  formatPrompt(input: EmailAnalysisInput, context?: any): string {
    const { email, analysisType = "all", context: inputContext } = input;
    const combinedContext = { ...context, ...inputContext };

    return `Please analyze the following email and provide detailed insights:

**Email Details:**
- From: ${email.sender}
- To: ${email.recipient}
- Subject: ${email.subject}
- Body: ${email.body}

**Analysis Requirements:**
- Analysis Type: ${analysisType}
- Expected Tone: ${combinedContext?.expectedTone || 'Not specified'}
- Expected Formality: ${combinedContext?.expectedFormality || 'Not specified'}
- Purpose: ${combinedContext?.purpose || 'Not specified'}

**Please provide analysis in the following JSON format:**
{
  "tone": {
    "primary": "string",
    "secondary": "string (optional)",
    "confidence": number
  },
  "formality": {
    "level": "high|medium|low",
    "score": number,
    "indicators": ["string array"]
  },
  "completeness": {
    "score": number,
    "missingElements": ["string array"],
    "suggestions": ["string array"]
  },
  "politeness": {
    "level": "high|medium|low",
    "score": number,
    "indicators": ["string array"]
  },
  "directness": {
    "level": "high|medium|low",
    "score": number,
    "indicators": ["string array"]
  },
  "overallQuality": {
    "score": number,
    "strengths": ["string array"],
    "weaknesses": ["string array"],
    "recommendations": ["string array"]
  }
}

Please ensure the analysis is thorough, objective, and actionable.`;
  }

  /**
   * Post-processes the agent's response to ensure it meets the requirements for email analysis.
   * @param {AgentResponse} response The response from the agent.
   * @returns {AgentResponse} The post-processed response.
   */
  postProcessResponse(response: AgentResponse): AgentResponse {
    // Extract the best response content
    const bestResponse = response.aggregatedResult?.bestResponse;
    if (!bestResponse?.content) {
      return response;
    }

    try {
      // Try to parse the JSON response
      const analysisResult = JSON.parse(bestResponse.content);
      
      // Validate the structure
      if (this.validateAnalysisResult(analysisResult)) {
        // Update the best response with validated content
        if (response.aggregatedResult?.bestResponse) {
          response.aggregatedResult.bestResponse.content = JSON.stringify(analysisResult, null, 2);
        }
      } else {
        // If validation fails, wrap the content in a proper structure
        const wrappedResult = {
          analysis: analysisResult,
          metadata: {
            validated: false,
            originalContent: bestResponse.content
          }
        };
        
        if (response.aggregatedResult?.bestResponse) {
          response.aggregatedResult.bestResponse.content = JSON.stringify(wrappedResult, null, 2);
        }
      }
    } catch (error) {
      // If JSON parsing fails, wrap the content in a proper structure
      const wrappedResult = {
        analysis: bestResponse.content,
        metadata: {
          validated: false,
          parseError: error instanceof Error ? error.message : String(error)
        }
      };
      
      if (response.aggregatedResult?.bestResponse) {
        response.aggregatedResult.bestResponse.content = JSON.stringify(wrappedResult, null, 2);
      }
    }

    return response;
  }

  /**
   * Validates the structure of the analysis result.
   * @private
   * @param {any} result The analysis result to validate.
   * @returns {boolean} True if the result is valid, false otherwise.
   */
  private validateAnalysisResult(result: any): boolean {
    if (!result || typeof result !== 'object') {
      return false;
    }

    const requiredFields = ['tone', 'formality', 'completeness', 'politeness', 'directness', 'overallQuality'];
    
    for (const field of requiredFields) {
      if (!result[field] || typeof result[field] !== 'object') {
        return false;
      }
    }

    // Validate tone structure
    if (!result.tone.primary || typeof result.tone.primary !== 'string') {
      return false;
    }

    // Validate formality structure
    if (!result.formality.level || !['high', 'medium', 'low'].includes(result.formality.level)) {
      return false;
    }

    // Validate completeness structure
    if (typeof result.completeness.score !== 'number') {
      return false;
    }

    // Validate politeness structure
    if (!result.politeness.level || !['high', 'medium', 'low'].includes(result.politeness.level)) {
      return false;
    }

    // Validate directness structure
    if (!result.directness.level || !['high', 'medium', 'low'].includes(result.directness.level)) {
      return false;
    }

    // Validate overall quality structure
    if (typeof result.overallQuality.score !== 'number') {
      return false;
    }

    return true;
  }
}

/**
 * @module contract-analysis-agent
 * @description Agent responsible for analyzing contracts and legal documents.
 * It provides insights into contract terms, risks, and recommendations.
 */

import { BaseAgent, AgentResponse } from "./base-agent";

/**
 * @interface ContractAnalysisInput
 * @description Defines the input structure for the ContractAnalysisAgent.
 * It includes the contract content and optional context for analysis.
 */
export interface ContractAnalysisInput {
  contract: {
    title: string;
    content: string;
    type?: "employment" | "service" | "purchase" | "lease" | "nda" | "other";
    language?: string;
  };
  analysisType?: "terms" | "risks" | "compliance" | "all";
  context?: {
    jurisdiction?: string;
    applicableLaws?: string[];
    partyRole?: "buyer" | "seller" | "employee" | "employer" | "client" | "vendor";
    priorityAreas?: string[];
  };
}

/**
 * @interface ContractAnalysisResult
 * @description Defines the structure of the contract analysis result.
 * It includes various metrics and insights about the contract.
 */
export interface ContractAnalysisResult {
  terms: {
    keyTerms: Array<{
      term: string;
      description: string;
      importance: "high" | "medium" | "low";
      riskLevel: "high" | "medium" | "low";
    }>;
    missingTerms: string[];
    unusualTerms: string[];
  };
  risks: {
    overallRiskLevel: "high" | "medium" | "low";
    riskFactors: Array<{
      factor: string;
      description: string;
      severity: "high" | "medium" | "low";
      mitigation: string;
    }>;
    redFlags: string[];
  };
  compliance: {
    complianceScore: number;
    complianceIssues: Array<{
      issue: string;
      description: string;
      severity: "high" | "medium" | "low";
      recommendation: string;
    }>;
    applicableLaws: string[];
  };
  recommendations: {
    priority: "high" | "medium" | "low";
    actions: Array<{
      action: string;
      description: string;
      urgency: "immediate" | "short-term" | "long-term";
    }>;
    negotiationPoints: string[];
  };
  summary: {
    overallAssessment: string;
    keyTakeaways: string[];
    nextSteps: string[];
  };
}

/**
 * @class ContractAnalysisAgent
 * @description Agent responsible for analyzing contracts and legal documents.
 * It provides insights into contract terms, risks, and recommendations.
 */
export class ContractAnalysisAgent extends BaseAgent {
  /**
   * Generates the system prompt for the ContractAnalysisAgent.
   * @param {any} [context] Optional context to tailor the system prompt.
   * @returns {string} The system prompt.
   */
  getSystemPrompt(context?: any): string {
    return `You are an AI assistant specialized in analyzing contracts and legal documents. Your task is to provide comprehensive insights into contract terms, risks, compliance issues, and actionable recommendations.

Analysis Guidelines:
- Terms Analysis: Identify key terms, missing terms, and unusual clauses
- Risk Assessment: Evaluate potential risks and their severity levels
- Compliance Check: Assess compliance with applicable laws and regulations
- Recommendations: Provide actionable advice for improvement and negotiation
- Legal Disclaimer: Always include appropriate legal disclaimers

Important Notes:
- This analysis is for informational purposes only and does not constitute legal advice
- Always recommend consulting with qualified legal professionals
- Consider jurisdiction-specific laws and regulations
- Focus on practical, actionable insights

Context: ${context ? JSON.stringify(context) : 'No additional context provided'}`;
  }

  /**
   * Formats the user input into a full prompt for the AI model.
   * @param {ContractAnalysisInput} input The user-provided input for the agent.
   * @param {any} [context] Optional context to help format the prompt.
   * @returns {string} The formatted prompt.
   */
  formatPrompt(input: ContractAnalysisInput, context?: any): string {
    const { contract, analysisType = "all", context: inputContext } = input;
    const combinedContext = { ...context, ...inputContext };

    return `Please analyze the following contract and provide comprehensive insights:

**Contract Details:**
- Title: ${contract.title}
- Type: ${contract.type || 'Not specified'}
- Language: ${contract.language || 'English'}
- Content: ${contract.content}

**Analysis Requirements:**
- Analysis Type: ${analysisType}
- Jurisdiction: ${combinedContext?.jurisdiction || 'Not specified'}
- Applicable Laws: ${combinedContext?.applicableLaws?.join(', ') || 'Not specified'}
- Party Role: ${combinedContext?.partyRole || 'Not specified'}
- Priority Areas: ${combinedContext?.priorityAreas?.join(', ') || 'Not specified'}

**Please provide analysis in the following JSON format:**
{
  "terms": {
    "keyTerms": [
      {
        "term": "string",
        "description": "string",
        "importance": "high|medium|low",
        "riskLevel": "high|medium|low"
      }
    ],
    "missingTerms": ["string array"],
    "unusualTerms": ["string array"]
  },
  "risks": {
    "overallRiskLevel": "high|medium|low",
    "riskFactors": [
      {
        "factor": "string",
        "description": "string",
        "severity": "high|medium|low",
        "mitigation": "string"
      }
    ],
    "redFlags": ["string array"]
  },
  "compliance": {
    "complianceScore": number,
    "complianceIssues": [
      {
        "issue": "string",
        "description": "string",
        "severity": "high|medium|low",
        "recommendation": "string"
      }
    ],
    "applicableLaws": ["string array"]
  },
  "recommendations": {
    "priority": "high|medium|low",
    "actions": [
      {
        "action": "string",
        "description": "string",
        "urgency": "immediate|short-term|long-term"
      }
    ],
    "negotiationPoints": ["string array"]
  },
  "summary": {
    "overallAssessment": "string",
    "keyTakeaways": ["string array"],
    "nextSteps": ["string array"]
  }
}

**Legal Disclaimer:**
This analysis is for informational purposes only and does not constitute legal advice. Always consult with qualified legal professionals before making any legal decisions.

Please ensure the analysis is thorough, objective, and actionable.`;
  }

  /**
   * Post-processes the agent's response to ensure it meets the requirements for contract analysis.
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
        // Add legal disclaimer if not present
        if (!analysisResult.legalDisclaimer) {
          analysisResult.legalDisclaimer = "This analysis is for informational purposes only and does not constitute legal advice. Always consult with qualified legal professionals before making any legal decisions.";
        }

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
          },
          legalDisclaimer: "This analysis is for informational purposes only and does not constitute legal advice. Always consult with qualified legal professionals before making any legal decisions."
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
        },
        legalDisclaimer: "This analysis is for informational purposes only and does not constitute legal advice. Always consult with qualified legal professionals before making any legal decisions."
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

    const requiredFields = ['terms', 'risks', 'compliance', 'recommendations', 'summary'];
    
    for (const field of requiredFields) {
      if (!result[field] || typeof result[field] !== 'object') {
        return false;
      }
    }

    // Validate terms structure
    if (!Array.isArray(result.terms.keyTerms)) {
      return false;
    }

    // Validate risks structure
    if (!result.risks.overallRiskLevel || !['high', 'medium', 'low'].includes(result.risks.overallRiskLevel)) {
      return false;
    }

    // Validate compliance structure
    if (typeof result.compliance.complianceScore !== 'number') {
      return false;
    }

    // Validate recommendations structure
    if (!result.recommendations.priority || !['high', 'medium', 'low'].includes(result.recommendations.priority)) {
      return false;
    }

    // Validate summary structure
    if (!result.summary.overallAssessment || typeof result.summary.overallAssessment !== 'string') {
      return false;
    }

    return true;
  }
}

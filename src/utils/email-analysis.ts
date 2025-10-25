/**
 * @module email-analysis
 * @description Email content analysis utilities for multi-provider comparison and content enhancement.
 * This module provides functions for analyzing email tone, formality, directness, politeness,
 * and completeness to help users make informed decisions about AI-generated email content.
 */

/**
 * Analyzes the tone of a given text content based on keyword indicators.
 * @param {string} content The text content to analyze.
 * @returns {string} The dominant tone detected (e.g., 'formal', 'casual', 'assertive', 'diplomatic', 'direct', or 'neutral').
 */
export function analyzeTone(content: string): string {
  const lowerContent = content.toLowerCase();

  const toneIndicators = {
    formal: ['dear', 'sincerely', 'respectfully', 'please', 'thank you', 'would like', 'i am writing'],
    casual: ['hi', 'hey', 'thanks', 'gonna', 'you\'re', 'we\'re', 'let\'s'],
    assertive: ['need', 'must', 'require', 'immediately', 'urgent', 'deadline'],
    diplomatic: ['understand', 'appreciate', 'consider', 'perhaps', 'suggest', 'recommend'],
    direct: ['yes', 'no', 'will', 'cannot', 'won\'t', 'refuse', 'decline']
  };

  const scores = Object.entries(toneIndicators).map(([tone, indicators]) => ({
    tone,
    score: indicators.reduce((sum, indicator) =>
      sum + (lowerContent.includes(indicator) ? 1 : 0), 0)
  }));

  const dominantTone = scores.reduce((prev, current) =>
    current.score > prev.score ? current : prev);

  return dominantTone.score > 0 ? dominantTone.tone : 'neutral';
}

/**
 * Analyzes the formality level of a given text content.
 * @param {string} content The text content to analyze.
 * @returns {string} The formality level ('formal', 'informal', or 'neutral').
 */
export function analyzeFormalityLevel(content: string): string {
  const formalIndicators = [
    'dear', 'sincerely', 'yours truly', 'respectfully', 'please find attached',
    'i am writing to', 'we would like to', 'thank you for your time'
  ];

  const informalIndicators = [
    'hi', 'hey', 'thanks', 'gonna', 'you\'re', 'we\'re', 'let\'s', 'can\'t', 'won\'t'
  ];

  const lowerContent = content.toLowerCase();

  const formalScore = formalIndicators.reduce((sum, indicator) =>
    sum + (lowerContent.includes(indicator) ? 1 : 0), 0);

  const informalScore = informalIndicators.reduce((sum, indicator) =>
    sum + (lowerContent.includes(indicator) ? 1 : 0), 0);

  if (formalScore > informalScore + 1) return 'formal';
  if (informalScore > formalScore + 1) return 'informal';
  return 'neutral';
}

/**
 * Analyzes the directness of a given text content.
 * @param {string} content The text content to analyze.
 * @returns {string} The directness level ('direct', 'indirect', or 'moderate').
 */
export function analyzeDirectness(content: string): string {
  const directIndicators = [
    'no', 'yes', 'will not', 'cannot', 'must', 'need to', 'require', 'deadline'
  ];

  const indirectIndicators = [
    'perhaps', 'maybe', 'might', 'could', 'suggest', 'consider', 'would be nice'
  ];

  const lowerContent = content.toLowerCase();

  const directScore = directIndicators.reduce((sum, indicator) =>
    sum + (lowerContent.includes(indicator) ? 1 : 0), 0);

  const indirectScore = indirectIndicators.reduce((sum, indicator) =>
    sum + (lowerContent.includes(indicator) ? 1 : 0), 0);

  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;

  if (directScore > indirectScore && avgSentenceLength < 15) return 'direct';
  if (indirectScore > directScore && avgSentenceLength > 20) return 'indirect';
  return 'moderate';
}

/**
 * Analyzes the politeness of a given text content.
 * @param {string} content The text content to analyze.
 * @returns {string} The politeness level ('polite', 'direct', or 'neutral').
 */
export function analyzePoliteness(content: string): string {
  const politeIndicators = [
    'please', 'thank you', 'appreciate', 'grateful', 'kind', 'respectfully',
    'would you mind', 'if possible', 'when convenient'
  ];

  const impoliteIndicators = [
    'must', 'demand', 'immediately', 'unacceptable', 'wrong', 'mistake'
  ];

  const lowerContent = content.toLowerCase();

  const politeScore = politeIndicators.reduce((sum, indicator) =>
    sum + (lowerContent.includes(indicator) ? 1 : 0), 0);

  const impoliteScore = impoliteIndicators.reduce((sum, indicator) =>
    sum + (lowerContent.includes(indicator) ? 1 : 0), 0);

  if (politeScore > impoliteScore + 1) return 'polite';
  if (impoliteScore > politeScore) return 'direct';
  return 'neutral';
}

/**
 * Analyzes the completeness of a reply in relation to the original content.
 * @param {string} replyContent The content of the reply.
 * @param {string} originalContent The content of the original message.
 * @returns {string} The completeness level ('comprehensive', 'adequate', or 'brief').
 */
export function analyzeCompleteness(replyContent: string, originalContent: string): string {
  const originalSentences = originalContent.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const replySentences = replyContent.split(/[.!?]+/).filter(s => s.trim().length > 5);

  // Simple heuristic: replies should be proportional to original length
  const lengthRatio = replyContent.length / originalContent.length;

  if (lengthRatio > 0.5 && replySentences.length >= 3) return 'comprehensive';
  if (lengthRatio > 0.2 && replySentences.length >= 2) return 'adequate';
  return 'brief';
}

/**
 * Generates suggestions for improving email content based on a target tone.
 * @param {string} content The email content to analyze.
 * @param {string} targetTone The desired tone (e.g., 'professional').
 * @returns {string[]} An array of improvement suggestions.
 */
export function generateImprovementSuggestions(content: string, targetTone: string): string[] {
  const suggestions: string[] = [];
  const lowerContent = content.toLowerCase();

  if (targetTone === 'professional') {
    if (!lowerContent.includes('dear') && !lowerContent.includes('hello')) {
      suggestions.push('Consider adding a formal greeting');
    }
    if (!lowerContent.includes('thank you') && !lowerContent.includes('appreciate')) {
      suggestions.push('Add expressions of gratitude');
    }
    if (!lowerContent.includes('sincerely') && !lowerContent.includes('regards')) {
      suggestions.push('Include a professional closing');
    }
  }

  if (content.split(/[.!?]+/).some(sentence => sentence.split(' ').length > 25)) {
    suggestions.push('Consider breaking down long sentences for clarity');
  }

  return suggestions;
}

/**
 * Summarizes the distribution of tones from multiple provider comparisons.
 * @param {any[]} comparisons An array of comparison objects from different providers.
 * @returns {Record<string, number>} An object mapping each tone to its frequency.
 */
export function summarizeToneDistribution(comparisons: any[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  comparisons.forEach(comp => {
    if (!comp.hasError && comp.analysis?.tone) {
      distribution[comp.analysis.tone] = (distribution[comp.analysis.tone] || 0) + 1;
    }
  });

  return distribution;
}

/**
 * Determines the recommended AI provider based on a scoring of their generated responses.
 * @param {any[]} comparisons An array of comparison objects from different providers.
 * @returns {string} The name of the recommended provider, or 'none'.
 */
export function determineRecommendedProvider(comparisons: any[]): string {
  const successfulComparisons = comparisons.filter(c => !c.hasError);

  if (successfulComparisons.length === 0) return 'none';

  // Simple scoring: prioritize balance of completeness, politeness, and response time
  const scored = successfulComparisons.map(comp => ({
    provider: comp.provider,
    score: (
      (comp.analysis?.completeness === 'comprehensive' ? 3 : comp.analysis?.completeness === 'adequate' ? 2 : 1) +
      (comp.analysis?.politeness === 'polite' ? 2 : comp.analysis?.politeness === 'neutral' ? 1 : 0) +
      (comp.responseTime < 2000 ? 2 : comp.responseTime < 5000 ? 1 : 0)
    )
  }));

  return scored.reduce((best, current) => current.score > best.score ? current : best).provider;
}

/**
 * Finds the provider that generated the most formal response.
 * @param {any[]} comparisons An array of comparison objects.
 * @returns {string} The name of the provider with the most formal response, or 'none'.
 */
export function findMostFormal(comparisons: any[]): string {
  const formal = comparisons
    .filter(c => !c.hasError && c.analysis?.formalityLevel === 'formal')
    .sort((a, b) => b.analysis.wordCount - a.analysis.wordCount)[0];

  return formal?.provider || 'none';
}

/**
 * Finds the provider that generated the most direct response.
 * @param {any[]} comparisons An array of comparison objects.
 * @returns {string} The name of the provider with the most direct response, or 'none'.
 */
export function findMostDirect(comparisons: any[]): string {
  const direct = comparisons
    .filter(c => !c.hasError && c.analysis?.directness === 'direct')
    .sort((a, b) => a.analysis.wordCount - b.analysis.wordCount)[0];

  return direct?.provider || 'none';
}

/**
 * Finds the provider that generated the most polite response.
 * @param {any[]} comparisons An array of comparison objects.
 * @returns {string} The name of the provider with the most polite response, or 'none'.
 */
export function findMostPolite(comparisons: any[]): string {
  const polite = comparisons
    .filter(c => !c.hasError && c.analysis?.politeness === 'polite')
    .sort((a, b) => b.analysis.wordCount - a.analysis.wordCount)[0];

  return polite?.provider || 'none';
}

/**
 * Finds the provider that generated the most complete response.
 * @param {any[]} comparisons An array of comparison objects.
 * @returns {string} The name of the provider with the most complete response, or 'none'.
 */
export function findMostComplete(comparisons: any[]): string {
  const complete = comparisons
    .filter(c => !c.hasError && c.analysis?.completeness === 'comprehensive')
    .sort((a, b) => b.analysis.wordCount - a.analysis.wordCount)[0];

  return complete?.provider || 'none';
}

/**
 * Calculates a quality score for a generated email response based on its analysis.
 * @param {any} analysis The analysis object of the response.
 * @returns {number} A numerical quality score.
 */
export function calculateQualityScore(analysis: any): number {
  let score = 0;

  // Word count score (optimal range: 50-200 words)
  const wordCount = analysis.wordCount;
  if (wordCount >= 50 && wordCount <= 200) score += 3;
  else if (wordCount >= 30 && wordCount <= 300) score += 2;
  else score += 1;

  // Tone appropriateness
  if (analysis.tone === 'formal' || analysis.tone === 'diplomatic') score += 2;
  else if (analysis.tone === 'neutral') score += 1;

  // Politeness
  if (analysis.politeness === 'polite') score += 2;
  else if (analysis.politeness === 'neutral') score += 1;

  return Math.min(score, 7); // Max score of 7
}

/**
 * Analyzes how well a generated reply addresses identified communication risks in a thread.
 * @param {string} content The content of the generated reply.
 * @param {any} riskIndicators An object containing identified risks (e.g., evasiveness, contradictions).
 * @returns {any | null} An object indicating which risks were addressed, or null if no risks were provided.
 */
export function analyzeRiskAddressing(content: string, riskIndicators: any): any {
  if (!riskIndicators) return null;

  const lowerContent = content.toLowerCase();
  const addressed = {
    evasiveness: false,
    contradictions: false,
    topicShifts: false
  };

  // Check if the reply addresses evasiveness with directness
  if (riskIndicators.evasiveResponses > 0) {
    const directTerms = ['specifically', 'exactly', 'precisely', 'clearly', 'directly'];
    addressed.evasiveness = directTerms.some(term => lowerContent.includes(term));
  }

  // Check if the reply addresses contradictions
  if (riskIndicators.contradictions > 0) {
    const clarifyingTerms = ['clarify', 'consistent', 'understand', 'confirm', 'accurate'];
    addressed.contradictions = clarifyingTerms.some(term => lowerContent.includes(term));
  }

  // Check if the reply stays on topic
  if (riskIndicators.topicShifts > 0) {
    const focusTerms = ['regarding', 'concerning', 'about', 'focus', 'specifically'];
    addressed.topicShifts = focusTerms.some(term => lowerContent.includes(term));
  }

  return addressed;
}

/**
 * Generates primary and alternative recommendations for which draft to use based on analysis and thread context.
 * @param {any[]} draftAnalyses An array of analysis objects for each draft.
 * @param {any} threadAnalysis The analysis object for the entire email thread.
 * @returns {any} An object containing recommended actions and considerations.
 */
export function generateWorkflowRecommendations(draftAnalyses: any[], threadAnalysis: any): any {
  const successful = draftAnalyses.filter(d => !d.hasError && d.contentAnalysis);

  if (successful.length === 0) {
    return {
      primary: "No successful drafts generated",
      alternative: "Check provider availability and try again",
      considerations: []
    };
  }

  const recommendations = {
    primary: "",
    alternative: "",
    considerations: [] as string[]
  };

  // Analyze thread risk context
  const hasHighRisk = threadAnalysis?.riskIndicators &&
    (threadAnalysis.riskIndicators.evasiveResponses > 1 ||
     threadAnalysis.riskIndicators.contradictions > 0);

  if (hasHighRisk) {
    // Recommend more direct approaches for high-risk situations
    const directDrafts = successful.filter(d => d.contentAnalysis.directness === 'direct');
    if (directDrafts.length > 0) {
      recommendations.primary = `Use ${directDrafts[0].provider} draft - most direct approach suitable for addressing evasive patterns`;
    } else {
      recommendations.primary = "Consider manual editing to increase directness given thread risk indicators";
    }

    recommendations.considerations.push("Thread shows concerning communication patterns");
    recommendations.considerations.push("Direct, specific language recommended");
  } else {
    // Standard professional recommendation
    const politeAndComplete = successful.filter(d =>
      d.contentAnalysis.politeness === 'polite' &&
      d.contentAnalysis.completeness !== 'brief'
    );

    if (politeAndComplete.length > 0) {
      recommendations.primary = `Use ${politeAndComplete[0].provider} draft - good balance of politeness and completeness`;
    } else {
      recommendations.primary = `Use ${successful[0].provider} draft - best available option`;
    }
  }

  // Alternative recommendation
  if (successful.length > 1) {
    const alternative = successful.find(d => d.provider !== successful[0].provider);
    if (alternative) {
      recommendations.alternative = `Alternative: ${alternative.provider} draft offers ${alternative.contentAnalysis.tone} tone`;
    }
  }

  // Additional considerations
  if (threadAnalysis?.analysisResults?.length > 0) {
    recommendations.considerations.push(`Thread contains ${threadAnalysis.analysisResults.length} analyzed communication patterns`);
  }

  const avgResponseTime = successful.reduce((sum, d) => sum + (d.responseTime || 0), 0) / successful.length;
  if (avgResponseTime > 3000) {
    recommendations.considerations.push("Response generation took longer than usual - consider provider performance");
  }

  return recommendations;
}

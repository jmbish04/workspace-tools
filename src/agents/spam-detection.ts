/**
 * @module SpamDetectionAgent
 * @description AI-powered spam detection with rule-based fallbacks
 */

import { AgentConfig, BaseAgent } from '../agents';
import { BaseProvider } from '../providers';

export interface SpamAnalysis {
  isSpam: boolean;
  confidence: number;
  spamScore: number;
  spamType: 'PHISHING' | 'PROMOTIONAL' | 'MALWARE' | 'SUSPICIOUS' | 'LEGITIMATE';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
  detectionMethod: 'AI' | 'RULES' | 'HYBRID';
}

export interface EmailForAnalysis {
  messageId: string;
  fromAddress: string;
  subject: string;
  bodyPlain?: string;
  bodyHtml?: string;
  attachments?: Array<{
    fileName: string;
    mimeType: string;
    fileSize: number;
  }>;
  headers?: Record<string, string>;
  // Gmail-specific data
  labelIds?: string[];
  gmailData?: {
    snippet?: string;
    sizeEstimate?: number;
    historyId?: string;
    internalDate?: string;
    authentication?: {
      dkim?: string;
      spf?: string;
      dmarc?: string;
    };
  };
}

export class SpamDetectionAgent extends BaseAgent {
  private spamDb: D1Database;
  private spamPatterns: Map<string, RegExp> = new Map();

  constructor(config: AgentConfig, providers: Map<string, BaseProvider>, spamDb: D1Database) {
    super(config, providers);
    this.spamDb = spamDb;
    this.loadSpamPatterns();
  }

  getSystemPrompt(): string {
    return `You are an expert email spam detection system. Analyze emails for spam, phishing, malware, and suspicious content.

Your task is to:
1. Determine if the email is spam (true/false)
2. Assign a spam score (0.0 = definitely legitimate, 1.0 = definitely spam)
3. Classify the type if spam: PHISHING, PROMOTIONAL, MALWARE, SUSPICIOUS
4. Assign risk level: LOW, MEDIUM, HIGH, CRITICAL
5. Provide specific reasons for your classification

Consider these factors:
- Sender reputation and domain
- Subject line patterns (urgent language, excessive caps, suspicious chars)
- Content analysis (grammar, suspicious links, credential requests)
- Attachment types and names
- Email headers and authentication results
- Known spam patterns and phishing indicators

Respond ONLY with valid JSON in this format:
{
  "isSpam": boolean,
  "confidence": number (0.0-1.0),
  "spamScore": number (0.0-1.0),
  "spamType": "PHISHING|PROMOTIONAL|MALWARE|SUSPICIOUS|LEGITIMATE",
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "reasons": ["reason1", "reason2", ...]
}`;
  }

  formatPrompt(email: EmailForAnalysis): string {
    const attachmentInfo = email.attachments?.length
      ? `\nAttachments: ${email.attachments.map(a => `${a.fileName} (${a.mimeType}, ${a.fileSize} bytes)`).join(', ')}`
      : '';

    const gmailLabels = email.labelIds?.length
      ? `\nGmail Labels: ${email.labelIds.join(', ')}`
      : '';

    const authInfo = email.gmailData?.authentication
      ? `\nAuthentication: DKIM=${email.gmailData.authentication.dkim}, SPF=${email.gmailData.authentication.spf}, DMARC=${email.gmailData.authentication.dmarc}`
      : '';

    return `Analyze this email for spam:

FROM: ${email.fromAddress}
SUBJECT: ${email.subject}${gmailLabels}${authInfo}${attachmentInfo}

BODY (Plain):
${email.bodyPlain || 'No plain text content'}

BODY (HTML):
${email.bodyHtml ? email.bodyHtml.substring(0, 2000) + (email.bodyHtml.length > 2000 ? '...' : '') : 'No HTML content'}

Please analyze and respond with the JSON classification.`;
  }

  // Required abstract method implementation
  postProcessResponse(response: any): any {
    return response;
  }

  async analyzeEmail(email: EmailForAnalysis): Promise<SpamAnalysis> {
    console.log(`[SpamDetectionAgent] Analyzing email: ${email.messageId}`);

    try {
      // First, try rule-based detection for quick wins
      const ruleBasedResult = await this.applyRuleBasedDetection(email);

      // If rules are confident, use them
      if (ruleBasedResult.confidence >= 0.9) {
        console.log(`[SpamDetectionAgent] High confidence rule-based detection: ${ruleBasedResult.spamScore}`);
        return { ...ruleBasedResult, detectionMethod: 'RULES' };
      }

      // Otherwise, use AI analysis
      const aiResult = await this.performAIAnalysis(email);

      // Combine rule-based and AI results
      const hybridResult = this.combineResults(ruleBasedResult, aiResult);

      // Store result for learning
      await this.storeAnalysisResult(email, hybridResult);

      return hybridResult;

    } catch (error) {
      console.error(`[SpamDetectionAgent] Error analyzing email ${email.messageId}:`, error);

      // Fallback to conservative rule-based only
      const fallbackResult = await this.applyRuleBasedDetection(email);
      return { ...fallbackResult, detectionMethod: 'RULES' };
    }
  }

  private async performAIAnalysis(email: EmailForAnalysis): Promise<SpamAnalysis> {
    const response = await this.execute(email);

    if (!response.aggregatedResult?.bestResponse?.content) {
      throw new Error('No AI response received');
    }

    try {
      const aiAnalysis = JSON.parse(response.aggregatedResult.bestResponse.content);

      return {
        isSpam: aiAnalysis.isSpam,
        confidence: aiAnalysis.confidence,
        spamScore: aiAnalysis.spamScore,
        spamType: aiAnalysis.spamType,
        riskLevel: aiAnalysis.riskLevel,
        reasons: aiAnalysis.reasons || [],
        detectionMethod: 'AI'
      };
    } catch (parseError) {
      console.error('[SpamDetectionAgent] Failed to parse AI response:', parseError);
      throw new Error('Invalid AI response format');
    }
  }

  private async applyRuleBasedDetection(email: EmailForAnalysis): Promise<SpamAnalysis> {
    let spamScore = 0.0;
    const reasons: string[] = [];
    let spamType: SpamAnalysis['spamType'] = 'LEGITIMATE';
    let riskLevel: SpamAnalysis['riskLevel'] = 'LOW';

    // Check sender reputation
    const senderScore = await this.checkSenderReputation(email.fromAddress);
    spamScore += senderScore;
    if (senderScore > 0.3) reasons.push('Poor sender reputation');

    // Gmail labels analysis
    const labelScore = this.analyzeGmailLabels(email.labelIds || []);
    spamScore += labelScore;
    if (labelScore > 0.2) reasons.push('Promotional/spam labels detected');

    // Authentication analysis
    const authScore = this.analyzeAuthentication(email.gmailData?.authentication);
    spamScore += authScore;
    if (authScore > 0.3) reasons.push('Failed email authentication');

    // Subject line analysis
    const subjectScore = this.analyzeSubject(email.subject);
    spamScore += subjectScore;
    if (subjectScore > 0.2) reasons.push('Suspicious subject line');

    // Content analysis
    const contentScore = this.analyzeContent(email.bodyPlain || '', email.bodyHtml || '');
    spamScore += contentScore;
    if (contentScore > 0.2) reasons.push('Suspicious content patterns');

    // Attachment analysis
    if (email.attachments?.length) {
      const attachmentScore = this.analyzeAttachments(email.attachments);
      spamScore += attachmentScore;
      if (attachmentScore > 0.3) reasons.push('Suspicious attachments');
    }

    // Normalize score
    spamScore = Math.min(spamScore, 1.0);

    // Determine classification
    if (spamScore >= 0.8) {
      spamType = 'SUSPICIOUS';
      riskLevel = 'HIGH';
    } else if (spamScore >= 0.6) {
      spamType = 'PROMOTIONAL';
      riskLevel = 'MEDIUM';
    } else if (spamScore >= 0.4) {
      spamType = 'SUSPICIOUS';
      riskLevel = 'LOW';
    }

    return {
      isSpam: spamScore >= 0.5,
      confidence: spamScore >= 0.8 ? 0.9 : 0.6,
      spamScore,
      spamType,
      riskLevel,
      reasons,
      detectionMethod: 'RULES'
    };
  }

  private async checkSenderReputation(email: string): Promise<number> {
    try {
      const result = await this.spamDb
        .prepare(`SELECT reputation_score FROM sender_reputation WHERE email_address = ?`)
        .bind(email)
        .first<{ reputation_score: number }>();

      if (result?.reputation_score !== undefined) {
        return Math.max(0, 1 - result.reputation_score); // Convert reputation to spam score
      }

      // Check domain reputation if no specific email reputation
      const domain = email.split('@')[1];
      const domainResult = await this.spamDb
        .prepare(`SELECT AVG(reputation_score) as avg_score FROM sender_reputation WHERE domain = ?`)
        .bind(domain)
        .first<{ avg_score: number }>();

      return domainResult?.avg_score ? Math.max(0, 1 - domainResult.avg_score) : 0.1;
    } catch (error) {
      console.error('[SpamDetectionAgent] Error checking sender reputation:', error);
      return 0.1; // Default low suspicion
    }
  }

  private analyzeGmailLabels(labelIds: string[]): number {
    let score = 0;
    const reasons: string[] = [];

    // Gmail's own spam/promotion detection
    if (labelIds.includes('SPAM')) {
      score += 0.8;
      reasons.push('Gmail marked as SPAM');
    }

    if (labelIds.includes('CATEGORY_PROMOTIONS')) {
      score += 0.3; // Promotional but not necessarily spam
      reasons.push('Gmail categorized as promotional');
    }

    if (labelIds.includes('CATEGORY_SOCIAL')) {
      score += 0.1; // Social networks, usually legitimate
    }

    if (labelIds.includes('CATEGORY_UPDATES')) {
      score += 0.1; // Updates/notifications, usually legitimate
    }

    // Custom labels that might indicate spam
    const spamIndicatorLabels = labelIds.filter(label =>
      label.toLowerCase().includes('spam') ||
      label.toLowerCase().includes('junk') ||
      label.toLowerCase().includes('block')
    );

    if (spamIndicatorLabels.length > 0) {
      score += 0.5;
      reasons.push('Custom spam labels detected');
    }

    return Math.min(score, 0.4); // Cap at 0.4 since labels alone shouldn't determine spam
  }

  private analyzeAuthentication(auth?: { dkim?: string; spf?: string; dmarc?: string }): number {
    if (!auth) return 0.2; // No auth info is suspicious

    let score = 0;

    // DKIM failure is serious
    if (auth.dkim === 'FAIL') score += 0.3;
    else if (auth.dkim === 'NEUTRAL' || auth.dkim === 'TEMPERROR') score += 0.1;

    // SPF failure is suspicious
    if (auth.spf === 'FAIL' || auth.spf === 'SOFTFAIL') score += 0.2;
    else if (auth.spf === 'NEUTRAL' || auth.spf === 'TEMPERROR') score += 0.1;

    // DMARC failure is very suspicious
    if (auth.dmarc === 'FAIL') score += 0.4;

    // All passing is a good sign (but could still be spam)
    if (auth.dkim === 'PASS' && auth.spf === 'PASS' && auth.dmarc === 'PASS') {
      score -= 0.1; // Slight reduction in spam score
    }

    return Math.max(score, 0); // Don't go negative
  }

  private analyzeSubject(subject: string): number {
    let score = 0;
    const lowerSubject = subject.toLowerCase();

    // Spam keywords
    const spamKeywords = [
      'urgent', 'act now', 'limited time', 'free money', 'click here',
      'winner', 'congratulations', 'offer expires', 'no obligation',
      'viagra', 'cialis', 'weight loss', 'make money', 'work from home'
    ];

    spamKeywords.forEach(keyword => {
      if (lowerSubject.includes(keyword)) score += 0.1;
    });

    // Excessive punctuation
    if (subject.match(/[!]{2,}/) || subject.match(/[?]{2,}/)) score += 0.1;

    // Excessive caps
    const capsRatio = (subject.match(/[A-Z]/g) || []).length / subject.length;
    if (capsRatio > 0.5) score += 0.2;

    // Suspicious characters
    if (subject.match(/[^\w\s\-.,!?()]/)) score += 0.1;

    return Math.min(score, 0.5);
  }

  private analyzeContent(plainText: string, htmlText: string): number {
    let score = 0;
    const content = (plainText + ' ' + htmlText).toLowerCase();

    // Phishing indicators
    const phishingPatterns = [
      /verify.{0,20}account/i,
      /update.{0,20}payment/i,
      /click.{0,30}link/i,
      /suspended.{0,20}account/i,
      /confirm.{0,20}identity/i
    ];

    phishingPatterns.forEach(pattern => {
      if (pattern.test(content)) score += 0.2;
    });

    // Suspicious URLs
    const urlMatches = content.match(/https?:\/\/[^\s]+/g) || [];
    const suspiciousUrls = urlMatches.filter(url =>
      url.includes('bit.ly') ||
      url.includes('tinyurl') ||
      url.match(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/) // IP addresses
    );

    if (suspiciousUrls.length > 0) score += 0.2;

    return Math.min(score, 0.4);
  }

  private analyzeAttachments(attachments: Array<{ fileName: string; mimeType: string; fileSize: number }>): number {
    let score = 0;

    const suspiciousMimeTypes = [
      'application/x-msdownload',
      'application/x-executable',
      'application/octet-stream'
    ];

    const suspiciousExtensions = ['.exe', '.scr', '.bat', '.cmd', '.pif', '.vbs'];

    attachments.forEach(attachment => {
      if (suspiciousMimeTypes.includes(attachment.mimeType)) score += 0.3;

      const hassuspicious = suspiciousExtensions.some(ext =>
        attachment.fileName.toLowerCase().endsWith(ext)
      );
      if (hassuspicious) score += 0.4;
    });

    return Math.min(score, 0.5);
  }

  private combineResults(ruleResult: SpamAnalysis, aiResult: SpamAnalysis): SpamAnalysis {
    // Weight AI more heavily but use rules as validation
    const combinedScore = (aiResult.spamScore * 0.7) + (ruleResult.spamScore * 0.3);
    const combinedConfidence = Math.max(aiResult.confidence, ruleResult.confidence);

    return {
      isSpam: combinedScore >= 0.5,
      confidence: combinedConfidence,
      spamScore: combinedScore,
      spamType: aiResult.spamType !== 'LEGITIMATE' ? aiResult.spamType : ruleResult.spamType,
      riskLevel: this.getHigherRiskLevel(aiResult.riskLevel, ruleResult.riskLevel),
      reasons: [...new Set([...aiResult.reasons, ...ruleResult.reasons])],
      detectionMethod: 'HYBRID'
    };
  }

  private getHigherRiskLevel(level1: SpamAnalysis['riskLevel'], level2: SpamAnalysis['riskLevel']): SpamAnalysis['riskLevel'] {
    const levels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    return levels[level1] >= levels[level2] ? level1 : level2;
  }

  private async storeAnalysisResult(email: EmailForAnalysis, analysis: SpamAnalysis): Promise<void> {
    try {
      await this.spamDb
        .prepare(`
          INSERT OR REPLACE INTO spam_messages (
            messageId, fromAddress, subject, spam_score, spam_reasons,
            detection_method, confidence, spam_type, risk_level, quarantined_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(
          email.messageId,
          email.fromAddress,
          email.subject,
          analysis.spamScore,
          JSON.stringify(analysis.reasons),
          analysis.detectionMethod,
          analysis.confidence,
          analysis.spamType,
          analysis.riskLevel
        )
        .run();

      // Update sender reputation
      await this.updateSenderReputation(email.fromAddress, analysis.isSpam);

    } catch (error) {
      console.error('[SpamDetectionAgent] Error storing analysis result:', error);
    }
  }

  private async updateSenderReputation(emailAddress: string, isSpam: boolean): Promise<void> {
    try {
      const domain = emailAddress.split('@')[1];

      await this.spamDb
        .prepare(`
          INSERT INTO sender_reputation (email_address, domain, total_emails, spam_count, legitimate_count, last_seen)
          VALUES (?, ?, 1, ?, ?, datetime('now'))
          ON CONFLICT(email_address) DO UPDATE SET
            total_emails = total_emails + 1,
            spam_count = spam_count + ?,
            legitimate_count = legitimate_count + ?,
            last_seen = datetime('now'),
            reputation_score = CAST(legitimate_count AS REAL) / CAST(total_emails AS REAL)
        `)
        .bind(
          emailAddress,
          domain,
          isSpam ? 1 : 0,
          isSpam ? 0 : 1,
          isSpam ? 1 : 0,
          isSpam ? 0 : 1
        )
        .run();
    } catch (error) {
      console.error('[SpamDetectionAgent] Error updating sender reputation:', error);
    }
  }

  private async loadSpamPatterns(): Promise<void> {
    try {
      const patterns = await this.spamDb
        .prepare(`SELECT pattern_type, regex_pattern FROM spam_patterns WHERE is_active = 1`)
        .all<{ pattern_type: string; regex_pattern: string }>();

      patterns.results.forEach(pattern => {
        try {
          this.spamPatterns.set(pattern.pattern_type, new RegExp(pattern.regex_pattern, 'i'));
        } catch (error) {
          console.error(`[SpamDetectionAgent] Invalid regex pattern: ${pattern.regex_pattern}`);
        }
      });
    } catch (error) {
      console.error('[SpamDetectionAgent] Error loading spam patterns:', error);
    }
  }
}

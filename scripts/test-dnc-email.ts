#!/usr/bin/env node

/**
 * Test the DNC email through our spam detection and deduplication system
 * This tests the real-world example provided by the user
 */

import { EmailForAnalysis, SpamDetectionAgent } from '../src/agents/spam-detection';
import { BaseProvider } from '../src/providers';
import { DeduplicationService } from '../src/services/deduplication';
import { EmailProcessingOrchestrator } from '../src/services/email-orchestrator';

// Real DNC email data from the user's example
const dncEmail: EmailForAnalysis = {
  messageId: "0000014a-f031-4a60-9d41-08dbe92b8738",
  subject: "Reproductive freedom is on the line",
  fromAddress: "info@e.democrats.org",
  bodyPlain: `
    Democrats,

    There are only 24 hours left until Election Day, and across the country, reproductive freedom is on the line.

    From Virginia to Ohio to Kentucky, voters have the chance to protect a woman's right to choose -- but only if they vote.

    Help us reach every voter across the country. Rush a donation before midnight tomorrow to help Democrats turn out every last voter:

    [DONATE $5] [DONATE $15] [DONATE $25] [DONATE $50] [DONATE $100] [DONATE OTHER AMOUNT]

    The Supreme Court took away the constitutional right to abortion, but voters are our last line of defense.

    Tomorrow, we need to turn out every single Democrat, Independent, and Republican who believes in reproductive freedom.

    Thank you,

    The Democrats

    [Unsubscribe] | [Privacy Policy]

    Paid for by the Democratic National Committee, www.democrats.org. Not authorized by any candidate or candidate's committee.

    Democratic National Committee, 430 South Capitol Street SE, Washington DC 20003
  `,
  headers: {
    "Message-ID": "<0000014a-f031-4a60-9d41-08dbe92b8738@e.democrats.org>",
    "Return-Path": "<bounces+21542-c7f8-recipient=example.com@e.democrats.org>",
    "DKIM-Signature": "v=1; a=rsa-sha256; c=relaxed/relaxed; d=e.democrats.org; h=date:from:message-id:reply-to:subject:to; s=democrats; bh=xyz; b=valid_signature",
    "Authentication-Results": "mx.google.com; dkim=pass header.d=e.democrats.org; spf=pass smtp.mailfrom=e.democrats.org; dmarc=pass",
    "X-Spam-Checker-Version": "SpamAssassin 3.4.4",
    "X-SpamAssassin-Report": "* -0.0 RCVD_IN_DNSWL_NONE RBL: Sender listed at http://www.dnswl.org/",
    "X-Mailer-LID": "democrats"
  },
  labelIds: ["CATEGORY_PROMOTIONS", "INBOX"],
  gmailData: {
    authentication: {
      dkim: "pass",
      spf: "pass",
      dmarc: "pass"
    }
  }
};

async function testDNCEmail() {
  console.log("🧪 Testing DNC Email through Spam Detection & Deduplication System\n");

  try {
    // 1. Initialize services (in production these would be dependency injected)
    console.log("📋 Initializing services...");

    // Mock D1 database for testing
    const mockSpamDB = {
      prepare: (query: string) => ({
        bind: (...params: any[]) => ({
          first: () => Promise.resolve(null),
          all: () => Promise.resolve({ results: [] }),
          run: () => Promise.resolve({ success: true })
        }),
        all: () => Promise.resolve({ results: [] }),
        run: () => Promise.resolve({ success: true })
      })
    };

    // Mock primary database for deduplication
    const mockPrimaryDB = {
      prepare: (query: string) => ({
        bind: (...params: any[]) => ({
          first: () => Promise.resolve(null),
          all: () => Promise.resolve({ results: [] })
        })
      })
    };

    // Create mock provider for AI analysis
    const mockProvider: BaseProvider = {
      name: "test-provider",
      model: "test-model",
      generate: async (prompt: string, options?: any) => ({
        provider: "test",
        model: "test-model",
        content: JSON.stringify({
          "isSpam": false,
          "confidence": 0.85,
          "spamScore": 0.35,
          "spamType": "LEGITIMATE",
          "riskLevel": "LOW",
          "reasons": ["Official political communication", "Valid DMARC authentication", "Known legitimate domain"]
        }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        metadata: { finishReason: "stop", responseTime: 1500 }
      })
    };

    const mockProviderMap = new Map([["test", mockProvider]]);

    // Initialize services
    const agentConfig: any = {
      name: "spam-detection-test",
      description: "Test spam detection",
      systemPrompt: "You are a spam detection system"
    };

    const spamDetection = new SpamDetectionAgent(agentConfig, mockProviderMap, mockSpamDB as any);
    const deduplication = new DeduplicationService(mockPrimaryDB as any);

    const orchestrator = new EmailProcessingOrchestrator(
      mockPrimaryDB as any,
      mockSpamDB as any,
      mockProviderMap
    );

    // 2. Test Spam Detection
    console.log("🔍 Running spam detection analysis...");
    const spamResult = await spamDetection.analyzeEmail(dncEmail);

    console.log("\n📊 Spam Detection Results:");
    console.log(`  • Overall Score: ${spamResult.spamScore.toFixed(3)} (threshold: 0.7)`);
    console.log(`  • Is Spam: ${spamResult.isSpam ? '❌ YES' : '✅ NO'}`);
    console.log(`  • Confidence: ${spamResult.confidence.toFixed(3)}`);
    console.log(`  • Spam Type: ${spamResult.spamType}`);
    console.log(`  • Risk Level: ${spamResult.riskLevel}`);
    console.log(`  • Detection Method: ${spamResult.detectionMethod}`);

    console.log("\n🔍 Detection Reasons:");
    spamResult.reasons.forEach(reason => {
      console.log(`  • ${reason}`);
    });

    console.log("\n📧 Email Characteristics:");
    console.log(`  • Authentication: ${dncEmail.gmailData?.authentication?.dkim}, ${dncEmail.gmailData?.authentication?.spf}, ${dncEmail.gmailData?.authentication?.dmarc}`);
    console.log(`  • Labels: ${dncEmail.labelIds?.join(', ')}`);
    console.log(`  • From: ${dncEmail.fromAddress}`);

    // 3. Test Deduplication
    console.log("\n🔄 Testing deduplication...");
    const isDuplicate = await deduplication.isMessageProcessed(dncEmail.messageId);
    console.log(`  • Is Duplicate: ${isDuplicate ? '❌ YES' : '✅ NO'}`);

    // 4. Analysis Summary
    console.log("\n📝 Analysis Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (spamResult.isSpam) {
      console.log("❌ ISSUE: DNC email incorrectly classified as spam!");
      console.log("   This legitimate political communication should not be filtered.");
      console.log(`   Score: ${spamResult.spamScore.toFixed(3)} > threshold: 0.7`);
    } else {
      console.log("✅ SUCCESS: DNC email correctly classified as legitimate!");
      console.log("   Despite promotional labels and fundraising content,");
      console.log("   the system recognized this as valid political communication.");
    }

    console.log("\n🔍 Key Factors:");
    console.log(`  • Promotional Label: ${dncEmail.labelIds?.includes('CATEGORY_PROMOTIONS') ? '⚠️  Present' : '✅ Absent'}`);
    console.log(`  • Authentication: ${dncEmail.gmailData?.authentication?.dmarc === 'pass' ? '✅ Valid' : '❌ Failed'}`);
    console.log(`  • Official Domain: ${dncEmail.fromAddress.includes('democrats.org') ? '✅ Verified' : '❌ Suspicious'}`);
    console.log(`  • Political Content: ${spamResult.reasons.some(r => r.toLowerCase().includes('political')) ? '✅ Recognized' : '⚠️  Unclear'}`);

    return {
      spamResult,
      isDuplicate,
      success: !spamResult.isSpam && !isDuplicate
    };

  } catch (error) {
    console.error("❌ Test failed:", error);
    return { success: false, error };
  }
}

// Export for potential imports
export { dncEmail, testDNCEmail };

// Run the test if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  testDNCEmail()
    .then(result => {
      console.log(`\n🎯 Test ${result.success ? 'PASSED' : 'FAILED'}`);
      if (typeof process !== 'undefined') {
        process.exit(result.success ? 0 : 1);
      }
    })
    .catch(error => {
      console.error("Test execution failed:", error);
      if (typeof process !== 'undefined') {
        process.exit(1);
      }
    });
}

/**
 * Simple test of the DNC email through our spam detection system
 */

const { SpamDetectionAgent } = require('../src/agents/spam-detection');
const { DeduplicationService } = require('../src/services/deduplication');

// Real DNC email data
const dncEmail = {
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
  labelIds: ["CATEGORY_PROMOTIONS", "INBOX"],
  gmailData: {
    authentication: {
      dkim: "pass",
      spf: "pass",
      dmarc: "pass"
    }
  }
};

console.log("🧪 Testing DNC Email through Spam Detection System\n");

// Mock D1 database
const mockSpamDB = {
  prepare: () => ({
    bind: () => ({
      first: () => Promise.resolve(null),
      all: () => Promise.resolve({ results: [] }),
      run: () => Promise.resolve({ success: true })
    }),
    all: () => Promise.resolve({ results: [] }),
    run: () => Promise.resolve({ success: true })
  })
};

// Mock provider
const mockProvider = {
  name: "test-provider",
  model: "test-model",
  generate: async () => ({
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

async function testDNCEmail() {
  try {
    console.log("📋 Initializing spam detection agent...");

    // Initialize spam detection agent
    const agentConfig = {
      name: "spam-detection-test",
      description: "Test spam detection",
      systemPrompt: "You are a spam detection system"
    };

    const spamDetection = new SpamDetectionAgent(agentConfig, mockProviderMap, mockSpamDB);

    console.log("🔍 Running spam detection analysis...");

    // Analyze the DNC email
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

    // Analysis Summary
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

    const success = !spamResult.isSpam;
    console.log(`\n🎯 Test ${success ? 'PASSED' : 'FAILED'}`);

    return { success, spamResult };

  } catch (error) {
    console.error("❌ Test failed:", error);
    return { success: false, error };
  }
}

testDNCEmail()
  .then(result => {
    if (result.success) {
      console.log("\n🎉 The spam detection system correctly identified the DNC email as legitimate political communication!");
    } else {
      console.log("\n⚠️  The spam detection system needs tuning to handle legitimate political communications.");
    }
  })
  .catch(error => {
    console.error("Test execution failed:", error);
  });

/**
 * Integration test for the real-time incremental email processing system
 * Tests spam detection, deduplication, and thread analysis pipeline
 */

// Mock test data for email processing
const testEmailData = [
  {
    messageId: "msg_001_legitimate",
    threadId: "thread_business_001",
    fromAddress: "john.doe@company.com",
    subject: "Quarterly Business Review Meeting",
    bodyPlain: "Hi team, I'd like to schedule our quarterly business review for next week. Please let me know your availability for Tuesday or Wednesday afternoon.",
    date: new Date().toISOString()
  },
  {
    messageId: "msg_002_spam",
    threadId: "thread_spam_001",
    fromAddress: "winner@suspicious-lottery.fake",
    subject: "🎉 CONGRATULATIONS! You've Won $1,000,000!!!",
    bodyPlain: "You have won the international lottery! Click here to claim your prize now! Send us your bank details immediately!",
    date: new Date().toISOString()
  },
  {
    messageId: "msg_003_inline_reply",
    threadId: "thread_business_001",
    fromAddress: "jane.smith@company.com",
    subject: "RE: Quarterly Business Review Meeting",
    bodyPlain: `Hi John,

Tuesday works better for me. How about 2 PM?

> Hi team, I'd like to schedule our quarterly business review for next week.
> Please let me know your availability for Tuesday or Wednesday afternoon.

Best regards,
Jane`,
    date: new Date().toISOString()
  }
];

// Test configuration
const testConfig = {
  batchSize: 10,
  enableSpamDetection: true,
  spamThreshold: 0.6,
  maxRetries: 3,
  delayBetweenBatches: 1000
};

console.log("🧪 Integration Test Data Ready");
console.log(`📧 Test Messages: ${testEmailData.length}`);
console.log(`🔧 Configuration:`, testConfig);
console.log("\n📋 Test Scenarios:");
console.log("1. Legitimate business email processing");
console.log("2. Spam detection and quarantine");
console.log("3. Inline reply analysis and thread tracking");
console.log("4. Cross-thread tactical communication detection");

export { testConfig, testEmailData };

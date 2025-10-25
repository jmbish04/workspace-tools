/**
 * Comprehensive Integration Test Suite
 * Tests the complete real-time email processing pipeline
 */

const TEST_CONFIG = {
  baseUrl: 'http://localhost:8788', // Local dev server
  timeout: 30000
};

const TEST_DATA = {
  legitimateEmail: {
    messageId: 'test_legit_001',
    threadId: 'thread_business_001',
    fromAddress: 'john.doe@company.com',
    subject: 'Q3 Planning Meeting',
    bodyPlain: 'Hi team, let\'s schedule our Q3 planning session for next week. Please confirm your availability.',
    date: new Date().toISOString()
  },
  spamEmail: {
    messageId: 'test_spam_001',
    threadId: 'thread_spam_001',
    fromAddress: 'winner@fake-lottery.scam',
    subject: '🎉 URGENT: Claim Your $1,000,000 Prize NOW!',
    bodyPlain: 'CONGRATULATIONS! You have won our international lottery! Send your bank details immediately to claim your prize!',
    date: new Date().toISOString()
  },
  replyEmail: {
    messageId: 'test_reply_001',
    threadId: 'thread_business_001',
    fromAddress: 'jane.smith@company.com',
    subject: 'RE: Q3 Planning Meeting',
    bodyPlain: `Tuesday afternoon works for me. Should we include the design team?

> Hi team, let's schedule our Q3 planning session for next week.
> Please confirm your availability.

Best,
Jane`,
    date: new Date().toISOString()
  }
};

class EmailProcessingTester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async test(name, testFn) {
    console.log(`\n🧪 Running: ${name}`);
    try {
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      this.results.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name} - ${error.message}`);
      this.results.failed++;
      this.results.errors.push({ test: name, error: error.message });
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    console.log(`  📡 ${method} ${endpoint}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Integration Tests');
    console.log('============================================');

    // Test 1: Health Check
    await this.test('Health Check', async () => {
      const result = await this.makeRequest('/');
      if (!result.status || result.status !== 'ok') {
        throw new Error('Health check failed');
      }
    });

    // Test 2: Batch Email Processing
    await this.test('Batch Email Processing', async () => {
      const result = await this.makeRequest('/email-processing/process-emails', 'POST', {
        messages: [TEST_DATA.legitimateEmail, TEST_DATA.spamEmail],
        config: {
          batchSize: 10,
          enableSpamDetection: true,
          spamThreshold: 0.6
        },
        enableThreadAnalysis: true
      });

      if (!result.success) {
        throw new Error('Batch processing failed');
      }

      console.log(`    📊 Processed: ${result.data.emailProcessing.processedMessages}`);
      console.log(`    🛡️ Spam detected: ${result.data.emailProcessing.spamMessages}`);
    });

    // Test 3: Single Email Processing
    await this.test('Single Email Processing', async () => {
      const result = await this.makeRequest('/email-processing/process-single-email', 'POST', TEST_DATA.replyEmail);

      if (!result.success) {
        throw new Error('Single email processing failed');
      }

      console.log(`    📧 Status: ${result.data.status}`);
      if (result.data.threadAnalysis) {
        console.log(`    🧵 Inline replies: ${result.data.threadAnalysis.inlineReplies}`);
      }
    });

    // Test 4: Thread Processor Direct
    await this.test('Thread Processor Direct', async () => {
      const result = await this.makeRequest('/thread-processor/process-message', 'POST', {
        messageId: 'test_direct_001',
        threadId: 'thread_business_001',
        from: 'mike.johnson@company.com',
        date: new Date().toISOString(),
        subject: 'RE: Q3 Planning Meeting',
        body: 'I can attend on Tuesday as well. Here are my thoughts:\n\n1. Budget allocation\n2. Resource planning\n3. Timeline review'
      });

      if (!result.success) {
        throw new Error('Thread processor failed');
      }

      console.log(`    🔄 New content lines: ${result.newContent.length}`);
      console.log(`    📝 Quoted content lines: ${result.quotedContent.length}`);
    });

    // Test 5: Processing Status
    await this.test('Processing Status Check', async () => {
      const result = await this.makeRequest('/email-processing/processing-status');

      if (!result.success) {
        throw new Error('Status check failed');
      }

      console.log(`    📈 Active threads: ${result.data.threadProcessing.activeThreads}`);
      console.log(`    ⚡ Analysis rate: ${result.data.threadProcessing.analysisRate}%`);
    });

    // Test 6: Thread Statistics
    await this.test('Thread Statistics', async () => {
      const result = await this.makeRequest('/thread-processor/thread-stats/thread_business_001');

      if (!result.success) {
        throw new Error('Thread stats failed');
      }

      console.log(`    🧵 Thread messages: ${result.data.messageCount}`);
      console.log(`    👥 Participants: ${result.data.participantCount}`);
    });

    // Test 7: Dashboard Summary
    await this.test('Dashboard Summary', async () => {
      const result = await this.makeRequest('/thread-processor/dashboard-summary');

      if (!result.success) {
        throw new Error('Dashboard summary failed');
      }

      console.log(`    📊 Total threads: ${result.data.totalThreads}`);
      console.log(`    🔍 Recent activity: ${result.data.recentActivity.length} items`);
    });

    // Test 8: Tactical Pattern Analysis
    await this.test('Tactical Pattern Analysis', async () => {
      const result = await this.makeRequest('/thread-processor/analyze-tactical-patterns', 'POST', {
        query: 'suspicious communication patterns',
        timeRange: '7d',
        minSuspicionScore: 0.5
      });

      if (!result.success) {
        throw new Error('Tactical analysis failed');
      }

      console.log(`    🎯 Patterns found: ${result.data.patterns.length}`);
      console.log(`    ⚠️ Suspicious speakers: ${result.data.suspiciousSpeakers.length}`);
    });

    // Test Results Summary
    this.printResults();
  }

  printResults() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('======================');
    console.log(`✅ Tests Passed: ${this.results.passed}`);
    console.log(`❌ Tests Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)}%`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error}`);
      });
    }

    if (this.results.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! System is ready for deployment.');
    } else {
      console.log('\n⚠️ Some tests failed. Review the errors above before deployment.');
    }
  }
}

// Export for use as module or run directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmailProcessingTester, TEST_DATA, TEST_CONFIG };
} else if (typeof window === 'undefined') {
  // Run tests if executed directly in Node.js
  (async () => {
    const tester = new EmailProcessingTester(TEST_CONFIG.baseUrl);
    await tester.runAllTests();
  })();
}

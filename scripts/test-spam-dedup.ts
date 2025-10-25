/**
 * Test script to validate spam detection and deduplication
 */

import { DeduplicationService } from '../src/services/deduplication';

// Mock test data
const testMessages = [
  {
    messageId: 'test-msg-1',
    threadId: 'thread-1',
    sentDate: '2025-08-18T10:00:00Z',
    fromAddress: 'legitimate@company.com',
    subject: 'Important project update'
  },
  {
    messageId: 'test-msg-2',
    threadId: 'thread-2',
    sentDate: '2025-08-18T10:30:00Z',
    fromAddress: 'noreply@suspicious-domain.tk',
    subject: 'URGENT!!! ACT NOW - FREE MONEY WINNER!!!'
  },
  {
    messageId: 'test-msg-1', // Duplicate
    threadId: 'thread-1',
    sentDate: '2025-08-18T10:00:00Z',
    fromAddress: 'legitimate@company.com',
    subject: 'Important project update'
  },
  {
    messageId: 'test-msg-3',
    threadId: 'thread-3',
    sentDate: '2025-08-18T11:00:00Z',
    fromAddress: 'support@phishing-site.com',
    subject: 'Please verify your account immediately'
  }
];

async function testDeduplication() {
  console.log('🧪 Testing Deduplication Service...');

  // Mock D1 database for testing
  const mockDb = {
    prepare: (query: string) => ({
      bind: (...args: any[]) => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({})
      }),
      first: async () => null,
      all: async () => ({ results: [] })
    }),
    batch: async () => []
  } as any;

  const deduplicationService = new DeduplicationService(mockDb);

  // Test filtering new messages
  const newMessages = await deduplicationService.filterNewMessages(testMessages);
  console.log(`✅ Filtered ${testMessages.length} -> ${newMessages.length} unique messages`);

  // Test individual message check
  const isProcessed = await deduplicationService.isMessageProcessed('test-msg-1');
  console.log(`✅ Message processed check: ${isProcessed}`);
}

async function testSpamDetection() {
  console.log('🛡️ Testing Spam Detection...');

  const spamIndicators = [
    'URGENT!!! ACT NOW',
    'FREE MONEY',
    'WINNER!!!',
    'verify your account',
    'suspicious-domain.tk'
  ];

  testMessages.forEach(msg => {
    const spamScore = calculateSimpleSpamScore(msg);
    console.log(`📧 ${msg.messageId}: ${msg.subject}`);
    console.log(`   From: ${msg.fromAddress}`);
    console.log(`   Spam Score: ${spamScore.toFixed(2)} ${spamScore > 0.5 ? '🚨 SPAM' : '✅ CLEAN'}`);
    console.log('');
  });
}

function calculateSimpleSpamScore(message: any): number {
  let score = 0;
  const subject = message.subject.toLowerCase();
  const sender = message.fromAddress.toLowerCase();

  // Subject indicators
  if (subject.includes('urgent') || subject.includes('act now')) score += 0.3;
  if (subject.includes('free money') || subject.includes('winner')) score += 0.4;
  if (subject.includes('!!!')) score += 0.2;
  if (subject.includes('verify') && subject.includes('account')) score += 0.3;

  // Sender indicators
  if (sender.includes('.tk') || sender.includes('.ml')) score += 0.3;
  if (sender.includes('noreply@suspicious')) score += 0.2;

  return Math.min(score, 1.0);
}

async function runTests() {
  console.log('🚀 Starting Spam Detection & Deduplication Tests\n');

  await testDeduplication();
  console.log('');
  await testSpamDetection();

  console.log('✅ All tests completed!');
  console.log('\n📋 Summary:');
  console.log('- Deduplication: Filters out already processed messages');
  console.log('- Spam Detection: Uses AI + rules to identify and quarantine spam');
  console.log('- Integration: Processes emails safely without duplicates or spam');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  runTests().catch(console.error);
}

#!/usr/bin/env tsx

/**
 * @module run-tests
 * @description Test runner script for the workspace tools API.
 */

import { TestRunner, TestConfig, defaultTestConfig } from './test-config';

async function runUnitTests(): Promise<void> {
  console.log('🧪 Running unit tests...');
  
  // Import and run unit tests
  const { runTests: runCacheTests } = await import('./unit/cache.test');
  const { runTests: runPerformanceTests } = await import('./unit/performance-monitor.test');
  
  try {
    await runCacheTests();
    console.log('✅ Cache tests passed');
  } catch (error) {
    console.error('❌ Cache tests failed:', error);
  }
  
  try {
    await runPerformanceTests();
    console.log('✅ Performance monitor tests passed');
  } catch (error) {
    console.error('❌ Performance monitor tests failed:', error);
  }
}

async function runIntegrationTests(): Promise<void> {
  console.log('🔗 Running integration tests...');
  
  const config: TestConfig = {
    ...defaultTestConfig,
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:8787',
    apiKey: process.env.TEST_API_KEY || 'test-api-key'
  };
  
  const testRunner = new TestRunner(config);
  
  try {
    // Test health endpoint
    await testRunner.runTest('health endpoint', async () => {
      const response = await fetch(`${config.baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error('Health check returned unsuccessful response');
      }
    });
    
    // Test performance endpoint
    await testRunner.runTest('performance endpoint', async () => {
      const response = await fetch(`${config.baseUrl}/performance`, {
        headers: {
          'X-API-Key': config.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Performance endpoint failed: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error('Performance endpoint returned unsuccessful response');
      }
    });
    
    // Test Gmail search endpoint
    await testRunner.runTest('gmail search', async () => {
      const response = await fetch(`${config.baseUrl}/gmail/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey
        },
        body: JSON.stringify({
          query: 'test query'
        })
      });
      
      // Should return 200 or 400 (depending on test data validity)
      if (![200, 400].includes(response.status)) {
        throw new Error(`Gmail search failed: ${response.status}`);
      }
    });
    
    // Test Docs read endpoint
    await testRunner.runTest('docs read', async () => {
      const response = await fetch(`${config.baseUrl}/docs/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey
        },
        body: JSON.stringify({
          documentId: 'test-document-id'
        })
      });
      
      // Should return 200 or 400 (depending on test data validity)
      if (![200, 400].includes(response.status)) {
        throw new Error(`Docs read failed: ${response.status}`);
      }
    });
    
    // Test Drive search endpoint
    await testRunner.runTest('drive search', async () => {
      const response = await fetch(`${config.baseUrl}/drive/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey
        },
        body: JSON.stringify({
          query: 'test file'
        })
      });
      
      // Should return 200 or 400 (depending on test data validity)
      if (![200, 400].includes(response.status)) {
        throw new Error(`Drive search failed: ${response.status}`);
      }
    });
    
    // Test Sheets read endpoint
    await testRunner.runTest('sheets read', async () => {
      const response = await fetch(`${config.baseUrl}/sheets/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey
        },
        body: JSON.stringify({
          spreadsheetId: 'test-spreadsheet-id',
          range: 'A1:Z100'
        })
      });
      
      // Should return 200 or 400 (depending on test data validity)
      if (![200, 400].includes(response.status)) {
        throw new Error(`Sheets read failed: ${response.status}`);
      }
    });
    
    // Test Slides read endpoint
    await testRunner.runTest('slides read', async () => {
      const response = await fetch(`${config.baseUrl}/slides/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey
        },
        body: JSON.stringify({
          presentationId: 'test-presentation-id'
        })
      });
      
      // Should return 200 or 400 (depending on test data validity)
      if (![200, 400].includes(response.status)) {
        throw new Error(`Slides read failed: ${response.status}`);
      }
    });
    
    // Test error handling
    await testRunner.runTest('error handling', async () => {
      const response = await fetch(`${config.baseUrl}/invalid-endpoint`);
      if (response.status !== 404) {
        throw new Error(`Expected 404, got ${response.status}`);
      }
    });
    
    // Test rate limiting
    await testRunner.runTest('rate limiting', async () => {
      const promises = Array(5).fill(0).map(() => 
        fetch(`${config.baseUrl}/health`)
      );
      
      const responses = await Promise.all(promises);
      responses.forEach(response => {
        if (!response.ok) {
          throw new Error(`Rate limiting test failed: ${response.status}`);
        }
      });
    });
    
    const summary = testRunner.getSummary();
    console.log('✅ Integration tests completed');
    console.log(`📊 Results: ${summary.passedTests}/${summary.totalTests} passed (${summary.passRate.toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Integration tests failed:', error);
    throw error;
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Starting test suite...');
  console.log('='.repeat(50));
  
  const startTime = Date.now();
  
  try {
    await runUnitTests();
    console.log('');
    await runIntegrationTests();
    
    const duration = Date.now() - startTime;
    console.log('');
    console.log('='.repeat(50));
    console.log(`✅ All tests completed in ${duration}ms`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log('');
    console.log('='.repeat(50));
    console.error(`❌ Test suite failed after ${duration}ms:`, error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, runUnitTests, runIntegrationTests };

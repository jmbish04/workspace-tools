/**
 * @module test-config
 * @description Configuration and utilities for testing the workspace tools API.
 */

export interface TestConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
  testData: {
    gmail: {
      testMessageId: string;
      testThreadId: string;
      testQuery: string;
    };
    docs: {
      testDocumentId: string;
      testContent: string;
    };
    drive: {
      testFileId: string;
      testFolderId: string;
    };
    sheets: {
      testSpreadsheetId: string;
      testSheetName: string;
    };
    slides: {
      testPresentationId: string;
      testSlideId: string;
    };
  };
}

export const defaultTestConfig: TestConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:8787',
  apiKey: process.env.TEST_API_KEY || 'test-api-key',
  timeout: 30000,
  retries: 3,
  testData: {
    gmail: {
      testMessageId: 'test-message-id',
      testThreadId: 'test-thread-id',
      testQuery: 'test query'
    },
    docs: {
      testDocumentId: 'test-document-id',
      testContent: 'This is test content for document testing.'
    },
    drive: {
      testFileId: 'test-file-id',
      testFolderId: 'test-folder-id'
    },
    sheets: {
      testSpreadsheetId: 'test-spreadsheet-id',
      testSheetName: 'Sheet1'
    },
    slides: {
      testPresentationId: 'test-presentation-id',
      testSlideId: 'test-slide-id'
    }
  }
};

export interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

export class TestRunner {
  private config: TestConfig;
  private results: TestResult[] = [];

  constructor(config: TestConfig = defaultTestConfig) {
    this.config = config;
  }

  async runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        name,
        status: 'PASS',
        duration
      };
      
      this.results.push(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        name,
        status: 'FAIL',
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.results.push(result);
      return result;
    }
  }

  async runTestSuite(name: string, tests: Array<{name: string, fn: () => Promise<void>}>): Promise<TestSuite> {
    const startTime = Date.now();
    const testResults: TestResult[] = [];

    for (const test of tests) {
      const result = await this.runTest(test.name, test.fn);
      testResults.push(result);
    }

    const duration = Date.now() - startTime;
    const passedTests = testResults.filter(r => r.status === 'PASS').length;
    const failedTests = testResults.filter(r => r.status === 'FAIL').length;
    const skippedTests = testResults.filter(r => r.status === 'SKIP').length;

    const suite: TestSuite = {
      name,
      tests: testResults,
      totalTests: testResults.length,
      passedTests,
      failedTests,
      skippedTests,
      duration
    };

    return suite;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  getSummary(): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    passRate: number;
  } {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const skippedTests = this.results.filter(r => r.status === 'SKIP').length;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      passRate
    };
  }

  clearResults(): void {
    this.results = [];
  }
}

export async function makeRequest(
  config: TestConfig,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<Response> {
  const url = `${config.baseUrl}${path}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-API-Key': config.apiKey,
    ...headers
  };

  const response = await fetch(url, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined
  });

  return response;
}

export function expectResponse(
  response: Response,
  expectedStatus: number,
  expectedSuccess?: boolean
): void {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }

  if (expectedSuccess !== undefined) {
    // This would need to be checked after parsing the response body
    // For now, we'll just check the status
  }
}

export function expectJsonResponse(response: Response): any {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Expected JSON response');
  }
  
  return response.json();
}

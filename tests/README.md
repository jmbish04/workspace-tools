# Testing Suite

This directory contains comprehensive tests for the Google Workspace Tools API.

## Test Structure

```
tests/
├── README.md                 # This file
├── test-config.ts           # Test configuration and utilities
├── run-tests.ts             # Main test runner script
├── unit/                    # Unit tests
│   ├── cache.test.ts        # Cache utility tests
│   └── performance-monitor.test.ts  # Performance monitor tests
└── integration/             # Integration tests
    └── api.test.ts          # API endpoint tests
```

## Running Tests

### Prerequisites

1. Ensure the API is running locally or set the `TEST_BASE_URL` environment variable
2. Set the `TEST_API_KEY` environment variable if required
3. Install dependencies: `npm install`

### Commands

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### Environment Variables

- `TEST_BASE_URL`: Base URL for the API (default: http://localhost:8787)
- `TEST_API_KEY`: API key for authentication (default: test-api-key)

## Test Categories

### Unit Tests

Unit tests focus on individual components and utilities:

- **Cache Tests**: Test the memory cache implementation, TTL, eviction, and statistics
- **Performance Monitor Tests**: Test performance monitoring, timing, and metrics collection

### Integration Tests

Integration tests verify the API endpoints and their interactions:

- **Health Endpoint**: Verify the health check endpoint
- **Performance Endpoint**: Verify the performance monitoring endpoint
- **Gmail API**: Test Gmail search, message retrieval, and draft creation
- **Docs API**: Test document reading and comment operations
- **Drive API**: Test file search and operations
- **Sheets API**: Test spreadsheet reading
- **Slides API**: Test presentation reading and comment operations
- **Error Handling**: Test error responses and edge cases
- **Rate Limiting**: Test rate limiting behavior

## Test Configuration

The test configuration is defined in `test-config.ts` and includes:

- Base URL and API key settings
- Test data for various API endpoints
- Timeout and retry settings
- Test runner utilities

## Writing New Tests

### Unit Tests

Create new unit test files in the `unit/` directory:

```typescript
import { TestRunner } from '../test-config';

describe('MyComponent', () => {
  let testRunner: TestRunner;

  beforeEach(() => {
    testRunner = new TestRunner();
  });

  test('should do something', async () => {
    await testRunner.runTest('my test', async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

Add new integration tests to `api.test.ts` or create new files in the `integration/` directory:

```typescript
import { makeRequest, expectResponse, expectJsonResponse } from '../test-config';

test('should handle new endpoint', async () => {
  const response = await makeRequest(config, 'POST', '/new-endpoint', {
    data: 'test'
  });
  
  expectResponse(response, 200);
  const data = await expectJsonResponse(response);
  expect(data.success).toBe(true);
});
```

## Test Data

Test data is configured in `test-config.ts` and includes mock IDs and content for various Google Workspace services. Update these values as needed for your testing environment.

## Continuous Integration

The test suite is designed to work with CI/CD pipelines. Set the appropriate environment variables in your CI configuration:

```yaml
env:
  TEST_BASE_URL: ${{ secrets.TEST_BASE_URL }}
  TEST_API_KEY: ${{ secrets.TEST_API_KEY }}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure the API is running and accessible
2. **Authentication Errors**: Check the API key configuration
3. **Timeout Errors**: Increase the timeout value in test configuration
4. **Test Data Issues**: Verify test data IDs are valid for your environment

### Debug Mode

Run tests with debug output:

```bash
DEBUG=* npm test
```

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Include both positive and negative test cases
3. Add appropriate error handling and edge cases
4. Update this README if adding new test categories
5. Ensure tests are deterministic and don't depend on external state
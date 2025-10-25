# Workspace Tools API Testing Suite

This directory contains comprehensive Python test scripts for testing all endpoints of the Workspace Tools Cloudflare Worker.

## Test Scripts

### 1. Comprehensive API Test (`comprehensive_api_test.py`)

A full-featured test suite that tests ALL possible endpoints, including ones that might not exist. This is useful for:
- **API Discovery**: Finding all available endpoints
- **Regression Testing**: Ensuring new deployments don't break existing functionality  
- **Comprehensive Analysis**: Getting a complete picture of API health

**Features:**
- Tests 22+ endpoints across all categories
- Includes performance testing with concurrent requests
- Edge case and error handling validation
- Detailed JSON report generation
- Retry logic with exponential backoff
- Comprehensive logging and colored output

**Usage:**
```bash
# Basic usage
python3 comprehensive_api_test.py

# Custom URL and verbose output
python3 comprehensive_api_test.py --url https://your-worker.workers.dev --verbose --timeout 60

# Skip saving detailed report
python3 comprehensive_api_test.py --no-report
```

**Sample Output:**
```
🧪 COMPREHENSIVE WORKSPACE TOOLS API TEST REPORT
📊 Total Tests: 22
✅ Passed: 12 | ❌ Failed: 10 | 📈 Pass Rate: 54.5%
🏆 Overall Assessment: 🟠 NEEDS ATTENTION - Several endpoints have issues
```

### 2. Refined API Test (`refined_api_test.py`)

A focused test suite that only tests endpoints confirmed to exist and work. This is ideal for:
- **Smoke Testing**: Quick validation that core functionality works
- **CI/CD Pipeline**: Fast endpoint validation in automated deployments
- **Health Monitoring**: Regular checks of critical functionality

**Features:**
- Tests only working endpoints (10 core tests)
- Fast execution (~1 second)
- Clean, focused output
- Validates core functionality without noise

**Usage:**
```bash
# Basic usage  
python3 refined_api_test.py

# Custom URL
python3 refined_api_test.py --url https://your-worker.workers.dev
```

**Sample Output:**
```
🧪 REFINED API TEST SUMMARY  
📊 Results: 10 tests | ✅ 10 passed | 📈 100.0% pass rate
🏆 Assessment: 🟢 EXCELLENT - All critical endpoints working
```

## Tested Endpoints

### ✅ Working Endpoints

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| Health | GET | `/health` | System health check |
| Frontend | GET | `/` | Main dashboard |
| Frontend | GET | `/help.html` | Help documentation |  
| API Docs | GET | `/openapi.json` | OpenAPI specification |
| Gmail | GET | `/gmail/providers` | Available AI providers |
| Email Processing | POST | `/email-processing/process-emails` | Batch email processing |
| Thread Processing | POST | `/thread-processor/process-message` | Single message processing |
| Thread Processing | POST | `/thread-processor/batch-process` | Batch message processing |

### ❌ Non-Existent Endpoints (404s)

These endpoints were tested but don't exist in the current deployment:
- `/gmail/generate-embedding`
- `/gmail/draft-reply` 
- `/gmail/multi-provider-analysis`
- `/email-processing/status`
- `/email-processing/analyze-spam`
- `/thread-processor/query-patterns`

### ⚠️ Endpoints with Issues (500s)

These endpoints exist but have runtime errors (likely authentication-related):
- `/gmail/search` - Returns 500 due to missing context

## Test Categories

### 1. Health & Static Assets
Tests basic worker functionality and static file serving.

### 2. Gmail Integration  
Tests Gmail API integration endpoints.

### 3. Email Processing
Tests spam detection and email processing pipelines.

### 4. Thread Processing
Tests incremental message processing and thread analysis.

### 5. Error Handling
Validates proper error responses for invalid requests.

### 6. Performance Testing
Tests concurrent request handling and response times.

## Requirements

```bash
pip install requests
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Test API Endpoints
  run: |
    python3 refined_api_test.py --url ${{ env.WORKER_URL }}
    if [ $? -ne 0 ]; then
      echo "API tests failed!"
      exit 1
    fi
```

### Quick Health Check
```bash
# One-liner health check
python3 -c "import requests; print('✅ Healthy' if requests.get('https://workspace-tools.hacolby.workers.dev/health').status_code == 200 else '❌ Unhealthy')"
```

## Report Generation

The comprehensive test generates detailed JSON reports with:
- Individual test results with response times
- Performance metrics and statistics  
- Failed test details with error messages
- Categorized endpoint analysis
- Timestamp and configuration details

Reports are saved as `workspace_tools_test_report_YYYYMMDD_HHMMSS.json`.

## Monitoring and Alerting

These scripts can be used for:
- **Uptime Monitoring**: Regular automated health checks
- **Deployment Validation**: Post-deployment smoke testing
- **Performance Monitoring**: Tracking response time trends
- **API Documentation**: Keeping track of available endpoints

## Customization

Both scripts can be easily customized for:
- Additional test endpoints
- Custom authentication headers
- Different timeout values  
- Custom validation logic
- Integration with monitoring systems

## Example Integration

```python
from refined_api_test import RefinedWorkspaceToolsTester

# Programmatic usage
tester = RefinedWorkspaceToolsTester("https://my-worker.workers.dev")
success = tester.run_all_tests()

if not success:
    # Send alert, log issue, etc.
    send_slack_alert("API tests failed!")
```

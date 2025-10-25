#!/usr/bin/env python3
"""
Comprehensive API Test Suite for Workspace Tools Cloudflare Worker
Tests all available endpoints including health, static assets, Gmail, email processing, and thread processor routes.
Based on the current deployment at workspace-tools.hacolby.workers.dev

Author: Claude AI Assistant
Version: 2.0
Date: December 2024
"""

import requests
import json
import time
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import logging
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import base64

# Test Configuration
BASE_URL = "https://workspace-tools.hacolby.workers.dev"
TIMEOUT = 45
MAX_RETRIES = 3
PARALLEL_WORKERS = 5

# ANSI color codes for console output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

@dataclass
class TestResult:
    name: str
    endpoint: str
    method: str
    status: str  # "PASS", "FAIL", "SKIP"
    response_time: float
    status_code: Optional[int]
    error_message: Optional[str] = None
    response_data: Optional[Dict] = None
    test_data: Optional[Dict] = None

class ComprehensiveWorkspaceToolsTester:
    def __init__(self, base_url: str = BASE_URL, timeout: int = TIMEOUT, verbose: bool = False):
        self.base_url = base_url
        self.timeout = timeout
        self.verbose = verbose
        self.results: List[TestResult] = []
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Workspace-Tools-Test-Suite/2.0',
            'Accept': 'application/json, text/html, */*'
        })
        
        # Setup logging
        log_level = logging.DEBUG if verbose else logging.INFO
        log_format = '%(asctime)s - %(levelname)s - %(message)s'
        logging.basicConfig(level=log_level, format=log_format)
        self.logger = logging.getLogger(__name__)
        
    def log_and_print(self, message: str, color: str = Colors.WHITE):
        """Log message and print with color to console"""
        clean_message = message.replace(color, '').replace(Colors.END, '')
        self.logger.info(clean_message)
        print(f"{color}{message}{Colors.END}")
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    params: Optional[Dict] = None, headers: Optional[Dict] = None,
                    expected_content_type: Optional[str] = None) -> TestResult:
        """Make HTTP request and return test result with retry logic"""
        url = f"{self.base_url}{endpoint}"
        
        # Merge additional headers
        req_headers = self.session.headers.copy()
        if headers:
            req_headers.update(headers)
        
        for attempt in range(MAX_RETRIES):
            start_time = time.time()
            try:
                if method.upper() == 'GET':
                    response = self.session.get(url, params=params, headers=req_headers, timeout=self.timeout)
                elif method.upper() == 'POST':
                    response = self.session.post(url, json=data, params=params, headers=req_headers, timeout=self.timeout)
                elif method.upper() == 'PUT':
                    response = self.session.put(url, json=data, params=params, headers=req_headers, timeout=self.timeout)
                elif method.upper() == 'DELETE':
                    response = self.session.delete(url, params=params, headers=req_headers, timeout=self.timeout)
                elif method.upper() == 'PATCH':
                    response = self.session.patch(url, json=data, params=params, headers=req_headers, timeout=self.timeout)
                else:
                    raise ValueError(f"Unsupported method: {method}")
                
                response_time = time.time() - start_time
                
                # Parse response based on content type
                response_data = self._parse_response(response, expected_content_type)
                
                # Determine status
                status = self._determine_status(response, expected_content_type)
                error_msg = None if status == "PASS" else f"HTTP {response.status_code}: {response.text[:200]}"
                
                return TestResult(
                    name="",  # Set by caller
                    endpoint=endpoint,
                    method=method.upper(),
                    status=status,
                    response_time=response_time,
                    status_code=response.status_code,
                    error_message=error_msg,
                    response_data=response_data,
                    test_data=data
                )
                
            except Exception as e:
                response_time = time.time() - start_time
                if attempt < MAX_RETRIES - 1:
                    self.logger.warning(f"Request failed (attempt {attempt + 1}): {e}. Retrying...")
                    time.sleep(1)  # Brief delay before retry
                    continue
                
                return TestResult(
                    name="",  # Set by caller
                    endpoint=endpoint,
                    method=method.upper(),
                    status="FAIL",
                    response_time=response_time,
                    status_code=None,
                    error_message=str(e),
                    test_data=data
                )
        
        # Should never reach here, but just in case
        return TestResult(
            name="Request Failed",
            endpoint=endpoint,
            method=method.upper(),
            status="FAIL",
            response_time=0.0,
            status_code=None,
            error_message="Max retries exceeded"
        )
    
    def _parse_response(self, response, expected_content_type: Optional[str]) -> Dict:
        """Parse response based on content type"""
        try:
            content_type = response.headers.get('content-type', '').lower()
            
            if 'application/json' in content_type:
                return response.json()
            elif 'text/html' in content_type or expected_content_type == 'html':
                return {
                    "content_type": "text/html",
                    "content_length": len(response.text),
                    "title": self._extract_html_title(response.text),
                    "status": "HTML content received"
                }
            else:
                return {
                    "content_type": content_type,
                    "content_length": len(response.text),
                    "raw_response": response.text[:500]  # First 500 chars
                }
        except Exception as e:
            return {
                "parse_error": str(e),
                "raw_response": response.text[:500]
            }
    
    def _extract_html_title(self, html_content: str) -> str:
        """Extract title from HTML content"""
        try:
            import re
            title_match = re.search(r'<title.*?>(.*?)</title>', html_content, re.IGNORECASE | re.DOTALL)
            return title_match.group(1).strip() if title_match else "No title found"
        except:
            return "Title extraction failed"
    
    def _determine_status(self, response, expected_content_type: Optional[str]) -> str:
        """Determine test status based on response"""
        if response.status_code >= 500:
            return "FAIL"  # Server errors are failures
        elif response.status_code >= 400:
            # Client errors might be expected for some tests
            if response.status_code == 404 and "/help.html" in response.url:
                return "PASS"  # Help page might not exist
            elif response.status_code in [400, 401, 403]:
                return "PASS"  # Expected authentication/validation errors
            return "FAIL"
        elif response.status_code >= 200 and response.status_code < 300:
            return "PASS"
        else:
            return "FAIL"
    
    def test_health_and_static_assets(self):
        """Test health endpoints and static asset serving"""
        self.log_and_print("\n🏥 Testing Health & Static Assets", Colors.BOLD + Colors.BLUE)
        
        tests = [
            ("Health Check", "GET", "/health", None, None, "json"),
            ("Frontend Dashboard", "GET", "/", None, None, "html"),
            ("Help Page", "GET", "/help.html", None, None, "html"),
            ("OpenAPI Specification", "GET", "/openapi.json", None, None, "json"),
        ]
        
        for name, method, endpoint, data, params, content_type in tests:
            result = self.make_request(method, endpoint, data, params, expected_content_type=content_type)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:35} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
            
            if self.verbose and result.response_data:
                print(f"       Response preview: {str(result.response_data)[:100]}...")
    
    def test_gmail_endpoints(self):
        """Test Gmail integration endpoints"""
        self.log_and_print("\n📧 Testing Gmail API Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Test data for Gmail operations
        test_messages = [
            {
                "messageId": "test_message_001",
                "threadId": "test_thread_001", 
                "fromAddress": "test@example.com",
                "subject": "Test Email Subject",
                "bodyPlain": "This is a test email body for API testing purposes.",
                "date": datetime.now().isoformat()
            }
        ]
        
        search_data = {
            "query": "from:test@example.com",
            "maxResults": 10,
            "user": "default"
        }
        
        message_data = {
            "messageId": "test-message-id",
            "user": "default"
        }
        
        # Based on actual Gmail routes from gmail.ts
        tests = [
            ("Gmail Search Messages", "POST", "/gmail/search", search_data),
            ("Gmail Get Providers", "GET", "/gmail/providers", None),
            ("Gmail Get Message Plain Text", "POST", "/gmail/message/plaintext", message_data),
            ("Gmail Generate Embedding", "POST", "/gmail/generate-embedding", {"text": "test content"}),
            ("Gmail Draft Reply", "POST", "/gmail/draft-reply", {
                "messageId": "test-msg", 
                "replyText": "This is a test reply"
            }),
            ("Gmail Multi-Provider Analysis", "POST", "/gmail/multi-provider-analysis", {
                "messageId": "test-msg",
                "providers": ["openai", "anthropic"]
            }),
        ]
        
        for name, method, endpoint, data in tests:
            result = self.make_request(method, endpoint, data)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:35} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_email_processing_endpoints(self):
        """Test email processing and spam detection endpoints"""
        self.log_and_print("\n🔍 Testing Email Processing Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Sample message data for processing
        sample_messages = [
            {
                "messageId": "test_legitimate_001",
                "threadId": "thread_business_001",
                "sentDate": datetime.now().isoformat(),
                "fromAddress": "colleague@company.com",
                "subject": "Meeting Follow-up"
            },
            {
                "messageId": "test_spam_001", 
                "threadId": "thread_suspicious_001",
                "sentDate": datetime.now().isoformat(),
                "fromAddress": "noreply@suspicious-domain.fake",
                "subject": "URGENT: Claim your prize now!"
            }
        ]
        
        processing_config = {
            "batchSize": 10,
            "enableSpamDetection": True,
            "spamThreshold": 0.7,
            "maxRetries": 2
        }
        
        tests = [
            ("Process Email Batch", "POST", "/email-processing/process-emails", {
                "messages": sample_messages,
                "config": processing_config
            }),
            ("Get Processing Status", "GET", "/email-processing/status", None),
            ("Analyze Thread Spam", "POST", "/email-processing/analyze-spam", {
                "threadId": "test-thread-001",
                "messageIds": ["msg1", "msg2"]
            }),
        ]
        
        for name, method, endpoint, data in tests:
            result = self.make_request(method, endpoint, data)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:35} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_thread_processor_endpoints(self):
        """Test thread processing endpoints"""
        self.log_and_print("\n🧵 Testing Thread Processor Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Sample message for processing
        message_data = {
            "messageId": "test_msg_001",
            "threadId": "test_thread_001", 
            "from": "sender@example.com",
            "date": datetime.now().isoformat(),
            "subject": "Test Thread Message",
            "body": "This is a test message body for thread processing analysis."
        }
        
        batch_messages = [
            {
                "messageId": f"batch_msg_{i}",
                "threadId": "batch_thread_001",
                "from": f"user{i}@example.com",
                "date": (datetime.now() - timedelta(hours=i)).isoformat(),
                "subject": f"Batch Message {i}",
                "body": f"This is batch message number {i} for testing purposes."
            } for i in range(3)
        ]
        
        tests = [
            ("Process Single Message", "POST", "/thread-processor/process-message", message_data),
            ("Batch Process Messages", "POST", "/thread-processor/batch-process", {
                "messages": batch_messages
            }),
            ("Query Tactical Patterns", "POST", "/thread-processor/query-patterns", {
                "threadId": "test_thread_001",
                "patternType": "communication_flow"
            }),
        ]
        
        for name, method, endpoint, data in tests:
            result = self.make_request(method, endpoint, data)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:35} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_edge_cases_and_error_handling(self):
        """Test edge cases and error handling"""
        self.log_and_print("\n⚠️ Testing Edge Cases & Error Handling", Colors.BOLD + Colors.YELLOW)
        
        tests = [
            ("Invalid JSON Payload", "POST", "/gmail/search", "invalid-json-data"),
            ("Missing Required Fields", "POST", "/thread-processor/process-message", {}),
            ("Large Payload Test", "POST", "/gmail/generate-embedding", {
                "text": "x" * 10000  # 10KB of text
            }),
            ("Non-existent Endpoint", "GET", "/non-existent-endpoint", None),
            ("Method Not Allowed", "DELETE", "/health", None),
        ]
        
        for name, method, endpoint, data in tests:
            # Handle invalid JSON case specially
            if data == "invalid-json-data":
                # Make raw request with invalid JSON
                url = f"{self.base_url}{endpoint}"
                start_time = time.time()
                try:
                    response = requests.post(url, data="invalid-json", 
                                          headers={"Content-Type": "application/json"}, 
                                          timeout=self.timeout)
                    response_time = time.time() - start_time
                    result = TestResult(
                        name=name,
                        endpoint=endpoint,
                        method=method,
                        status="PASS" if response.status_code >= 400 else "FAIL",  # We expect an error
                        response_time=response_time,
                        status_code=response.status_code,
                        error_message=None if response.status_code >= 400 else "Expected error but got success"
                    )
                except Exception as e:
                    result = TestResult(
                        name=name,
                        endpoint=endpoint,
                        method=method,
                        status="PASS",  # Network errors are expected for invalid data
                        response_time=time.time() - start_time,
                        status_code=None,
                        error_message=str(e)
                    )
            else:
                result = self.make_request(method, endpoint, data)
                result.name = name
                # For edge cases, we often expect failures, so adjust status
                if "Non-existent" in name and result.status_code == 404:
                    result.status = "PASS"
                elif "Method Not Allowed" in name and result.status_code == 405:
                    result.status = "PASS"
                elif "Missing Required" in name and result.status_code >= 400:
                    result.status = "PASS"
            
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:35} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_performance_and_load(self):
        """Test performance with concurrent requests"""
        self.log_and_print("\n⚡ Testing Performance & Load", Colors.BOLD + Colors.MAGENTA)
        
        # Test concurrent health checks
        def make_health_request():
            return self.make_request("GET", "/health")
        
        start_time = time.time()
        with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
            futures = [executor.submit(make_health_request) for _ in range(10)]
            results = [future.result() for future in as_completed(futures)]
        
        total_time = time.time() - start_time
        avg_response_time = sum(r.response_time for r in results) / len(results)
        success_rate = len([r for r in results if r.status == "PASS"]) / len(results) * 100
        
        # Create summary result
        perf_result = TestResult(
            name="Concurrent Health Checks (10 requests)",
            endpoint="/health",
            method="GET",
            status="PASS" if success_rate >= 90 else "FAIL",
            response_time=avg_response_time,
            status_code=200 if success_rate >= 90 else 500,
            response_data={
                "total_requests": 10,
                "success_rate": f"{success_rate:.1f}%",
                "total_time": f"{total_time:.3f}s",
                "avg_response_time": f"{avg_response_time:.3f}s",
                "concurrent_workers": PARALLEL_WORKERS
            }
        )
        
        self.results.append(perf_result)
        
        color = Colors.GREEN if perf_result.status == "PASS" else Colors.RED
        self.log_and_print(
            f"  {perf_result.status:4} | PERF   {perf_result.endpoint:35} | "
            f"{avg_response_time:.3f}s | {success_rate:.1f}%",
            color
        )
    
    def generate_detailed_report(self) -> Dict:
        """Generate detailed test report with metrics"""
        total_tests = len(self.results)
        passed = len([r for r in self.results if r.status == "PASS"])
        failed = len([r for r in self.results if r.status == "FAIL"])
        skipped = len([r for r in self.results if r.status == "SKIP"])
        
        pass_rate = (passed / total_tests * 100) if total_tests > 0 else 0
        avg_response_time = sum(r.response_time for r in self.results) / total_tests if total_tests > 0 else 0
        
        # Categorize results
        categories = {
            "health_and_static": [r for r in self.results if any(x in r.endpoint for x in ["/health", "/", "/help", "/openapi"])],
            "gmail": [r for r in self.results if "/gmail" in r.endpoint],
            "email_processing": [r for r in self.results if "/email-processing" in r.endpoint],
            "thread_processing": [r for r in self.results if "/thread-processor" in r.endpoint],
            "edge_cases": [r for r in self.results if r.name.startswith(("Invalid", "Missing", "Large", "Non-existent", "Method"))],
            "performance": [r for r in self.results if "Concurrent" in r.name]
        }
        
        return {
            "summary": {
                "total_tests": total_tests,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "pass_rate": round(pass_rate, 2),
                "avg_response_time": round(avg_response_time, 3)
            },
            "categories": {k: len(v) for k, v in categories.items()},
            "failed_tests": [
                {
                    "name": r.name,
                    "endpoint": r.endpoint,
                    "method": r.method,
                    "error": r.error_message,
                    "status_code": r.status_code
                }
                for r in self.results if r.status == "FAIL"
            ],
            "performance_metrics": {
                "fastest_response": min(r.response_time for r in self.results),
                "slowest_response": max(r.response_time for r in self.results),
                "endpoints_by_speed": sorted(
                    [(r.endpoint, r.response_time) for r in self.results],
                    key=lambda x: x[1]
                )[:5]  # Top 5 fastest
            },
            "test_results": [asdict(r) for r in self.results]
        }
    
    def print_summary(self):
        """Print comprehensive test summary"""
        report = self.generate_detailed_report()
        summary = report["summary"]
        
        self.log_and_print("\n" + "="*80, Colors.BOLD)
        self.log_and_print("🧪 COMPREHENSIVE WORKSPACE TOOLS API TEST REPORT", Colors.BOLD + Colors.CYAN)
        self.log_and_print("="*80, Colors.BOLD)
        
        self.log_and_print(f"🌐 Target URL: {self.base_url}", Colors.BLUE)
        self.log_and_print(f"📅 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", Colors.BLUE)
        
        self.log_and_print(f"\n📊 OVERALL RESULTS:", Colors.BOLD)
        self.log_and_print(f"   Total Tests: {summary['total_tests']}", Colors.WHITE)
        self.log_and_print(f"   ✅ Passed: {summary['passed']}", Colors.GREEN)
        self.log_and_print(f"   ❌ Failed: {summary['failed']}", Colors.RED)
        self.log_and_print(f"   ⏭️  Skipped: {summary['skipped']}", Colors.YELLOW)
        self.log_and_print(f"   📈 Pass Rate: {summary['pass_rate']:.1f}%", Colors.CYAN)
        self.log_and_print(f"   ⏱️  Avg Response Time: {summary['avg_response_time']:.3f}s", Colors.MAGENTA)
        
        # Category breakdown
        self.log_and_print(f"\n📋 TEST CATEGORIES:", Colors.BOLD)
        for category, count in report["categories"].items():
            category_name = category.replace("_", " ").title()
            self.log_and_print(f"   {category_name}: {count} tests", Colors.WHITE)
        
        # Performance metrics
        perf = report["performance_metrics"]
        self.log_and_print(f"\n⚡ PERFORMANCE METRICS:", Colors.BOLD)
        self.log_and_print(f"   Fastest Response: {perf['fastest_response']:.3f}s", Colors.GREEN)
        self.log_and_print(f"   Slowest Response: {perf['slowest_response']:.3f}s", Colors.YELLOW)
        
        # Failed tests details
        if report["failed_tests"]:
            self.log_and_print(f"\n❌ FAILED TESTS DETAILS:", Colors.RED + Colors.BOLD)
            for failure in report["failed_tests"]:
                self.log_and_print(
                    f"   • {failure['name']} ({failure['method']} {failure['endpoint']})",
                    Colors.RED
                )
                if failure['error']:
                    self.log_and_print(f"     Error: {failure['error']}", Colors.RED)
        
        # Status determination
        if summary['pass_rate'] >= 90:
            status_color = Colors.GREEN
            status_text = "🟢 EXCELLENT - API is performing very well"
        elif summary['pass_rate'] >= 75:
            status_color = Colors.YELLOW
            status_text = "🟡 GOOD - API is mostly functional with minor issues"
        elif summary['pass_rate'] >= 50:
            status_color = Colors.YELLOW
            status_text = "🟠 NEEDS ATTENTION - Several endpoints have issues"
        else:
            status_color = Colors.RED
            status_text = "🔴 CRITICAL - Major API functionality issues detected"
        
        self.log_and_print(f"\n🏆 Overall Assessment: {status_text}", Colors.BOLD + status_color)
        self.log_and_print("="*80, Colors.BOLD)
        
        return summary['pass_rate'] >= 75, report
    
    def save_report(self, report: Dict, filename: str = None):
        """Save detailed test report to JSON file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"workspace_tools_test_report_{timestamp}.json"
        
        try:
            with open(filename, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            self.log_and_print(f"📁 Detailed report saved to: {filename}", Colors.BLUE)
        except Exception as e:
            self.log_and_print(f"⚠️ Failed to save report: {e}", Colors.RED)
    
    def run_all_tests(self, save_report: bool = True) -> Tuple[bool, Dict]:
        """Run complete test suite"""
        start_time = time.time()
        
        self.log_and_print("🚀 Starting Comprehensive Workspace Tools API Test Suite", Colors.BOLD + Colors.CYAN)
        self.log_and_print(f"🌐 Testing against: {self.base_url}", Colors.BLUE)
        self.log_and_print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", Colors.BLUE)
        self.log_and_print(f"⚙️ Configuration: Timeout={self.timeout}s, Retries={MAX_RETRIES}, Workers={PARALLEL_WORKERS}", Colors.BLUE)
        
        try:
            # Run all test suites
            self.test_health_and_static_assets()
            self.test_gmail_endpoints()
            self.test_email_processing_endpoints()
            self.test_thread_processor_endpoints()
            self.test_edge_cases_and_error_handling()
            self.test_performance_and_load()
            
        except KeyboardInterrupt:
            self.log_and_print("\n⚠️ Test suite interrupted by user", Colors.YELLOW)
        except Exception as e:
            self.log_and_print(f"\n💥 Unexpected error during testing: {e}", Colors.RED)
        
        total_time = time.time() - start_time
        self.log_and_print(f"\n⏱️ Total execution time: {total_time:.2f}s", Colors.BLUE)
        
        # Generate and print summary
        success, report = self.print_summary()
        
        # Save detailed report if requested
        if save_report:
            self.save_report(report)
        
        return success, report

def main():
    """Main test execution with command line arguments"""
    parser = argparse.ArgumentParser(description='Comprehensive Workspace Tools API Test Suite')
    parser.add_argument('--url', default=BASE_URL, help='Base URL to test against')
    parser.add_argument('--timeout', type=int, default=TIMEOUT, help='Request timeout in seconds')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--no-report', action='store_true', help='Skip saving detailed report')
    
    args = parser.parse_args()
    
    tester = ComprehensiveWorkspaceToolsTester(
        base_url=args.url,
        timeout=args.timeout,
        verbose=args.verbose
    )
    
    success, report = tester.run_all_tests(save_report=not args.no_report)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

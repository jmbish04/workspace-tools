#!/usr/bin/env python3
"""
Comprehensive Test Suite for Workspace Tools API
Tests all available Google Workspace integration endpoints against the live worker deployment
"""

import requests
import json
import time
import sys
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging

# Test Configuration
BASE_URL = "https://workspace-tools.hacolby.workers.dev"
LOG_FILE = "test_results.log"
TIMEOUT = 30

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

class WorkspaceToolsTester:
    def __init__(self):
        self.results: List[TestResult] = []
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'Workspace-Tools-Test-Suite/1.0'
        })
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(LOG_FILE, mode='w'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    def log_and_print(self, message: str, color: str = Colors.WHITE):
        """Log message to file and print with color to console"""
        self.logger.info(message.replace(color, '').replace(Colors.END, ''))
        print(f"{color}{message}{Colors.END}")
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    params: Optional[Dict] = None, headers: Optional[Dict] = None) -> TestResult:
        """Make HTTP request and return test result"""
        url = f"{BASE_URL}{endpoint}"
        start_time = time.time()
        
        # Merge additional headers
        req_headers = self.session.headers.copy()
        if headers:
            req_headers.update(headers)
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params, headers=req_headers, timeout=TIMEOUT)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, params=params, headers=req_headers, timeout=TIMEOUT)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, params=params, headers=req_headers, timeout=TIMEOUT)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, params=params, headers=req_headers, timeout=TIMEOUT)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response_time = time.time() - start_time
            
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text[:500]}
            
            status = "PASS" if response.status_code < 400 else "FAIL"
            error_msg = None if status == "PASS" else f"HTTP {response.status_code}: {response.text[:200]}"
            
            return TestResult(
                name="",  # Will be set by caller
                endpoint=endpoint,
                method=method.upper(),
                status=status,
                response_time=response_time,
                status_code=response.status_code,
                error_message=error_msg,
                response_data=response_data
            )
            
        except Exception as e:
            response_time = time.time() - start_time
            return TestResult(
                name="",  # Will be set by caller
                endpoint=endpoint,
                method=method.upper(),
                status="FAIL",
                response_time=response_time,
                status_code=None,
                error_message=str(e)
            )
    
    def test_health_endpoints(self):
        """Test basic health and info endpoints"""
        self.log_and_print("\n🏥 Testing Health & Info Endpoints", Colors.BOLD + Colors.BLUE)
        
        tests = [
            ("Health Check", "GET", "/", None),
            ("Help Page", "GET", "/help.html", None),
            ("OpenAPI Spec", "GET", "/openapi.json", None),
        ]
        
        for name, method, endpoint, data in tests:
            result = self.make_request(method, endpoint, data)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_oauth_endpoints(self):
        """Test OAuth authentication endpoints"""
        self.log_and_print("\n🔐 Testing OAuth Endpoints", Colors.BOLD + Colors.BLUE)
        
        tests = [
            ("OAuth Initiate", "GET", "/oauth", None),
            ("OAuth Callback", "GET", "/oauth/callback", {"code": "test_code", "state": "test_state"}),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_gmail_endpoints(self):
        """Test Gmail integration endpoints"""
        self.log_and_print("\n📧 Testing Gmail Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Test data for Gmail operations
        search_params = {
            "q": "from:test@example.com",
            "maxResults": "10",
            "user": "default"
        }
        
        gmail_search_data = {
            "query": "from:test@example.com",
            "maxResults": 10
        }
        
        tests = [
            ("Gmail Search", "POST", "/gmail/search", gmail_search_data),
            ("Gmail Providers", "GET", "/gmail/providers", None),
            ("Gmail Message", "POST", "/gmail/message/plaintext", {"messageId": "test-message-id"}),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_drive_endpoints(self):
        """Test Google Drive integration endpoints"""
        self.log_and_print("\n💾 Testing Google Drive Endpoints", Colors.BOLD + Colors.BLUE)
        
        search_params = {
            "q": "name contains 'test'",
            "pageSize": "10",
            "user": "default"
        }
        
        tests = [
            ("Drive Search", "GET", "/drive/search", search_params),
            ("Drive About", "GET", "/drive/about", {"user": "default"}),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_docs_endpoints(self):
        """Test Google Docs integration endpoints"""
        self.log_and_print("\n📄 Testing Google Docs Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Create document test data
        create_doc_data = {
            "title": "Test Document",
            "user": "default"
        }
        
        tests = [
            ("Create Document", "POST", "/docs/create", create_doc_data),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_sheets_endpoints(self):
        """Test Google Sheets integration endpoints"""
        self.log_and_print("\n📊 Testing Google Sheets Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Create spreadsheet test data
        create_sheet_data = {
            "title": "Test Spreadsheet",
            "user": "default"
        }
        
        tests = [
            ("Create Spreadsheet", "POST", "/sheets/create", create_sheet_data),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_slides_endpoints(self):
        """Test Google Slides integration endpoints"""
        self.log_and_print("\n🎭 Testing Google Slides Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Create presentation test data
        create_slides_data = {
            "title": "Test Presentation",
            "user": "default"
        }
        
        tests = [
            ("Create Presentation", "POST", "/slides/create", create_slides_data),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_appscript_endpoints(self):
        """Test Google Apps Script integration endpoints"""
        self.log_and_print("\n⚙️ Testing Apps Script Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Create Apps Script project test data
        create_script_data = {
            "title": "Test Script Project",
            "user": "default"
        }
        
        tests = [
            ("Create Script Project", "POST", "/appscript/create", create_script_data),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_email_processing_endpoints(self):
        """Test email processing and analysis endpoints"""
        self.log_and_print("\n🔍 Testing Email Processing Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Process thread test data
        process_data = {
            "threadId": "test-thread-id",
            "user": "default"
        }
        
        # Spam detection test data
        spam_data = {
            "messageId": "test-message-id",
            "user": "default"
        }
        
        tests = [
            ("Process Thread", "POST", "/process/thread", process_data),
            ("Spam Detection", "POST", "/spam/detect", spam_data),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_ai_integration_endpoints(self):
        """Test AI integration endpoints"""
        self.log_and_print("\n🤖 Testing AI Integration Endpoints", Colors.BOLD + Colors.BLUE)
        
        # AI analysis test data
        ai_data = {
            "text": "This is test content for AI analysis",
            "task": "analyze_sentiment",
            "user": "default"
        }
        
        tests = [
            ("AI Analysis", "POST", "/ai/analyze", ai_data),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def test_webhook_endpoints(self):
        """Test webhook endpoints"""
        self.log_and_print("\n🪝 Testing Webhook Endpoints", Colors.BOLD + Colors.BLUE)
        
        # Webhook test data
        webhook_data = {
            "message": {
                "data": "dGVzdCBkYXRh",  # base64 encoded "test data"
                "messageId": "test-message-id",
                "publishTime": "2024-01-01T00:00:00.000Z"
            }
        }
        
        tests = [
            ("Gmail Webhook", "POST", "/webhook/gmail", webhook_data),
            ("Drive Webhook", "POST", "/webhook/drive", webhook_data),
        ]
        
        for name, method, endpoint, data in tests:
            params = data if method == "GET" else None
            json_data = data if method == "POST" else None
            result = self.make_request(method, endpoint, json_data, params)
            result.name = name
            self.results.append(result)
            
            color = Colors.GREEN if result.status == "PASS" else Colors.RED
            self.log_and_print(
                f"  {result.status:4} | {method:6} {endpoint:30} | "
                f"{result.response_time:.3f}s | {result.status_code or 'N/A'}",
                color
            )
    
    def print_summary(self):
        """Print comprehensive test summary"""
        total_tests = len(self.results)
        passed = len([r for r in self.results if r.status == "PASS"])
        failed = len([r for r in self.results if r.status == "FAIL"])
        skipped = len([r for r in self.results if r.status == "SKIP"])
        
        pass_rate = (passed / total_tests * 100) if total_tests > 0 else 0
        avg_response_time = sum(r.response_time for r in self.results) / total_tests if total_tests > 0 else 0
        
        self.log_and_print("\n" + "="*80, Colors.BOLD)
        self.log_and_print("🧪 WORKSPACE TOOLS API TEST SUMMARY", Colors.BOLD + Colors.CYAN)
        self.log_and_print("="*80, Colors.BOLD)
        
        self.log_and_print(f"📊 Total Tests: {total_tests}", Colors.WHITE)
        self.log_and_print(f"✅ Passed: {passed}", Colors.GREEN)
        self.log_and_print(f"❌ Failed: {failed}", Colors.RED)
        self.log_and_print(f"⏭️  Skipped: {skipped}", Colors.YELLOW)
        self.log_and_print(f"📈 Pass Rate: {pass_rate:.1f}%", Colors.CYAN)
        self.log_and_print(f"⏱️  Average Response Time: {avg_response_time:.3f}s", Colors.MAGENTA)
        
        if failed > 0:
            self.log_and_print(f"\n❌ FAILED TESTS:", Colors.RED + Colors.BOLD)
            for result in self.results:
                if result.status == "FAIL":
                    self.log_and_print(
                        f"   • {result.name} ({result.method} {result.endpoint}): {result.error_message}",
                        Colors.RED
                    )
        
        # Status determination
        if pass_rate >= 90:
            status_color = Colors.GREEN
            status_text = "🟢 EXCELLENT"
        elif pass_rate >= 75:
            status_color = Colors.YELLOW
            status_text = "🟡 GOOD"
        elif pass_rate >= 50:
            status_color = Colors.YELLOW
            status_text = "🟠 NEEDS ATTENTION"
        else:
            status_color = Colors.RED
            status_text = "🔴 CRITICAL"
        
        self.log_and_print(f"\n🏆 Overall Status: {status_text}", Colors.BOLD + status_color)
        self.log_and_print(f"📝 Detailed log saved to: {LOG_FILE}", Colors.BLUE)
        self.log_and_print("="*80, Colors.BOLD)
        
        return pass_rate >= 75  # Return True if tests are generally passing
    
    def run_all_tests(self):
        """Run complete test suite"""
        start_time = time.time()
        
        self.log_and_print("🚀 Starting Workspace Tools API Test Suite", Colors.BOLD + Colors.CYAN)
        self.log_and_print(f"🌐 Testing against: {BASE_URL}", Colors.BLUE)
        self.log_and_print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", Colors.BLUE)
        
        # Run all test categories
        try:
            self.test_health_endpoints()
            self.test_oauth_endpoints()
            self.test_gmail_endpoints()
            self.test_drive_endpoints()
            self.test_docs_endpoints()
            self.test_sheets_endpoints()
            self.test_slides_endpoints()
            self.test_appscript_endpoints()
            self.test_email_processing_endpoints()
            self.test_ai_integration_endpoints()
            self.test_webhook_endpoints()
        except KeyboardInterrupt:
            self.log_and_print("\n⚠️ Test suite interrupted by user", Colors.YELLOW)
        except Exception as e:
            self.log_and_print(f"\n💥 Unexpected error during testing: {e}", Colors.RED)
        
        total_time = time.time() - start_time
        self.log_and_print(f"\n⏱️ Total execution time: {total_time:.2f}s", Colors.BLUE)
        
        # Print summary and return success status
        return self.print_summary()

def main():
    """Main test execution"""
    tester = WorkspaceToolsTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

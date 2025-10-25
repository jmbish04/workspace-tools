#!/bin/bash

# Integration Test Script for Real-Time Email Processing System
# Run this after deployment to validate the complete pipeline

echo "🚀 Testing Real-Time Incremental Email Processing System"
echo "=================================================="

# Configuration
BASE_URL="https://workspace-tools.your-subdomain.workers.dev"
CONTENT_TYPE="Content-Type: application/json"

echo "📧 Testing Email Processing Pipeline..."

# Test 1: Batch Email Processing with Spam Detection
echo ""
echo "Test 1: Batch Email Processing with Spam Detection"
echo "---------------------------------------------------"
curl -X POST "$BASE_URL/email-processing/process-emails" \
  -H "$CONTENT_TYPE" \
  -d '{
    "messages": [
      {
        "messageId": "test_legitimate_001",
        "fromAddress": "john.doe@company.com",
        "subject": "Project Update Meeting",
        "bodyPlain": "Hi team, lets schedule our weekly project update for Thursday at 2 PM.",
        "threadId": "thread_project_001",
        "date": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
      },
      {
        "messageId": "test_spam_001",
        "fromAddress": "winner@suspicious-lottery.fake",
        "subject": "🎉 You Won $1,000,000!!!",
        "bodyPlain": "Congratulations! You have won our international lottery! Click here to claim your prize and send us your bank details!",
        "threadId": "thread_spam_001",
        "date": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
      }
    ],
    "config": {
      "batchSize": 10,
      "enableSpamDetection": true,
      "spamThreshold": 0.6
    },
    "enableThreadAnalysis": true
  }'

echo ""
echo ""

# Test 2: Single Email with Thread Analysis
echo "Test 2: Single Email with Thread Analysis"
echo "-------------------------------------------"
curl -X POST "$BASE_URL/email-processing/process-single-email" \
  -H "$CONTENT_TYPE" \
  -d '{
    "messageId": "test_reply_001",
    "threadId": "thread_project_001",
    "fromAddress": "jane.smith@company.com",
    "subject": "RE: Project Update Meeting",
    "bodyPlain": "Thursday 2 PM works for me. Should we invite the design team?\n\n> Hi team, lets schedule our weekly project update for Thursday at 2 PM.",
    "date": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'

echo ""
echo ""

# Test 3: Thread Processor Direct Processing
echo "Test 3: Thread Processor Direct Processing"
echo "--------------------------------------------"
curl -X POST "$BASE_URL/thread-processor/process-message" \
  -H "$CONTENT_TYPE" \
  -d '{
    "messageId": "test_direct_001",
    "threadId": "thread_project_001",
    "from": "mike.johnson@company.com",
    "date": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "subject": "RE: Project Update Meeting",
    "body": "I can join at 2 PM as well. Here are my thoughts on the current status:\n\n1. Backend API is 90% complete\n2. Frontend needs another week\n3. Testing phase should start next Monday\n\n> Thursday 2 PM works for me. Should we invite the design team?\n> \n> > Hi team, lets schedule our weekly project update for Thursday at 2 PM."
  }'

echo ""
echo ""

# Test 4: Get Processing Status
echo "Test 4: Get Processing Status"
echo "------------------------------"
curl -X GET "$BASE_URL/email-processing/processing-status" \
  -H "$CONTENT_TYPE"

echo ""
echo ""

# Test 5: Get Thread Statistics
echo "Test 5: Get Thread Statistics"
echo "------------------------------"
curl -X GET "$BASE_URL/thread-processor/thread-stats/thread_project_001" \
  -H "$CONTENT_TYPE"

echo ""
echo ""

# Test 6: Dashboard Summary
echo "Test 6: Dashboard Summary"
echo "-------------------------"
curl -X GET "$BASE_URL/thread-processor/dashboard-summary" \
  -H "$CONTENT_TYPE"

echo ""
echo ""

# Test 7: Tactical Pattern Analysis
echo "Test 7: Tactical Pattern Analysis"
echo "----------------------------------"
curl -X POST "$BASE_URL/thread-processor/analyze-tactical-patterns" \
  -H "$CONTENT_TYPE" \
  -d '{
    "query": "suspicious communication patterns",
    "timeRange": "7d",
    "minSuspicionScore": 0.5
  }'

echo ""
echo ""
echo "✅ Integration tests completed!"
echo "Check the responses above to verify the system is working correctly."
echo ""
echo "🔍 Key things to verify:"
echo "1. Spam messages are detected and quarantined"
echo "2. Legitimate messages are processed and analyzed"
echo "3. Thread analysis extracts inline replies correctly"
echo "4. Processing status shows current system state"
echo "5. Thread statistics track conversation metrics"
echo "6. Dashboard provides system-wide overview"
echo "7. Tactical analysis identifies patterns"

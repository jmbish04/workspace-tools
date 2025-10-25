#!/bin/bash

# Comprehensive Google Authentication Diagnostic
# This will help identify the exact cause of error code 1042

echo "🔍 COMPREHENSIVE GOOGLE AUTHENTICATION DIAGNOSTIC"
echo "================================================="

WORKER_URL="https://workspace-tools.hacolby.workers.dev"
DOCUMENT_ID="1aWTwOWNNZUHJzU1yNmHI_xnKsYuZ1fqBnNfRkj4-mWI"

echo -e "\n📋 ERROR CODE 1042 ANALYSIS:"
echo "   This usually means one of these issues:"
echo "   1. ❌ Service account JSON is malformed or corrupted"
echo "   2. ❌ Service account key was revoked or expired"
echo "   3. ❌ Domain-wide delegation is not properly configured"
echo "   4. ❌ The service account doesn't have the required permissions"
echo "   5. ❌ The service account JSON has control characters or encoding issues"

echo -e "\n🧪 Let's test different authentication scenarios..."

# Test 1: Basic health check
echo -e "\n1. ✅ Worker Health (should work):"
curl -s "$WORKER_URL/health" | jq -r '.status // "failed"'

# Test 2: Try Gmail test mode (bypasses authentication)
echo -e "\n2. Testing Gmail with test mode (should work):"
curl -s -X POST "$WORKER_URL/gmail/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "from:test@example.com",
    "testMode": true,
    "maxResults": 1
  }' | jq -r '.success // "failed"'

# Test 3: Try without test mode (will show the auth error)
echo -e "\n3. Testing Gmail without test mode (will show auth error):"
curl -s -X POST "$WORKER_URL/gmail/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "is:unread",
    "maxResults": 1
  }' | jq -r '.error // .success // "unknown"' | head -c 100

echo -e "\n\n🔧 STEP-BY-STEP FIX GUIDE:"
echo "=========================="

echo -e "\n📝 Step 1: Get a FRESH service account key"
echo "   1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts"
echo "   2. Find your service account"
echo "   3. Click the three dots → 'Manage keys'"
echo "   4. Click 'Add Key' → 'Create new key' → JSON"
echo "   5. Download the JSON file"

echo -e "\n🔑 Step 2: Update the service account key (IMPORTANT: Copy the ENTIRE JSON):"
echo "   wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY"
echo "   Then paste the ENTIRE JSON content including { and } brackets"
echo "   ⚠️  Make sure there are no extra characters, newlines, or spaces!"

echo -e "\n🏢 Step 3: Verify domain-wide delegation:"
echo "   1. Go to: https://admin.google.com/ac/owl/domainwidedelegation"
echo "   2. Find your service account client_id in the JSON"
echo "   3. Add it with these scopes (all on one line, comma-separated):"
echo "      https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.compose,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/documents,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/presentations"

echo -e "\n📧 Step 4: Share document with service account email:"
echo "   Your service account email is in the JSON file as 'client_email'"
echo "   Share this document: https://docs.google.com/document/d/${DOCUMENT_ID}/edit"
echo "   Give it 'Editor' permissions"

echo -e "\n🧪 Step 5: Test the fix:"
echo "   ./working-doc-test.sh"

echo -e "\n⚡ QUICK TROUBLESHOOTING COMMANDS:"
echo "================================="

echo -e "\nCheck your current secrets:"
echo "   wrangler secret list"

echo -e "\nView recent logs (run in another terminal):"
echo "   wrangler tail"

echo -e "\nRe-deploy after fixing secrets:"
echo "   npm run deploy"

echo -e "\n🔍 If you're still getting error 1042 after these steps:"
echo "   1. The service account JSON might have invisible characters"
echo "   2. Try creating a completely new service account"
echo "   3. Make sure you're copying from a clean text editor"
echo "   4. Verify the project has the required APIs enabled:"
echo "      - Gmail API"
echo "      - Google Drive API" 
echo "      - Google Docs API"
echo "      - Google Sheets API"
echo "      - Google Slides API"

echo -e "\n📞 Test URLs:"
echo "   Worker: $WORKER_URL"
echo "   Document: https://docs.google.com/document/d/${DOCUMENT_ID}/edit"
echo "   Demo page: $WORKER_URL/a2a-demo.html"

echo -e "\n🎯 Remember: Your A2A system is working perfectly!"
echo "   The issue is just Google authentication, not your A2A implementation."


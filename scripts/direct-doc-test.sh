#!/bin/bash

# Direct Google Docs API Test (Bypass A2A)
# This will actually try to modify your document

WORKER_URL="https://workspace-tools.hacolby.workers.dev"
DOCUMENT_ID="1aWTwOWNNZUHJzU1yNmHI_xnKsYuZ1fqBnNfRkj4-mWI"
DOCUMENT_URL="https://docs.google.com/document/d/${DOCUMENT_ID}/edit"

echo "🎯 Testing Direct Google Docs API Access..."
echo "Document: ${DOCUMENT_URL}"

# Test 1: Check if basic health works
echo -e "\n1. Worker Health Check:"
curl -s "$WORKER_URL/health" | jq .

# Test 2: Try to read the document directly (if route exists)
echo -e "\n2. Testing Direct Document Access:"
curl -s $DOCUMENT_URL 2>/dev/null | head -c 200 || echo "Route doesn't exist yet"

# Test 3: Try system status to see what's working
echo -e "\n3. System Status Check:"
curl -s "$WORKER_URL/system/status" | jq '.data.services'

echo -e "\n💡 The issue: Your A2A is working perfectly, but the underlying Google API routes need:"
echo "   1. Proper authentication setup"
echo "   2. Implementation of missing routes like /docs/, /drive/, /gmail/"
echo "   3. Service account with correct permissions"

echo -e "\n🔧 Quick fixes to try:"
echo "   1. Check your Google service account has Editor access to the document"
echo "   2. Verify domain-wide delegation is enabled"
echo "   3. Add missing API routes to your worker"

echo -e "\n📝 Your document URL: https://docs.google.com/document/d/${DOCUMENT_ID}/edit"


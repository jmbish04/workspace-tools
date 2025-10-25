#!/bin/bash

# Working Document Test - This should actually access your Google Doc!
WORKER_URL="https://workspace-tools.hacolby.workers.dev"
DOCUMENT_ID="1aWTwOWNNZUHJzU1yNmHI_xnKsYuZ1fqBnNfRkj4-mWI"

echo "🎯 Testing ACTUAL Google Docs API Routes..."
echo "Document: https://docs.google.com/document/d/${DOCUMENT_ID}/edit"

# Test 1: Try to READ the document using the correct route
echo -e "\n1. Reading Document Content:"
curl -s -X POST "$WORKER_URL/docs/read" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "'$DOCUMENT_ID'",
    "user": "default"
  }' | jq . || echo "Failed to read document"

# Test 2: Test A2A with the corrected internal routes
echo -e "\n2. Testing A2A Document Operations (should work now):"
curl -s -X POST "$WORKER_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "drive_management",
    "parameters": {
      "operation": "read", 
      "params": {
        "fileId": "'$DOCUMENT_ID'"
      }
    },
    "metadata": {
      "requestId": "working-test-'$(date +%s)'",
      "source": "working-document-test"
    }
  }' | jq .

echo -e "\n🎉 If you see actual document content above, your A2A integration is working!"
echo "📝 Document URL: https://docs.google.com/document/d/${DOCUMENT_ID}/edit"


#!/bin/bash

# Test Fixes Script - Verify that the API fixes work
WORKER_URL="https://workspace-tools.hacolby.workers.dev"
DOCUMENT_ID="1aWTwOWNNZUHJzU1yNmHI_xnKsYuZ1fqBnNfRkj4-mWI"

echo "🔧 Testing API fixes..."
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
        "fileId": "'$DOCUMENT_ID'",
        "user": "default"
      }
    },
    "metadata": {
      "requestId": "test-fix-'$(date +%s)'",
      "source": "test-fixes"
    }
  }' | jq .

# Test 3: Test Drive search
echo -e "\n3. Testing Drive Search:"
curl -s -X POST "$WORKER_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "drive_management",
    "parameters": {
      "operation": "search", 
      "params": {
        "query": "test",
        "user": "default"
      }
    },
    "metadata": {
      "requestId": "test-search-'$(date +%s)'",
      "source": "test-fixes"
    }
  }' | jq .

echo -e "\n🎉 If you see actual content above, the fixes are working!"
echo "📝 Document URL: https://docs.google.com/document/d/${DOCUMENT_ID}/edit"

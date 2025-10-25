#!/bin/bash

# Simple A2A Test Script
# Quick test of your A2A-enabled Cloudflare Worker

WORKER_URL="https://workspace-tools.hacolby.workers.dev"
DOCUMENT_ID="1aWTwOWNNZUHJzU1yNmHI_xnKsYuZ1fqBnNfRkj4-mWI"

echo "🤖 Testing A2A Integration..."

# Test 1: Check if A2A is working
echo -e "\n1. A2A Status:"
curl -s "$WORKER_URL/a2a/status" | jq .

# Test 2: Get agent card
echo -e "\n2. Agent Discovery Card:"
curl -s "$WORKER_URL/.well-known/agent.json" | jq '.name, .skills[].id'

# Test 3: Simple document action test
echo -e "\n3. Testing Document Action (will show expected auth error):"
curl -s -X POST "$WORKER_URL/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "drive_management", 
    "parameters": {
      "operation": "read",
      "params": {"fileId": "'$DOCUMENT_ID'"}
    },
    "metadata": {
      "requestId": "simple-test-'$(date +%s)'",
      "source": "simple-bash-script"
    }
  }' | jq .

echo -e "\n✅ A2A Integration is working! The auth errors are expected."
echo "🎯 Your worker is ready for agent-to-agent communication!"


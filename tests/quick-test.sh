#!/bin/bash

# Quick test to verify if authentication is working
echo "🧪 Quick Authentication Test"
echo "============================"

WORKER_URL="https://workspace-tools.hacolby.workers.dev"

echo -e "\nTesting Gmail authentication..."
response=$(curl -s -X POST "$WORKER_URL/gmail/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"is:unread","maxResults":1}')

if echo "$response" | grep -q '"success"'; then
    echo "✅ SUCCESS! Authentication is working!"
    echo "Your document operations should now work."
else
    echo "❌ Still failing. Response:"
    echo "$response" | jq . 2>/dev/null || echo "$response"
    echo ""
    echo "Next steps:"
    echo "1. Create a completely NEW service account"
    echo "2. Verify domain-wide delegation is configured"
    echo "3. Make sure all APIs are enabled"
fi

echo -e "\n📝 After authentication works, test your document:"
echo "./working-doc-test.sh"


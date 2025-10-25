#!/bin/bash

# Service Account JSON Fix Script
# This will help you properly set up the service account key

echo "🔧 SERVICE ACCOUNT JSON FIX SCRIPT"
echo "=================================="

echo -e "\n🎯 MOST LIKELY CAUSES OF YOUR ERROR 1042:"
echo "1. ❌ Service account JSON has invisible characters or formatting issues"
echo "2. ❌ Domain-wide delegation not configured properly"
echo "3. ❌ Service account key expired or revoked"

echo -e "\n📝 STEP 1: Download a FRESH Service Account Key"
echo "=============================================="
echo "1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts"
echo "2. Find your service account (or create a new one)"
echo "3. Click the 3 dots menu → 'Manage keys'"
echo "4. Delete any old keys"
echo "5. Click 'Add Key' → 'Create new key' → 'JSON'"
echo "6. Download the .json file"

echo -e "\n🔑 STEP 2: Set the Service Account Key (CRITICAL)"
echo "=============================================="
echo "Run this command and follow the instructions carefully:"
echo ""
echo "   wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY"
echo ""
echo "When prompted, paste the ENTIRE JSON content:"
echo "- Open the downloaded .json file in a text editor"
echo "- Copy ALL content including { and } brackets"
echo "- Make sure there are NO extra spaces or newlines"
echo "- The JSON should start with { and end with }"

echo -e "\n📋 STEP 3: Verify Domain-Wide Delegation"
echo "========================================"
echo "1. Go to: https://admin.google.com/ac/owl/domainwidedelegation"
echo "2. Look for your service account's client_id"
echo "3. If not found, click 'Add new' and add:"
echo ""
echo "   Client ID: [from your service account JSON - 'client_id' field]"
echo "   OAuth Scopes (paste this exact line):"
echo "   https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.compose,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/documents,https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/presentations"

echo -e "\n🌐 STEP 4: Enable Required APIs"
echo "==============================="
echo "Go to: https://console.cloud.google.com/apis/library"
echo "Make sure these APIs are ENABLED:"
echo "- Gmail API"
echo "- Google Drive API"
echo "- Google Docs API"
echo "- Google Sheets API"
echo "- Google Slides API"

echo -e "\n🧪 STEP 5: Test the Fix"
echo "======================="
echo "After completing steps 1-4:"
echo ""
echo "1. Wait 2-3 minutes for changes to propagate"
echo "2. Run: npm run deploy"
echo "3. Test with: ./working-doc-test.sh"

echo -e "\n⚠️  COMMON MISTAKES TO AVOID:"
echo "============================"
echo "❌ Don't copy JSON from terminal output"
echo "❌ Don't add extra quotes around the JSON"
echo "❌ Don't copy partial JSON (must include { and })"
echo "❌ Don't use expired or revoked keys"
echo "❌ Don't forget to authorize in domain-wide delegation"

echo -e "\n🔍 TROUBLESHOOTING:"
echo "=================="
echo "If it still doesn't work:"
echo ""
echo "1. Create a COMPLETELY NEW service account:"
echo "   https://console.cloud.google.com/iam-admin/serviceaccounts"
echo ""
echo "2. Check wrangler logs in real-time:"
echo "   wrangler tail"
echo ""
echo "3. Verify your current secrets:"
echo "   wrangler secret list"

echo -e "\n🎯 QUICK TEST COMMANDS:"
echo "======================"
echo "# Test Gmail (should work after fix):"
echo 'curl -X POST "https://workspace-tools.hacolby.workers.dev/gmail/search" -H "Content-Type: application/json" -d '\''{"query":"is:unread","maxResults":1}'\'''
echo ""
echo "# Test document reading:"
echo 'curl -X POST "https://workspace-tools.hacolby.workers.dev/docs/read" -H "Content-Type: application/json" -d '\''{"documentId":"1aWTwOWNNZUHJzU1yNmHI_xnKsYuZ1fqBnNfRkj4-mWI","user":"default"}'\'''

echo -e "\n🚀 Once this is fixed, your document actions will work!"
echo "Your A2A system is already perfect - it's just waiting for authentication."


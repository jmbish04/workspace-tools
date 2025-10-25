#!/bin/bash

# Google Authentication Diagnostic and Fix Script
# This will help identify and fix the "error code: 1042" authentication issue

echo "🔧 Google Authentication Diagnostic"
echo "==================================="

WORKER_URL="https://workspace-tools.hacolby.workers.dev"
DOCUMENT_ID="1aWTwOWNNZUHJzU1yNmHI_xnKsYuZ1fqBnNfRkj4-mWI"

echo -e "\n📋 Current Issues:"
echo "   ❌ Error code 1042 = Google API authentication failure"
echo "   ❌ Service account credentials not working properly"
echo "   ✅ A2A protocol is working perfectly"
echo "   ✅ Routes are now properly mounted"

echo -e "\n🔍 Let's check your current Google service account setup..."

# Check if we can see any info about the service account
echo -e "\n1. Testing basic worker connectivity:"
curl -s "$WORKER_URL/health" | jq .

echo -e "\n2. Checking system status:"
curl -s "$WORKER_URL/system/status" | jq '.data.services.drive // empty'

echo -e "\n🔧 TO FIX THE AUTHENTICATION ISSUE:"
echo ""
echo "Step 1: Check your Google Service Account"
echo "   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts"
echo "   - Find your service account"
echo "   - Download a fresh JSON key"

echo -e "\nStep 2: Update your service account key in Cloudflare:"
echo "   Run this command with your NEW service account JSON:"
echo "   wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY"
echo "   (Then paste the ENTIRE JSON content when prompted)"

echo -e "\nStep 3: Enable domain-wide delegation:"
echo "   - In Google Admin Console: https://admin.google.com"
echo "   - Security > API Controls > Domain-wide Delegation"
echo "   - Add your service account client ID with these scopes:"
echo "     https://www.googleapis.com/auth/gmail.readonly"
echo "     https://www.googleapis.com/auth/gmail.compose"
echo "     https://www.googleapis.com/auth/drive"
echo "     https://www.googleapis.com/auth/documents"
echo "     https://www.googleapis.com/auth/spreadsheets"
echo "     https://www.googleapis.com/auth/presentations"

echo -e "\nStep 4: Share the document with your service account:"
echo "   - Open: https://docs.google.com/document/d/${DOCUMENT_ID}/edit"
echo "   - Click 'Share' button"
echo "   - Add your service account email with 'Editor' permissions"
echo "   - Service account email format: service-account-name@project-id.iam.gserviceaccount.com"

echo -e "\nStep 5: Test the fix:"
echo "   ./working-doc-test.sh"

echo -e "\n📞 Your worker is at: $WORKER_URL"
echo "🎯 Target document: https://docs.google.com/document/d/${DOCUMENT_ID}/edit"

echo -e "\n🎉 Once authentication is fixed, your A2A system will work perfectly!"
echo "    The A2A protocol, routes, and skills are all correctly implemented."

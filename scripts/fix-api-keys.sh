#!/bin/bash

echo "🔧 Fixing Cloudflare Worker API Configuration"
echo "============================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

echo "📋 Current secret status:"
wrangler secret list

echo ""
echo "⚠️  Missing API keys can cause 401 authentication errors"
echo ""

# Check and set OpenAI API Key
echo "🔑 Checking OpenAI API Key..."
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY not set in environment"
    read -p "Do you want to set OPENAI_API_KEY now? (y/N): " set_openai
    
    if [[ $set_openai =~ ^[Yy]$ ]]; then
        read -s -p "Enter your OpenAI API Key: " openai_key
        echo ""
        echo "Setting OPENAI_API_KEY secret..."
        echo "$openai_key" | wrangler secret put OPENAI_API_KEY
        echo "✅ OPENAI_API_KEY configured"
    fi
else
    echo "✅ OPENAI_API_KEY found in environment"
fi

# Check other optional API keys
echo ""
echo "🔍 Checking other API keys..."

echo "Gemini API Key:"
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  GEMINI_API_KEY not set (optional)"
    read -p "Set GEMINI_API_KEY? (y/N): " set_gemini
    if [[ $set_gemini =~ ^[Yy]$ ]]; then
        read -s -p "Enter your Gemini API Key: " gemini_key
        echo ""
        echo "$gemini_key" | wrangler secret put GEMINI_API_KEY
        echo "✅ GEMINI_API_KEY configured"
    fi
else
    echo "✅ GEMINI_API_KEY found"
fi

echo ""
echo "Anthropic API Key:"
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  ANTHROPIC_API_KEY not set (optional)"
    read -p "Set ANTHROPIC_API_KEY? (y/N): " set_anthropic
    if [[ $set_anthropic =~ ^[Yy]$ ]]; then
        read -s -p "Enter your Anthropic API Key: " anthropic_key
        echo ""
        echo "$anthropic_key" | wrangler secret put ANTHROPIC_API_KEY
        echo "✅ ANTHROPIC_API_KEY configured"
    fi
else
    echo "✅ ANTHROPIC_API_KEY found"
fi

echo ""
echo "Google Service Account:"
if [ -z "$GOOGLE_SERVICE_ACCOUNT_KEY" ]; then
    echo "⚠️  GOOGLE_SERVICE_ACCOUNT_KEY not set (required for Gmail integration)"
    read -p "Set GOOGLE_SERVICE_ACCOUNT_KEY? (y/N): " set_google
    if [[ $set_google =~ ^[Yy]$ ]]; then
        read -p "Enter path to your service account JSON file: " service_account_path
        if [ -f "$service_account_path" ]; then
            wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY < "$service_account_path"
            echo "✅ GOOGLE_SERVICE_ACCOUNT_KEY configured"
        else
            echo "❌ File not found: $service_account_path"
        fi
    fi
else
    echo "✅ GOOGLE_SERVICE_ACCOUNT_KEY found"
fi

echo ""
echo "📋 Updated secret status:"
wrangler secret list

echo ""
echo "🚀 Ready to deploy! Run:"
echo "wrangler deploy"

#!/bin/bash

# This script automates the configuration of Google API secrets for the Cloudflare Worker.
# It reads credentials from a Google OAuth JSON file and a provided refresh token,
# creates a .dev.vars file, and then uploads the secrets to Cloudflare.

set -e

echo "--- Google API Secret Configuration ---"
echo

# --- Functions ---

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to check for jq
check_jq() {
  if ! command_exists jq; then
    echo "Error: 'jq' is not installed."
    echo "This script requires jq to parse the Google credentials JSON file."
    echo "Please install jq to continue. (e.g., 'brew install jq' or 'sudo apt-get install jq')"
    exit 1
  fi
}

# Function to validate file exists
validate_file() {
  if [ ! -f "$1" ]; then
    echo "Error: File '$1' does not exist."
    exit 1
  fi
}

# Function to validate JSON format
validate_json() {
  if ! jq empty "$1" 2>/dev/null; then
    echo "Error: '$1' is not valid JSON."
    exit 1
  fi
}

# --- Main Script ---

check_jq

# Check for required commands
if ! command_exists npx; then
  echo "Error: 'npx' is not installed. Please install Node.js to continue."
  exit 1
fi

echo "This script will help you configure Google API secrets for your Cloudflare Worker."
echo

# Get Google credentials file
read -p "Enter the path to your Google OAuth credentials JSON file: " GOOGLE_CREDS_FILE
validate_file "$GOOGLE_CREDS_FILE"
validate_json "$GOOGLE_CREDS_FILE"

# Get refresh token
echo
echo "You need a refresh token. You can get one by:"
echo "1. Using Google OAuth Playground (https://developers.google.com/oauthplayground/)"
echo "2. Using the Google API Client Library with offline access"
echo
read -p "Enter your Google refresh token: " REFRESH_TOKEN

if [ -z "$REFRESH_TOKEN" ]; then
  echo "Error: Refresh token cannot be empty."
  exit 1
fi

# Extract values from JSON
GOOGLE_CLIENT_ID=$(jq -r '.web.client_id // .installed.client_id' "$GOOGLE_CREDS_FILE")
GOOGLE_CLIENT_SECRET=$(jq -r '.web.client_secret // .installed.client_secret' "$GOOGLE_CREDS_FILE")

if [ "$GOOGLE_CLIENT_ID" = "null" ] || [ "$GOOGLE_CLIENT_SECRET" = "null" ]; then
  echo "Error: Could not extract client_id or client_secret from the credentials file."
  echo "Please ensure your JSON file contains either 'web' or 'installed' credentials."
  exit 1
fi

echo
echo "Extracted credentials:"
echo "Client ID: $GOOGLE_CLIENT_ID"
echo "Client Secret: ${GOOGLE_CLIENT_SECRET:0:10}..."
echo

# Create .dev.vars file
echo "Creating .dev.vars file..."
cat > .dev.vars << EOF
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN=$REFRESH_TOKEN
EOF

echo "✓ .dev.vars file created successfully."
echo

# Upload secrets to Cloudflare
echo "Uploading secrets to Cloudflare Workers..."

npx wrangler secret put GOOGLE_CLIENT_ID --var="$GOOGLE_CLIENT_ID"
npx wrangler secret put GOOGLE_CLIENT_SECRET --var="$GOOGLE_CLIENT_SECRET"
npx wrangler secret put GOOGLE_REFRESH_TOKEN --var="$REFRESH_TOKEN"

echo
echo "✓ Google API secrets uploaded successfully!"

# Configure AI Provider API Keys (optional)
echo
echo "--- AI Provider API Keys Configuration (Optional) ---"
echo "Configure API keys for AI providers (leave blank to skip):"
echo

# OpenAI API Key
read -p "Enter OpenAI API Key (optional): " OPENAI_API_KEY
if [ ! -z "$OPENAI_API_KEY" ]; then
  echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> .dev.vars
  npx wrangler secret put OPENAI_API_KEY --var="$OPENAI_API_KEY"
  echo "✓ OpenAI API key configured"
fi

# Gemini API Key
read -p "Enter Gemini API Key (optional): " GEMINI_API_KEY
if [ ! -z "$GEMINI_API_KEY" ]; then
  echo "GEMINI_API_KEY=$GEMINI_API_KEY" >> .dev.vars
  npx wrangler secret put GEMINI_API_KEY --var="$GEMINI_API_KEY"
  echo "✓ Gemini API key configured"
fi

# Anthropic API Key
read -p "Enter Anthropic API Key (optional): " ANTHROPIC_API_KEY
if [ ! -z "$ANTHROPIC_API_KEY" ]; then
  echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> .dev.vars
  npx wrangler secret put ANTHROPIC_API_KEY --var="$ANTHROPIC_API_KEY"
  echo "✓ Anthropic API key configured"
fi

# Google Service Account Key
read -p "Enter Google Service Account JSON file path (optional): " SERVICE_ACCOUNT_FILE
if [ ! -z "$SERVICE_ACCOUNT_FILE" ] && [ -f "$SERVICE_ACCOUNT_FILE" ]; then
  validate_json "$SERVICE_ACCOUNT_FILE"
  SERVICE_ACCOUNT_KEY=$(cat "$SERVICE_ACCOUNT_FILE" | jq -c .)
  echo "GOOGLE_SERVICE_ACCOUNT_KEY=$SERVICE_ACCOUNT_KEY" >> .dev.vars
  npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY --var="$SERVICE_ACCOUNT_KEY"
  echo "✓ Google Service Account key configured"
fi

echo
echo "✓ All secrets configured successfully!"
echo
echo "Your Google API integration and AI providers are now configured."
echo "You can now deploy your worker with: npx wrangler deploy"

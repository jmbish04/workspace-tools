# API Keys Setup Guide

This guide helps you configure API keys for the Workspace Tools Cloudflare Worker to enable AI provider integrations.

## Quick Setup

Run the automated configuration script:

```bash
./configure_secrets.sh
```

This script will:
1. Configure Google API credentials (required for Gmail/Drive integration)
2. Optionally configure AI provider API keys (OpenAI, Gemini, Anthropic)
3. Upload secrets to Cloudflare Workers

## Manual Setup

If you prefer manual configuration, use wrangler secrets:

### Required for Gmail/Drive Integration

```bash
# Google OAuth credentials
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET  
wrangler secret put GOOGLE_REFRESH_TOKEN

# Google Service Account (for domain delegation)
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
```

### Optional AI Provider API Keys

```bash
# OpenAI (for embeddings, chat completions)
wrangler secret put OPENAI_API_KEY

# Google Gemini (for text generation)
wrangler secret put GEMINI_API_KEY

# Anthropic Claude (for text analysis)
wrangler secret put ANTHROPIC_API_KEY
```

## Provider Status

The worker will automatically detect which providers are configured and skip those that aren't:

- ✅ **Workers AI**: Built-in (no API key required)
- ⚠️ **OpenAI**: Requires `OPENAI_API_KEY` 
- ⚠️ **Gemini**: Requires `GEMINI_API_KEY`
- ⚠️ **Anthropic**: Requires `ANTHROPIC_API_KEY`
- ⚠️ **Google APIs**: Requires OAuth or Service Account setup

## Getting API Keys

1. **OpenAI**: https://platform.openai.com/api-keys
2. **Google Gemini**: https://makersuite.google.com/app/apikey
3. **Anthropic**: https://console.anthropic.com/
4. **Google Cloud**: https://console.cloud.google.com/

## Verification

After configuration, test your setup:

```bash
# Test core functionality
python3 refined_api_test.py

# Test all endpoints
python3 comprehensive_api_test.py
```

The worker logs will show which providers are successfully initialized vs. skipped due to missing API keys.

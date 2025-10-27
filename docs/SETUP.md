# Workspace Tools - Setup Guide

This Cloudflare Worker provides comprehensive Google Workspace integration with AI capabilities.

## Quick Start

1. **Clone and Install**
   ```bash
   git clone https://github.com/jmbish04/worker-tools.git
   cd worker-tools
   npm install
   ```

2. **Configure Cloudflare Resources**
   ```bash
   # Copy the template configuration
   cp wrangler.toml.template wrangler.toml
   
   # Edit wrangler.toml with your Cloudflare resource IDs
   # - Create D1 databases: wrangler d1 create workspace-tools
   # - Create KV namespace: wrangler kv:namespace create "KV"
   # - Create Vectorize index: wrangler vectorize create workspace-tools-embeddings --preset=@cf/baai/bge-base-en-v1.5
   ```

3. **Set up API Keys**
   ```bash
   # Run the automated setup script
   ./scripts/configure_secrets.sh
   
   # Or manually set secrets
   wrangler secret put GEMINI_API_KEY
   wrangler secret put OPENAI_API_KEY
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
   ```

4. **Deploy**
   ```bash
   npx wrangler deploy
   ```

## Features

- **Gmail Integration**: Email analysis, spam detection, thread processing
- **Google Drive**: File management, document creation, comments
- **Google Docs**: Document processing, markdown conversion
- **Google Sheets**: Data analysis and processing
- **Google Slides**: Presentation management
- **AI Providers**: OpenAI, Gemini, Anthropic, Workers AI
- **A2A Protocol**: Agent-to-agent communication
- **Comprehensive Logging**: D1 database logging with verbosity levels

## Configuration

### Required Environment Variables
- `GOOGLE_SERVICE_ACCOUNT_KEY`: JSON service account key for Google APIs
- `GOOGLE_CLIENT_ID`: OAuth client ID
- `GOOGLE_CLIENT_SECRET`: OAuth client secret

### Optional AI Provider Keys
- `GEMINI_API_KEY`: Google Gemini API key
- `OPENAI_API_KEY`: OpenAI API key  
- `ANTHROPIC_API_KEY`: Anthropic Claude API key

### Database Setup
```bash
# Apply migrations
wrangler d1 migrations apply workspace-tools-db --local
wrangler d1 migrations apply workspace-tools-db
```

## Development

```bash
# Local development
npx wrangler dev

# Run tests
python3 tests/comprehensive_api_test.py

# Type checking
npx tsc --noEmit
```

## Security Notes

- All API keys are stored as Cloudflare Workers secrets
- No sensitive data is committed to the repository
- Database IDs and resource identifiers are in wrangler.toml (not sensitive)
- Use the template file for new deployments

## Documentation

- [API Documentation](docs/)
- [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)
- [API Keys Setup](docs/API_KEYS_SETUP.md)
- [Testing Guide](docs/TESTING_SUMMARY.md)

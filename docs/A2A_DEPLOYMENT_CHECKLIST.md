# A2A Integration Deployment Checklist

## ✅ Pre-Deployment Steps

### 1. Update Configuration

- [ ] **Update Google Docs Agent URLs** in `/src/services/a2a-client.ts`:
  ```typescript
  export const GOOGLE_DOCS_AGENT_CONFIG: A2AAgentConfig = {
    name: 'Google Docs AI Assistant',
    agentCardUrl: 'https://YOUR_ACTUAL_GOOGLE_DOCS_AGENT_URL/.well-known/agent.json',
    executeUrl: 'https://YOUR_ACTUAL_GOOGLE_DOCS_AGENT_URL/execute',
    description: 'AI assistant for Google Docs operations with vector search and conversational AI'
  };
  ```

- [ ] **Verify Worker URL** in examples and demo files:
  - Update `WORKER_URL` in `/examples/a2a-examples.js`
  - Update any hardcoded URLs in demo files

### 2. Test Compilation

- [ ] Run TypeScript compilation:
  ```bash
  npx tsc --noEmit
  ```

- [ ] Check for linting errors:
  ```bash
  # If you have a linter configured
  npm run lint
  ```

### 3. Local Testing

- [ ] Start local development:
  ```bash
  npm run start
  # or
  wrangler dev
  ```

- [ ] Test A2A endpoints locally:
  ```bash
  curl "http://localhost:8787/.well-known/agent.json"
  curl "http://localhost:8787/a2a/status"
  curl "http://localhost:8787/a2a/health"
  ```

## 🚀 Deployment Steps

### 1. Deploy to Cloudflare Workers

- [ ] Deploy the worker:
  ```bash
  npm run deploy
  # or
  wrangler deploy
  ```

- [ ] Verify deployment success
- [ ] Note the deployed worker URL

### 2. Post-Deployment Verification

- [ ] **Test Agent Card Endpoint**:
  ```bash
  curl "https://your-worker.workers.dev/.well-known/agent.json"
  ```
  Expected: Valid A2A agent card JSON

- [ ] **Test A2A Status**:
  ```bash
  curl "https://your-worker.workers.dev/a2a/status"
  ```
  Expected: Success response with server/client status

- [ ] **Test Health Check**:
  ```bash
  curl "https://your-worker.workers.dev/a2a/health"
  ```
  Expected: Healthy status response

- [ ] **Test Skill Execution**:
  ```bash
  curl -X POST "https://your-worker.workers.dev/execute" \
    -H "Content-Type: application/json" \
    -d '{
      "skill": "gmail_operations",
      "parameters": {
        "operation": "search",
        "params": {
          "query": "is:unread",
          "maxResults": 1
        }
      },
      "metadata": {
        "requestId": "test-123",
        "source": "deployment-test"
      }
    }'
  ```

### 3. Demo Page Verification

- [ ] **Access Demo Page**:
  Visit `https://your-worker.workers.dev/a2a-demo.html`

- [ ] **Test Demo Functions**:
  - [ ] System Status Check
  - [ ] Agent Card Retrieval
  - [ ] Skills Demo (at least one)
  - [ ] Cached Agents List

## 🔗 Google Docs Agent Integration

### 1. Ensure Google Docs Agent is A2A-Ready

- [ ] **Verify Google Docs agent has A2A endpoints**:
  ```bash
  curl "https://YOUR_GOOGLE_DOCS_AGENT_URL/.well-known/agent.json"
  ```

- [ ] **Test Google Docs agent execute endpoint**:
  ```bash
  curl -X POST "https://YOUR_GOOGLE_DOCS_AGENT_URL/execute" \
    -H "Content-Type: application/json" \
    -d '{
      "skill": "document_operations",
      "parameters": {
        "operations": [
          {"type": "insertText", "index": 1, "text": "A2A Test"}
        ]
      }
    }'
  ```

### 2. Test Cross-Agent Communication

- [ ] **Test Document Operations via A2A**:
  ```bash
  curl -X POST "https://your-worker.workers.dev/a2a/docs/operations" \
    -H "Content-Type: application/json" \
    -d '{
      "operations": [
        {"type": "insertText", "index": 1, "text": "A2A Integration Test\n"},
        {"type": "setHeading", "startIndex": 1, "endIndex": 20, "level": 1}
      ],
      "description": "Deployment test document"
    }'
  ```

- [ ] **Test Vector Search**:
  ```bash
  curl -X POST "https://your-worker.workers.dev/a2a/docs/search" \
    -H "Content-Type: application/json" \
    -d '{
      "query": "test query",
      "maxResults": 5
    }'
  ```

## 🔧 Configuration Updates

### 1. DNS and Routing (if applicable)

- [ ] Update DNS records if using custom domain
- [ ] Configure SSL certificates
- [ ] Update CORS settings if needed

### 2. Environment Variables

- [ ] Verify all required secrets are set:
  ```bash
  wrangler secret list
  ```

- [ ] Required secrets should include:
  - [ ] `GOOGLE_SERVICE_ACCOUNT_KEY`
  - [ ] `GEMINI_API_KEY`
  - [ ] `ANTHROPIC_API_KEY`
  - [ ] `OPENAI_API_KEY`

### 3. Database Migrations

- [ ] Apply database migrations if any:
  ```bash
  npm run migrate:remote
  ```

## 📊 Monitoring Setup

### 1. Enable Observability

- [ ] Verify `[observability]` is enabled in `wrangler.toml`
- [ ] Set up Cloudflare Analytics if needed
- [ ] Configure error tracking

### 2. Performance Monitoring

- [ ] Test response times for A2A endpoints
- [ ] Monitor cold start performance
- [ ] Set up alerts for failed requests

## 🧪 Integration Testing

### 1. End-to-End Workflow Tests

- [ ] **Email to Document Workflow**:
  Test with actual Gmail message ID
  
- [ ] **Cross-Service Orchestration**:
  Test data-to-presentation workflow
  
- [ ] **Agent Discovery**:
  Test discovering and caching external agents

### 2. Error Handling Tests

- [ ] Test with invalid skill names
- [ ] Test with malformed parameters
- [ ] Test network timeout scenarios
- [ ] Test authentication failures

## 📋 Documentation Updates

### 1. Update Project Documentation

- [ ] Update main README.md with A2A capabilities
- [ ] Add A2A endpoints to API documentation
- [ ] Update deployment guides

### 2. Create Usage Examples

- [ ] Provide cURL examples for common use cases
- [ ] Create JavaScript/TypeScript client examples
- [ ] Document workflow patterns

## ✅ Final Verification Checklist

### Core A2A Functionality

- [ ] ✅ Agent card accessible at `/.well-known/agent.json`
- [ ] ✅ Execute endpoint working at `/execute`
- [ ] ✅ Health check responding at `/a2a/health`
- [ ] ✅ Status endpoint working at `/a2a/status`

### Client Functionality

- [ ] ✅ Can discover external agents
- [ ] ✅ Can execute skills on external agents
- [ ] ✅ Agent caching working
- [ ] ✅ Error handling working

### Google Docs Integration

- [ ] ✅ Document operations working
- [ ] ✅ Vector search working
- [ ] ✅ Conversational AI working
- [ ] ✅ Cross-agent workflows working

### Demo and Examples

- [ ] ✅ Demo page accessible and functional
- [ ] ✅ Example scripts working
- [ ] ✅ Documentation complete

## 🚨 Rollback Plan

In case of issues:

### 1. Quick Rollback

- [ ] Keep previous working version tagged
- [ ] Prepare rollback command:
  ```bash
  wrangler rollback
  ```

### 2. Partial Rollback

- [ ] Disable A2A routes if needed
- [ ] Comment out A2A route mounting in `src/index.ts`:
  ```typescript
  // app.route("/", a2aRoutes);
  // app.route("/a2a", a2aRoutes);
  ```

### 3. Debug Mode

- [ ] Enable detailed logging
- [ ] Use `wrangler tail` for real-time logs
- [ ] Check Cloudflare dashboard for error metrics

---

## 📞 Support

After deployment, test the integration with:

1. **Demo Page**: `https://your-worker.workers.dev/a2a-demo.html`
2. **Status Check**: `https://your-worker.workers.dev/a2a/status`
3. **Agent Card**: `https://your-worker.workers.dev/.well-known/agent.json`

🎉 **Your Cloudflare Worker is now A2A-enabled and ready for agent-to-agent communication!**

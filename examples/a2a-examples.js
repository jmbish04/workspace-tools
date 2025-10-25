/**
 * A2A (Agent-to-Agent) Integration Examples
 * 
 * This file contains practical examples demonstrating how to use the A2A protocol
 * integration in your Cloudflare Worker.
 */

// Replace with your actual worker URL
const WORKER_URL = 'https://your-worker.workers.dev';

// Replace with your actual Google Docs agent URLs
const GOOGLE_DOCS_AGENT = {
  name: 'Google Docs AI Assistant',
  agentCardUrl: 'https://YOUR_GOOGLE_DOCS_AGENT_URL/.well-known/agent.json',
  executeUrl: 'https://YOUR_GOOGLE_DOCS_AGENT_URL/execute'
};

/**
 * Example 1: Get Agent Card (Agent Discovery)
 */
async function getAgentCard() {
  console.log('🔍 Getting agent card...');
  
  try {
    const response = await fetch(`${WORKER_URL}/.well-known/agent.json`);
    const agentCard = await response.json();
    
    console.log('✅ Agent Card Retrieved:');
    console.log('  Name:', agentCard.name);
    console.log('  Description:', agentCard.description);
    console.log('  Skills:', agentCard.skills.map(s => s.id).join(', '));
    console.log('  URL:', agentCard.url);
    
    return agentCard;
  } catch (error) {
    console.error('❌ Failed to get agent card:', error.message);
  }
}

/**
 * Example 2: Execute Gmail Operations via A2A
 */
async function executeGmailSearch() {
  console.log('📧 Executing Gmail search via A2A...');
  
  try {
    const response = await fetch(`${WORKER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill: 'gmail_operations',
        parameters: {
          operation: 'search',
          params: {
            query: 'is:unread',
            maxResults: 5
          }
        },
        metadata: {
          requestId: crypto.randomUUID(),
          source: 'a2a-example-script'
        }
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Gmail search completed');
      console.log('  Execution time:', result.metadata.executionTime, 'ms');
      console.log('  Messages found:', result.result?.data?.messages?.length || 0);
    } else {
      console.error('❌ Gmail search failed:', result.error?.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Gmail search error:', error.message);
  }
}

/**
 * Example 3: Call Google Docs Agent for Document Operations
 */
async function createDocumentViaA2A() {
  console.log('📝 Creating document via Google Docs A2A agent...');
  
  try {
    const response = await fetch(`${WORKER_URL}/a2a/docs/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operations: [
          { 
            type: 'insertText', 
            index: 1, 
            text: 'A2A Integration Test Document\n\n' 
          },
          { 
            type: 'setHeading', 
            startIndex: 1, 
            endIndex: 30, 
            level: 1 
          },
          { 
            type: 'insertText', 
            index: 32, 
            text: 'This document was created through A2A protocol!\n\n' 
          },
          { 
            type: 'insertText', 
            index: -1, 
            text: 'Key Features:\n• Cross-agent communication\n• Automated workflows\n• Google Workspace integration\n\n' 
          },
          { 
            type: 'insertTable', 
            index: -1, 
            rows: 3, 
            columns: 2 
          }
        ],
        description: 'A2A integration test document creation'
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.data.success) {
      console.log('✅ Document created successfully');
      console.log('  Document ID:', result.data.result?.documentId);
      console.log('  Execution time:', result.data.metadata?.executionTime, 'ms');
    } else {
      console.error('❌ Document creation failed:', result.error || result.data.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Document creation error:', error.message);
  }
}

/**
 * Example 4: Perform Vector Search via Google Docs Agent
 */
async function performVectorSearch() {
  console.log('🔍 Performing vector search via Google Docs A2A agent...');
  
  try {
    const response = await fetch(`${WORKER_URL}/a2a/docs/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'project timeline and deliverables',
        maxResults: 5
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.data.success) {
      console.log('✅ Vector search completed');
      console.log('  Results found:', result.data.result?.results?.length || 0);
      console.log('  Execution time:', result.data.metadata?.executionTime, 'ms');
    } else {
      console.error('❌ Vector search failed:', result.error || result.data.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Vector search error:', error.message);
  }
}

/**
 * Example 5: Email to Document Workflow
 */
async function emailToDocumentWorkflow(messageId) {
  console.log('📧➡️📄 Starting Email to Document workflow...');
  
  if (!messageId) {
    console.error('❌ Message ID required for this example');
    return;
  }
  
  try {
    const response = await fetch(`${WORKER_URL}/a2a/workflows/email-to-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: messageId,
        documentTitle: 'Email Report - A2A Integration Test'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Email to Document workflow completed');
      console.log('  Message ID:', result.data.messageId);
      console.log('  Workflow:', result.data.workflow);
    } else {
      console.error('❌ Email to Document workflow failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Email to Document workflow error:', error.message);
  }
}

/**
 * Example 6: Cross-Service Orchestration (Data to Presentation)
 */
async function dataToPresentation() {
  console.log('📊➡️🎨 Starting Data to Presentation workflow...');
  
  try {
    const response = await fetch(`${WORKER_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill: 'cross_service_orchestration',
        parameters: {
          workflow: 'data_to_presentation',
          params: {
            spreadsheetId: 'your-spreadsheet-id', // Replace with actual spreadsheet ID
            range: 'A1:D10',
            presentationTitle: 'A2A Integration Data Report'
          }
        },
        metadata: {
          requestId: crypto.randomUUID(),
          source: 'a2a-workflow-example'
        }
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Data to Presentation workflow completed');
      console.log('  Spreadsheet ID:', result.result.spreadsheetId);
      console.log('  Presentation ID:', result.result.presentationId);
      console.log('  Execution time:', result.metadata.executionTime, 'ms');
    } else {
      console.error('❌ Data to Presentation workflow failed:', result.error?.message);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Data to Presentation workflow error:', error.message);
  }
}

/**
 * Example 7: Discover External A2A Agent
 */
async function discoverGoogleDocsAgent() {
  console.log('🔍 Discovering Google Docs A2A agent...');
  
  try {
    const response = await fetch(`${WORKER_URL}/a2a/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: GOOGLE_DOCS_AGENT.name,
        agentCardUrl: GOOGLE_DOCS_AGENT.agentCardUrl,
        executeUrl: GOOGLE_DOCS_AGENT.executeUrl
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Google Docs agent discovered');
      console.log('  Agent name:', result.data.agent.name);
      console.log('  Skills:', result.data.agent.skills.map(s => s.id).join(', '));
      console.log('  Cached:', result.data.cached);
    } else {
      console.error('❌ Agent discovery failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Agent discovery error:', error.message);
  }
}

/**
 * Example 8: Get A2A Status
 */
async function getA2AStatus() {
  console.log('📊 Getting A2A status...');
  
  try {
    const response = await fetch(`${WORKER_URL}/a2a/status`);
    const status = await response.json();
    
    if (status.success) {
      console.log('✅ A2A Status Retrieved:');
      console.log('  Server enabled:', status.data.server.enabled);
      console.log('  Server skills:', status.data.server.skillCount);
      console.log('  Client enabled:', status.data.client.enabled);
      console.log('  Cached agents:', status.data.client.cachedAgents);
      console.log('  Agent card URL:', status.data.endpoints.agentCard);
      console.log('  Execute URL:', status.data.endpoints.execute);
    } else {
      console.error('❌ Failed to get A2A status');
    }
    
    return status;
  } catch (error) {
    console.error('❌ A2A status error:', error.message);
  }
}

/**
 * Example 9: List Cached Agents
 */
async function listCachedAgents() {
  console.log('📋 Listing cached A2A agents...');
  
  try {
    const response = await fetch(`${WORKER_URL}/a2a/agents`);
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Cached Agents:');
      result.data.agents.forEach(agent => {
        console.log(`  • ${agent.name} (${agent.skillCount} skills) - ${agent.url}`);
      });
      console.log('  Total agents:', result.data.totalCount);
    } else {
      console.error('❌ Failed to list cached agents');
    }
    
    return result;
  } catch (error) {
    console.error('❌ List cached agents error:', error.message);
  }
}

/**
 * Example 10: Conversational AI via Google Docs Agent
 */
async function conversationalAI() {
  console.log('💬 Starting conversational AI via Google Docs agent...');
  
  try {
    const response = await fetch(`${WORKER_URL}/a2a/docs/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Can you help me understand how A2A protocol works and its benefits for agent communication?',
        context: {
          topic: 'A2A integration',
          user: 'developer'
        }
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.data.success) {
      console.log('✅ Conversational AI response received');
      console.log('  Response length:', result.data.result?.response?.length || 0, 'characters');
      console.log('  Execution time:', result.data.metadata?.executionTime, 'ms');
    } else {
      console.error('❌ Conversational AI failed:', result.error || result.data.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Conversational AI error:', error.message);
  }
}

// Main execution function
async function runA2AExamples() {
  console.log('🚀 Starting A2A Integration Examples\n');
  console.log('Worker URL:', WORKER_URL);
  console.log('Google Docs Agent:', GOOGLE_DOCS_AGENT.name);
  console.log('─'.repeat(50));
  
  try {
    // Run examples in sequence
    await getAgentCard();
    console.log('─'.repeat(50));
    
    await getA2AStatus();
    console.log('─'.repeat(50));
    
    await discoverGoogleDocsAgent();
    console.log('─'.repeat(50));
    
    await executeGmailSearch();
    console.log('─'.repeat(50));
    
    await createDocumentViaA2A();
    console.log('─'.repeat(50));
    
    await performVectorSearch();
    console.log('─'.repeat(50));
    
    await conversationalAI();
    console.log('─'.repeat(50));
    
    await listCachedAgents();
    console.log('─'.repeat(50));
    
    // Note: These require specific IDs - uncomment and provide real values to test
    // await emailToDocumentWorkflow('your-gmail-message-id');
    // await dataToPresentation();
    
    console.log('✅ A2A Integration Examples Completed!');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error.message);
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAgentCard,
    executeGmailSearch,
    createDocumentViaA2A,
    performVectorSearch,
    emailToDocumentWorkflow,
    dataToPresentation,
    discoverGoogleDocsAgent,
    getA2AStatus,
    listCachedAgents,
    conversationalAI,
    runA2AExamples
  };
}

// Run examples if this script is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runA2AExamples().catch(console.error);
}

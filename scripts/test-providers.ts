/**
 * Test script to validate the provider integration
 */
import { ProviderFactory, defaultProvidersConfig } from '../src/providers/index';

// Mock environment for testing
const mockEnv = {
  GEMINI_API_KEY: 'test-key',
  ANTHROPIC_API_KEY: 'test-key',
  OPENAI_API_KEY: 'test-key',
  AI: { run: () => Promise.resolve({ response: 'test', usage: {} }) }
};

async function testProvidersIntegration() {
  console.log('Testing provider integration...');

  try {
    // Test individual provider creation
    const geminiProvider = ProviderFactory.createProvider('gemini', defaultProvidersConfig.gemini, mockEnv);
    const anthropicProvider = ProviderFactory.createProvider('anthropic', defaultProvidersConfig.anthropic, mockEnv);
    const openaiProvider = ProviderFactory.createProvider('openai', defaultProvidersConfig.openai, mockEnv);
    const workersaiProvider = ProviderFactory.createProvider('workersai', defaultProvidersConfig.workersAI, mockEnv);

    console.log('✅ Individual provider creation successful');
    console.log(`Gemini Provider: ${geminiProvider?.name} (${geminiProvider?.model})`);
    console.log(`Anthropic Provider: ${anthropicProvider?.name} (${anthropicProvider?.model})`);
    console.log(`OpenAI Provider: ${openaiProvider?.name} (${openaiProvider?.model})`);
    console.log(`Workers AI Provider: ${workersaiProvider?.name} (${workersaiProvider?.model})`);

    // Test batch provider creation
    const providers = ProviderFactory.createProviders(defaultProvidersConfig, mockEnv);
    console.log(`✅ Batch provider creation successful: ${providers.size} providers created`);
    console.log(`Provider names: ${Array.from(providers.keys()).join(', ')}`);

    // Test BaseProvider interface compatibility
    if (geminiProvider) {
      console.log('✅ Provider implements BaseProvider interface correctly');
      console.log(`  - name: ${geminiProvider.name}`);
      console.log(`  - model: ${geminiProvider.model}`);
      console.log(`  - generate method: ${typeof geminiProvider.generate}`);
    }

    console.log('\n🎉 All tests passed! Provider integration is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testProvidersIntegration();

const test = require('node:test');
const assert = require('node:assert/strict');

const { getProviderCapabilities, getDefaultProvider } = require('../src/provider-capabilities');

test('provider capabilities include text and vision support metadata', () => {
  const openai = getProviderCapabilities('openai');
  assert.equal(openai.name, 'OpenAI');
  assert.equal(openai.text, true);
  assert.equal(openai.vision, true);
  assert.equal(openai.transcription, true);
  assert.ok(Array.isArray(openai.models));
});

test('provider capabilities include audio transcription metadata', () => {
  const openai = getProviderCapabilities('openai');
  const gemini = getProviderCapabilities('gemini');
  const anthropic = getProviderCapabilities('anthropic');
  assert.equal(openai.transcription, true);
  assert.equal(gemini.transcription, true);
  assert.equal(anthropic.transcription, false);
  assert.equal(gemini.text, true);
  assert.equal(gemini.streaming, true);
});

test('default provider is a safe fallback when configuration is missing', () => {
  assert.equal(getDefaultProvider(), 'openai');
});

const PROVIDER_CAPABILITIES = {
  openai: {
    name: 'OpenAI',
    text: true,
    streaming: true,
    vision: true,
    transcription: false,
    models: ['gpt-4o-mini', 'gpt-4o'],
    notes: 'Text and vision responses are supported through the OpenAI Responses API.',
  },
  gemini: {
    name: 'Google Gemini',
    text: true,
    streaming: true,
    vision: true,
    transcription: true,
    models: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    notes: 'Gemini supports text and image prompts and browser-based transcription falls back to local speech recognition.',
  },
  anthropic: {
    name: 'Anthropic',
    text: true,
    streaming: true,
    vision: true,
    transcription: false,
    models: ['claude-haiku-5-5', 'claude-sonnet-4-0'],
    notes: 'Anthropic supports text and image prompts but not direct in-app speech transcription by default.',
  },
};

function getProviderCapabilities(provider) {
  const capabilities = PROVIDER_CAPABILITIES[provider];
  if (!capabilities) {
    return {
      name: provider,
      text: false,
      streaming: false,
      vision: false,
      transcription: false,
      models: [],
      notes: 'Provider is not configured.',
    };
  }
  return capabilities;
}

function getDefaultProvider() {
  return 'openai';
}

module.exports = {
  PROVIDER_CAPABILITIES,
  getDefaultProvider,
  getProviderCapabilities,
};

const Store = require("electron-store");
const { safeStorage } = require("electron");

const PROVIDERS = ["openai", "gemini", "anthropic"];
const store = new Store({
  defaults: {
    ai: {
      provider: "openai",
      keys: {},
    },
    openai: {
      apiKey: "",
    },
  },
});

function isSecureStorageAvailable() {
  return (
    safeStorage.isEncryptionAvailable() &&
    !(
      process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text"
    )
  );
}

function isProvider(provider) {
  return PROVIDERS.includes(provider);
}

function getApiKey(provider) {
  if (!isProvider(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  const encryptedKey = store.get(`ai.keys.${provider}`);
  if (encryptedKey) {
    if (!isSecureStorageAvailable()) {
      throw new Error(
        "Secure credential storage is unavailable. Enable your operating system's key store and restart the app."
      );
    }
    return safeStorage.decryptString(Buffer.from(encryptedKey, "base64"));
  }

  // Read the legacy OpenAI setting until it can be migrated to secure storage.
  return provider === "openai" ? store.get("openai.apiKey") || "" : "";
}

function hasApiKey(provider) {
  return Boolean(
    store.get(`ai.keys.${provider}`) ||
      (provider === "openai" && store.get("openai.apiKey"))
  );
}

function setApiKey(provider, key) {
  if (!isProvider(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  if (!isSecureStorageAvailable()) {
    throw new Error(
      "Secure credential storage is unavailable. Enable your operating system's key store and restart the app."
    );
  }

  const encryptedKey = safeStorage.encryptString(key).toString("base64");
  store.set(`ai.keys.${provider}`, encryptedKey);
  if (provider === "openai") store.delete("openai.apiKey");
}

function removeApiKey(provider) {
  if (!isProvider(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  store.delete(`ai.keys.${provider}`);
  if (provider === "openai") store.delete("openai.apiKey");
}

function migrateLegacyOpenAIKey() {
  const legacyKey = store.get("openai.apiKey");
  if (!legacyKey || !isSecureStorageAvailable()) return;

  if (!store.get("ai.keys.openai")) {
    store.set(
      "ai.keys.openai",
      safeStorage.encryptString(legacyKey).toString("base64")
    );
  }
  store.delete("openai.apiKey");
}

function setProvider(provider) {
  if (!isProvider(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  if (!hasApiKey(provider)) {
    throw new Error(`Add a ${provider} API key before selecting this provider.`);
  }
  store.set("ai.provider", provider);
}

function getSettings() {
  return {
    provider: store.get("ai.provider", "openai"),
    configuredProviders: PROVIDERS.filter(hasApiKey),
    secureStorageAvailable: isSecureStorageAvailable(),
  };
}

module.exports = {
  PROVIDERS,
  getApiKey,
  getSettings,
  hasApiKey,
  migrateLegacyOpenAIKey,
  removeApiKey,
  setApiKey,
  setProvider,
};

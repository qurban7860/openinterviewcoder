const PROVIDERS = ["openai", "gemini", "anthropic"];
const providerInput = document.getElementById("provider");
const saveButton = document.getElementById("saveButton");
const saveStatus = document.getElementById("save-status");
const pendingRemovals = new Set();

document.addEventListener("DOMContentLoaded", initializeSettings);

async function initializeSettings() {
  document.querySelectorAll(".reveal-key").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.input);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
    });
  });

  document.querySelectorAll(".remove-key").forEach((button) => {
    button.addEventListener("click", () => {
      const provider = button.dataset.provider;
      if (pendingRemovals.has(provider)) {
        pendingRemovals.delete(provider);
      } else {
        pendingRemovals.add(provider);
      }
      button.textContent = pendingRemovals.has(provider)
        ? "Undo removal"
        : "Remove saved key";
      updateProviderStatus(provider);
    });
  });

  PROVIDERS.forEach((provider) => {
    document
      .getElementById(`key-${provider}`)
      .addEventListener("input", () => {
        if (!document.getElementById(`key-${provider}`).value.trim()) return;
        pendingRemovals.delete(provider);
        const button = document.querySelector(
          `.remove-key[data-provider="${provider}"]`
        );
        button.textContent = "Remove saved key";
        updateProviderStatus(provider);
      });
  });

  saveButton.addEventListener("click", saveSettings);
  try {
    const settings = await window.electronAPI.getSettings();
    providerInput.value = settings.provider;
    if (!settings.secureStorageAvailable) {
      document.getElementById("storage-note").textContent =
        "A secure operating-system key store is not available. Existing legacy OpenAI settings can still be used, but API keys cannot be saved until secure storage is enabled.";
      setStatus(
        "Secure credential storage is unavailable. On Linux, enable a system keyring such as GNOME Keyring or KWallet before saving API keys.",
        true
      );
    }
    PROVIDERS.forEach((provider) => {
      const button = document.querySelector(
        `.remove-key[data-provider="${provider}"]`
      );
      button.disabled = !settings.configuredProviders.includes(provider);
      updateProviderStatus(provider, settings.configuredProviders);
    });
  } catch (error) {
    setStatus(`Couldn't load settings: ${error.message}`, true);
  }
}

function updateProviderStatus(provider, configuredProviders) {
  const input = document.getElementById(`key-${provider}`);
  const removeButton = document.querySelector(
    `.remove-key[data-provider="${provider}"]`
  );
  const isConfigured = configuredProviders
    ? configuredProviders.includes(provider)
    : !removeButton.disabled && !input.value.trim();
  const hasNewKey = Boolean(input.value.trim());
  const status = document.getElementById(`status-${provider}`);
  if (pendingRemovals.has(provider)) {
    status.textContent = "Will be removed";
  } else if (hasNewKey) {
    status.textContent = "Ready to save";
  } else {
    status.textContent = isConfigured
      ? "Key saved on this device"
      : "Not configured";
  }
  status.classList.toggle(
    "empty",
    (!isConfigured && !hasNewKey) || pendingRemovals.has(provider)
  );
  removeButton.disabled = !isConfigured && !pendingRemovals.has(provider);
}

async function saveSettings() {
  saveButton.disabled = true;
  setStatus("Saving securely...");
  const apiKeys = {};
  PROVIDERS.forEach((provider) => {
    const value = document.getElementById(`key-${provider}`).value.trim();
    if (value) apiKeys[provider] = value;
  });

  try {
    const settings = await window.electronAPI.saveSettings({
      provider: providerInput.value,
      apiKeys,
      removeKeys: Array.from(pendingRemovals),
    });
    pendingRemovals.clear();
    PROVIDERS.forEach((provider) => {
      document.getElementById(`key-${provider}`).value = "";
      const button = document.querySelector(
        `.remove-key[data-provider="${provider}"]`
      );
      button.textContent = "Remove saved key";
      button.disabled = !settings.configuredProviders.includes(provider);
      updateProviderStatus(provider, settings.configuredProviders);
    });
    setStatus("Settings saved.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    saveButton.disabled = false;
  }
}

function setStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle("error", isError);
}

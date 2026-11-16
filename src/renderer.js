const chatHistory = document.getElementById("chat-history");
const typingIndicator = document.getElementById("typing-indicator");
const questionInput = document.getElementById("question-input");
const questionForm = document.getElementById("question-form");
const micDeviceSelect = document.getElementById("mic-device-select");
const startListeningButton = document.getElementById("start-listening");
const stopListeningButton = document.getElementById("stop-listening");
const transcriptApplyButton = document.getElementById("transcript-apply-button");
const micStatus = document.getElementById("mic-status");
const sessionSelect = document.getElementById("session-select");
const newSessionButton = document.getElementById("new-session-button");
const sessionNameInput = document.getElementById("session-name-input");
const sessionRoleInput = document.getElementById("session-role-input");
const sessionCompanyInput = document.getElementById("session-company-input");
const sessionModeInput = document.getElementById("session-mode-input");
const sessionBackgroundInput = document.getElementById("session-background-input");
const sessionJobDescriptionInput = document.getElementById("session-job-description-input");
const saveSessionMetaButton = document.getElementById("save-session-meta");
const manualScreenshotUpload = document.getElementById("manual-screenshot-upload");

let messages = [];
let pendingRequests = 0;
const pendingMessageIds = new Set();
let speechRecognition = null;
let transcriptBuffer = "";
let listening = false;
let activeMicStream = null;
let activeSessionId = null;

if (typeof marked !== "undefined") {
  marked.setOptions({ breaks: true, gfm: true });
}

document.addEventListener("DOMContentLoaded", setupEventListeners);

function setupEventListeners() {
  document.querySelectorAll(".modifier-key").forEach((key) => {
    if (window.electronAPI.platform === "darwin") key.textContent = "⌘";
  });
  window.electronAPI.onWindowPositionChanged((position) => {
    document.body.setAttribute("data-position", position);
  });
  document.addEventListener("keydown", handleKeyboardShortcuts);
  window.electronAPI.onScreenshotCaptured(addScreenshotToChat);
  window.electronAPI.onAssistantQuestion((prompt) => {
    questionInput.value = prompt;
    questionForm.requestSubmit();
  });
  window.electronAPI.onResetChat(resetChat);
  window.electronAPI.onStreamUpdate(updateMessage);
  window.electronAPI.onSettingsUpdated(updateProviderBadge);
  window.electronAPI.onScrollChat((direction) => {
    const chatContainer = document.querySelector(".chat-container");
    if (chatContainer) {
      chatContainer.scrollTop += direction === "up" ? -100 : 100;
    }
  });
  questionForm.addEventListener("submit", handleQuestion);
  questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      questionForm.requestSubmit();
    }
  });
  document.getElementById("settings-button").addEventListener("click", () => {
    window.electronAPI.showSettings();
  });
  document.getElementById("hide-button").addEventListener("click", () => {
    window.electronAPI.hideWindow();
  });
  document.getElementById("quit-button").addEventListener("click", () => {
    window.electronAPI.quitApp();
  });
  document.getElementById("clear-chat-button").addEventListener("click", () => {
    resetChat();
  });
  startListeningButton.addEventListener("click", startListening);
  stopListeningButton.addEventListener("click", stopListening);
  transcriptApplyButton.addEventListener("click", () => {
    const transcript = transcriptBuffer.trim();
    if (!transcript) {
      addErrorMessage("No microphone transcript is ready to send yet.");
      return;
    }
    questionInput.value = transcript;
    questionForm.requestSubmit();
    transcriptBuffer = "";
    updateMicStatus("Transcript sent");
  });

  newSessionButton.addEventListener("click", createSessionFromUI);
  saveSessionMetaButton.addEventListener("click", saveSessionMeta);
  manualScreenshotUpload.addEventListener("change", handleManualScreenshotUpload);
  sessionSelect.addEventListener("change", async (event) => {
    const selectedId = event.target.value;
    if (!selectedId) return;
    const session = await window.electronAPI.setActiveSession(selectedId);
    activeSessionId = session && session.id ? session.id : null;
    syncSessionForm();
    renderSessionMessages();
  });
  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      questionInput.value = button.dataset.question;
      questionForm.requestSubmit();
    });
  });
  populateMicrophoneDevices();
  await hydrateSessions();
  window.electronAPI.getSettings().then(updateProviderBadge).catch((error) => {
    addErrorMessage(`Couldn't load provider settings: ${error.message}`);
  });
}

async function hydrateSessions() {
  const sessions = await window.electronAPI.listSessions();
  if (!sessions || !sessions.length) {
    const session = await window.electronAPI.createSession({
      name: 'New Interview Session',
      interviewType: 'general',
      mode: 'general',
    });
    activeSessionId = session.id;
    renderSessionOptions();
    return;
  }

  activeSessionId = sessions.find((entry) => entry.active)?.id || sessions[0].id;
  renderSessionOptions(sessions);
}

function renderSessionOptions(sessions = []) {
  const items = sessions.length ? sessions : [{ id: activeSessionId, name: 'Current session', active: true }];
  sessionSelect.innerHTML = items.map((session) => (
    `<option value="${session.id}" ${session.id === activeSessionId ? 'selected' : ''}>${session.name}</option>`
  )).join('');
}

function syncSessionForm() {
  if (!activeSessionId) return;
  const currentSession = window.electronAPI.getActiveSession ? window.electronAPI.getActiveSession() : null;
  if (!currentSession) return;
  sessionNameInput.value = currentSession.name || '';
  sessionRoleInput.value = currentSession.role || '';
  sessionCompanyInput.value = currentSession.company || '';
  sessionModeInput.value = currentSession.mode || 'general';
  sessionBackgroundInput.value = currentSession.background || currentSession.description || '';
  sessionJobDescriptionInput.value = currentSession.jobDescription || '';
}

async function saveSessionMeta() {
  if (!activeSessionId) return;
  const updates = {
    name: sessionNameInput.value.trim(),
    role: sessionRoleInput.value.trim(),
    company: sessionCompanyInput.value.trim(),
    mode: sessionModeInput.value,
    background: sessionBackgroundInput.value.trim(),
    jobDescription: sessionJobDescriptionInput.value.trim(),
  };

  const updatedSession = await window.electronAPI.updateSessionMeta(activeSessionId, updates);
  if (!updatedSession) return;
  const sessions = await window.electronAPI.listSessions();
  renderSessionOptions(sessions);
  syncSessionForm();
}

async function createSessionFromUI() {
  const session = await window.electronAPI.createSession({
    name: `Interview ${Date.now().toString().slice(-5)}`,
    interviewType: 'general',
    mode: 'general',
  });
  activeSessionId = session.id;
  const sessions = await window.electronAPI.listSessions();
  renderSessionOptions(sessions);
  syncSessionForm();
  resetChat();
}

async function handleManualScreenshotUpload(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  const buffer = await file.arrayBuffer();
  const savedPath = await window.electronAPI.saveUploadedScreenshot({
    fileName: file.name,
    buffer: Buffer.from(buffer),
  });

  const screenshotMessage = {
    type: 'screenshot',
    timestamp: Date.now(),
    filePath: savedPath,
  };

  messages.push(screenshotMessage);
  const screenshotEl = document.createElement('div');
  screenshotEl.className = 'message user';
  const image = document.createElement('img');
  image.src = window.electronAPI.toFileUrl(savedPath);
  image.className = 'screenshot-thumbnail';
  image.alt = 'Uploaded screenshot';
  image.addEventListener('click', () => window.electronAPI.openFile(savedPath));
  screenshotEl.appendChild(image);
  chatHistory.appendChild(screenshotEl);

  const assistantMessage = createPendingAssistantMessage();
  const history = getConversationHistory();
  const activeSession = await window.electronAPI.getActiveSession();
  setRequestPending(true);
  try {
    const result = await window.electronAPI.analyzeScreenshot({
      filePath: savedPath,
      history,
      messageId: assistantMessage.messageId,
      session: activeSession || null,
    });
    updateMessage({
      messageId: result.messageId,
      content: result.content,
      isComplete: true,
    });
  } catch (error) {
    removePendingAssistantMessage(assistantMessage);
    addErrorMessage(error.message);
  } finally {
    setRequestPending(false);
    event.target.value = '';
  }
  scrollToBottom();
}

function renderSessionMessages() {
  if (!activeSessionId) return;
  const currentSession = window.electronAPI.getActiveSession ? window.electronAPI.getActiveSession() : null;
  if (!currentSession || !Array.isArray(currentSession.messages)) {
    resetChat();
    return;
  }
  messages = currentSession.messages;
  chatHistory.replaceChildren();
  for (const message of messages) {
    const bubble = document.createElement('div');
    bubble.className = message.type === 'assistant' ? 'message assistant' : 'message user';
    bubble.textContent = message.content;
    chatHistory.appendChild(bubble);
  }
  updateNullStateVisibility();
  scrollToBottom();
}

async function populateMicrophoneDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    updateMicStatus("Microphone access unavailable in this browser");
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((device) => device.kind === "audioinput");
    if (!audioInputs.length) {
      micDeviceSelect.innerHTML = '<option value="">No microphone detected</option>';
      updateMicStatus("No microphone detected");
      return;
    }

    micDeviceSelect.innerHTML = audioInputs
      .map(
        (device, index) =>
          `<option value="${device.deviceId || index}">${device.label || `Microphone ${index + 1}`}</option>`
      )
      .join("");
    updateMicStatus("Microphone ready");
  } catch (error) {
    updateMicStatus("Microphone access unavailable");
    console.error("Unable to enumerate microphone devices:", error);
  }
}

function updateMicStatus(message) {
  if (!micStatus) return;
  micStatus.textContent = message;
  micStatus.style.color = listening ? "#8be0b7" : "#8a96ad";
}

async function startListening() {
  const SpeechRecognitionAPI =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) {
    updateMicStatus("Speech recognition is not supported in this browser");
    addErrorMessage("Speech recognition is not available in this environment. You can still type your question manually.");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    addErrorMessage("Microphone access is not available. Check your browser or OS permission settings.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: micDeviceSelect.value ? { exact: micDeviceSelect.value } : undefined,
      },
    });
    activeMicStream = stream;
    listening = true;
    transcriptBuffer = questionInput.value.trim();
    updateMicStatus("Listening…");

    if (speechRecognition) {
      try {
        speechRecognition.stop();
      } catch (error) {
        // Recognition may already be stopped.
      }
    }

    speechRecognition = new SpeechRecognitionAPI();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = "en-US";

    speechRecognition.onresult = (event) => {
      let latestTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const resultItem = event.results[index];
        latestTranscript += resultItem[0].transcript;
        if (resultItem.isFinal) {
          transcriptBuffer = `${transcriptBuffer} ${latestTranscript}`.trim();
          questionInput.value = transcriptBuffer;
          updateMicStatus("Transcript ready");
        }
      }
      if (!latestTranscript.trim()) return;
      questionInput.value = `${transcriptBuffer} ${latestTranscript}`.trim();
    };

    speechRecognition.onerror = (event) => {
      const detail = event.error || "speech recognition failed";
      updateMicStatus(`Microphone error: ${detail}`);
      if (detail === "not-allowed" || detail === "service-not-allowed") {
        addErrorMessage("Microphone permission was denied. Allow microphone access in your OS/browser settings and try again.");
      }
    };

    speechRecognition.onend = () => {
      if (!listening) return;
      try {
        speechRecognition.start();
      } catch (error) {
        updateMicStatus("Microphone listener restarted");
      }
    };

    speechRecognition.start();
  } catch (error) {
    listening = false;
    if (activeMicStream) {
      activeMicStream.getTracks().forEach((track) => track.stop());
      activeMicStream = null;
    }
    updateMicStatus("Microphone permission denied");
    addErrorMessage(`Microphone access failed: ${error.message}`);
  }
}

function stopListening() {
  listening = false;
  if (speechRecognition) {
    try {
      speechRecognition.stop();
    } catch (error) {
      // Ignore stop errors while the recognition engine is already closing.
    }
  }
  if (activeMicStream) {
    activeMicStream.getTracks().forEach((track) => track.stop());
    activeMicStream = null;
  }
  updateMicStatus("Microphone off");
}

function updateProviderBadge(settings) {
  const providerNames = {
    openai: "OpenAI",
    gemini: "Gemini",
    anthropic: "Anthropic",
  };
  const badge = document.getElementById("provider-badge");
  badge.textContent = providerNames[settings.provider] || "AI assistant";
  badge.title = settings.configuredProviders.includes(settings.provider)
    ? `${badge.textContent} is ready`
    : "Add an API key in settings to get started";
  badge.classList.toggle(
    "provider-unconfigured",
    !settings.configuredProviders.includes(settings.provider)
  );
}

function handleKeyboardShortcuts(event) {
  if (event.key === "Escape") {
    window.electronAPI.hideWindow();
  }
  if (
    (event.metaKey || event.ctrlKey) &&
    event.shiftKey &&
    event.key.toLowerCase() === "t"
  ) {
    event.preventDefault();
    questionInput.value = "Write Python code to print 'Hello, world!'";
    questionForm.requestSubmit();
  }
}

function getConversationHistory() {
  return messages
    .filter(
      (message) =>
        (message.type === "user" || message.type === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-10)
    .map(({ type, content }) => ({
      role: type === "assistant" ? "assistant" : "user",
      content,
    }));
}

function setRequestPending(pending) {
  pendingRequests += pending ? 1 : -1;
  pendingRequests = Math.max(0, pendingRequests);
  typingIndicator.classList.toggle("visible", pendingRequests > 0);
  questionInput.disabled = pendingRequests > 0;
  document.getElementById("send-button").disabled = pendingRequests > 0;
}

function scrollToBottom() {
  const chatContainer = document.querySelector(".chat-container");
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

function updateMessage(data) {
  if (!data || typeof data.messageId !== "string") return;
  let messageEl = document.querySelector(
    `[data-message-id="${CSS.escape(data.messageId)}"]`
  );
  if (!messageEl) {
    if (!pendingMessageIds.has(data.messageId)) return;
    messageEl = createMessageElement(data.messageId);
    chatHistory.appendChild(messageEl);
  }

  const contentWrapper = messageEl.querySelector(".message-content");
  if (contentWrapper && typeof data.content === "string") {
    renderMessageContent(contentWrapper, data.content);
  }
  if (data.isComplete) {
    pendingMessageIds.delete(data.messageId);
    const message = messages.find(
      (item) => item.messageId === data.messageId
    );
    if (message) {
      message.content = data.content;
      message.status = "completed";
    }
  }
  updateNullStateVisibility();
  scrollToBottom();
}

function renderMessageContent(wrapper, content) {
  if (typeof marked === "undefined") {
    wrapper.textContent = content;
    return;
  }

  const parsed = new DOMParser().parseFromString(
    marked.parse(content),
    "text/html"
  );
  const allowedTags = new Set([
    "A",
    "BLOCKQUOTE",
    "BR",
    "CODE",
    "DEL",
    "EM",
    "H1",
    "H2",
    "H3",
    "H4",
    "HR",
    "LI",
    "OL",
    "P",
    "PRE",
    "STRONG",
    "UL",
  ]);
  const appendSafeNodes = (source, target) => {
    for (const node of source.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(node.textContent));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(node.tagName)) {
          appendSafeNodes(node, target);
          continue;
        }
        const safeElement = document.createElement(node.tagName.toLowerCase());
        if (node.tagName === "A") {
          try {
            const url = new URL(node.getAttribute("href"), location.href);
            if (["http:", "https:", "mailto:"].includes(url.protocol)) {
              safeElement.setAttribute("href", url.href);
              safeElement.setAttribute("rel", "noopener noreferrer");
            }
          } catch {
            // Invalid links remain plain text.
          }
        }
        appendSafeNodes(node, safeElement);
        target.appendChild(safeElement);
      }
    }
  };

  wrapper.replaceChildren();
  appendSafeNodes(parsed.body, wrapper);
}

function createMessageElement(messageId) {
  const messageEl = document.createElement("div");
  messageEl.className = "message assistant";
  messageEl.dataset.messageId = messageId;

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "message-content markdown-body";
  messageEl.appendChild(contentWrapper);
  return messageEl;
}

function addErrorMessage(message) {
  const errorEl = document.createElement("div");
  errorEl.className = "message error";
  errorEl.textContent = `Error: ${message}`;
  chatHistory.appendChild(errorEl);
  scrollToBottom();
}

async function addScreenshotToChat(data) {
  const screenshotMessage = {
    type: "screenshot",
    timestamp: Date.now(),
    filePath: data.filePath,
  };
  messages.push(screenshotMessage);

  const screenshotEl = document.createElement("div");
  screenshotEl.className = "message user";
  const image = document.createElement("img");
  image.src = window.electronAPI.toFileUrl(data.filePath);
  image.className = "screenshot-thumbnail";
  image.alt = "Captured screenshot";
  image.addEventListener("click", () =>
    window.electronAPI.openFile(data.filePath)
  );
  screenshotEl.appendChild(image);
  chatHistory.appendChild(screenshotEl);

  const assistantMessage = createPendingAssistantMessage();
  const history = getConversationHistory();
  const activeSession = await window.electronAPI.getActiveSession();
  setRequestPending(true);
  try {
    const result = await window.electronAPI.analyzeScreenshot({
      filePath: data.filePath,
      history,
      messageId: assistantMessage.messageId,
      session: activeSession || null,
    });
    updateMessage({
      messageId: result.messageId,
      content: result.content,
      isComplete: true,
    });
  } catch (error) {
    removePendingAssistantMessage(assistantMessage);
    addErrorMessage(error.message);
  } finally {
    setRequestPending(false);
  }
  scrollToBottom();
}

function createPendingAssistantMessage() {
  const messageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const message = {
    type: "assistant",
    timestamp: Date.now(),
    messageId,
    content: "",
    status: "pending",
  };
  messages.push(message);
  pendingMessageIds.add(messageId);
  chatHistory.appendChild(createMessageElement(messageId));
  updateNullStateVisibility();
  return message;
}

function removePendingAssistantMessage(message) {
  messages = messages.filter((item) => item !== message);
  pendingMessageIds.delete(message.messageId);
  const element = document.querySelector(
    `[data-message-id="${CSS.escape(message.messageId)}"]`
  );
  if (element) element.remove();
  updateNullStateVisibility();
}

async function handleQuestion(event) {
  event.preventDefault();
  const prompt = questionInput.value.trim();
  if (!prompt || pendingRequests > 0) return;

  questionInput.value = "";
  const userMessage = {
    type: "user",
    timestamp: Date.now(),
    content: prompt,
  };
  messages.push(userMessage);
  const userMessageEl = document.createElement("div");
  userMessageEl.className = "message user";
  userMessageEl.textContent = prompt;
  chatHistory.appendChild(userMessageEl);

  const assistantMessage = createPendingAssistantMessage();
  const history = getConversationHistory().slice(0, -1);
  const activeSession = await window.electronAPI.getActiveSession();
  setRequestPending(true);
  scrollToBottom();
  try {
    const result = await window.electronAPI.testResponse({
      prompt,
      history,
      messageId: assistantMessage.messageId,
      session: activeSession || null,
    });
    updateMessage({
      messageId: result.messageId,
      content: result.content,
      isComplete: true,
    });
  } catch (error) {
    removePendingAssistantMessage(assistantMessage);
    addErrorMessage(error.message);
  } finally {
    setRequestPending(false);
  }
}

function resetChat() {
  chatHistory.replaceChildren();
  messages = [];
  pendingMessageIds.clear();
  updateNullStateVisibility();
}

function updateNullStateVisibility() {
  const nullState = document.getElementById("null-state");
  if (nullState) {
    nullState.classList.toggle("is-hidden", messages.length !== 0);
  }
}

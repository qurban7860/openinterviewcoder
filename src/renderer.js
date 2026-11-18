const chatHistory = document.getElementById("chat-history");
const typingIndicator = document.getElementById("typing-indicator");
const questionInput = document.getElementById("question-input");
const questionForm = document.getElementById("question-form");
const startListeningButton = document.getElementById("start-listening");
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
let listening = false;
let activeMicStream = null;
let activeSessionId = null;
let mediaRecorder = null;
let audioChunks = [];
let audioBytesRecorded = 0;
let audioLimitExceeded = false;
let recordingDraft = "";

if (typeof marked !== "undefined") {
  marked.setOptions({ breaks: true, gfm: true });
}

document.addEventListener("DOMContentLoaded", setupEventListeners);

async function setupEventListeners() {
  setMicrophoneButtonState();
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
  startListeningButton.addEventListener("click", () => {
    if (listening) stopListening();
    else startListening();
  });

  newSessionButton.addEventListener("click", createSessionFromUI);
  saveSessionMetaButton.addEventListener("click", saveSessionMeta);
  manualScreenshotUpload.addEventListener("change", handleManualScreenshotUpload);
  sessionSelect.addEventListener("change", async (event) => {
    const selectedId = event.target.value;
    if (!selectedId) return;
    const session = await window.electronAPI.setActiveSession(selectedId);
    activeSessionId = session && session.id ? session.id : null;
    await syncSessionForm(session);
    await renderSessionMessages(session);
  });
  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      questionInput.value = button.dataset.question;
      questionForm.requestSubmit();
    });
  });
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
    await syncSessionForm(session);
    return;
  }

  activeSessionId = sessions.find((entry) => entry.active)?.id || sessions[0].id;
  renderSessionOptions(sessions);
  await syncSessionForm();
}

function renderSessionOptions(sessions = []) {
  const items = sessions.length ? sessions : [{ id: activeSessionId, name: 'Current session', active: true }];
  sessionSelect.replaceChildren();
  for (const session of items) {
    const option = document.createElement('option');
    option.value = session.id;
    option.textContent = session.name || 'Interview session';
    option.selected = session.id === activeSessionId;
    sessionSelect.appendChild(option);
  }
}

function renderSuggestions(session = {}) {
  const suggestionsContainer = document.querySelector('.suggestions');
  if (!suggestionsContainer) return;
  const values = {
    mode: session.mode || sessionModeInput.value || 'general',
    role: session.role || sessionRoleInput.value || '',
    company: session.company || sessionCompanyInput.value || '',
    background: session.background || session.description || sessionBackgroundInput.value || '',
    jobDescription: session.jobDescription || sessionJobDescriptionInput.value || '',
  };

  const defaultSuggestions = [
    'Explain this concept with a simple example.',
    'Help me solve this coding problem. Ask any essential clarifying questions, then explain the approach and complexity.',
    'Review this code for bugs and suggest a clearer or more efficient solution.',
  ];

  const modeSuggestions = {
    'coding-interview': [
      `Clarify the requirements for this coding problem and explain your approach before writing code for ${values.role || 'this role'}.`,
      'What edge cases or performance constraints should we discuss for this implementation?',
      'How would you test this solution and explain the complexity trade-offs?',
    ],
    'system-design': [
      `Design the core architecture for a system that supports ${values.jobDescription || 'the key requirements'} with clear scalability and reliability trade-offs.`,
      'What are the most important components, APIs, and failure modes in this design?',
      'How would you observe, test, and evolve this architecture as traffic and requirements grow?',
    ],
    behavioral: [
      `Tell me about a time when ${values.background || 'your recent experience'} influenced a decision you made in a team setting.`,
      'Describe a conflict or trade-off you handled well and how you measured success.',
      'How do you adapt your communication style when working across teams with different priorities?',
    ],
    'project-discussion': [
      `Walk me through a project where ${values.background || 'your recent experience'} shaped the final design and delivery plan.`,
      'What trade-offs did you make in this project, and what would you do differently now?',
      'How did you validate success and learn from the risks or bottlenecks in this work?',
    ],
  };
  const suggestionTitles = {
    general: ['Explain a concept', 'Work through a problem', 'Review code'],
    'coding-interview': ['Clarify constraints', 'Explore edge cases', 'Test the approach'],
    'system-design': ['Sketch the architecture', 'Map components and failures', 'Plan for scale'],
    behavioral: ['Build a STAR answer', 'Discuss a hard trade-off', 'Show collaboration'],
    'project-discussion': ['Tell the project story', 'Explain the trade-offs', 'Reflect on impact'],
  };

  const list = modeSuggestions[values.mode] || defaultSuggestions;
  const titles = suggestionTitles[values.mode] || suggestionTitles.general;
  suggestionsContainer.replaceChildren();
  list.forEach((question, index) => {
    const button = document.createElement('button');
    button.className = 'suggestion';
    button.type = 'button';
    button.dataset.question = question;
    button.title = question;
    const copy = document.createElement('span');
    copy.className = 'suggestion-copy';
    const title = document.createElement('span');
    title.className = 'suggestion-title';
    title.textContent = titles[index] || 'Practice question';
    const detail = document.createElement('span');
    detail.className = 'suggestion-detail';
    detail.textContent = question.length > 116 ? `${question.slice(0, 113)}...` : question;
    copy.append(title, detail);
    const arrow = document.createElement('span');
    arrow.className = 'suggestion-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    button.append(copy, arrow);
    button.addEventListener('click', () => {
      questionInput.value = button.dataset.question;
      questionForm.requestSubmit();
    });
    suggestionsContainer.appendChild(button);
  });
}

function renderFocusAreas(session = {}) {
  const focusAreas = document.getElementById('focus-areas');
  if (!focusAreas) return;

  const values = {
    mode: session.mode || sessionModeInput.value || 'general',
    role: session.role || sessionRoleInput.value || '',
    company: session.company || sessionCompanyInput.value || '',
    background: session.background || session.description || sessionBackgroundInput.value || '',
    jobDescription: session.jobDescription || sessionJobDescriptionInput.value || '',
  };

  const hasContext = Boolean(values.role || values.company || values.background || values.jobDescription);
  focusAreas.hidden = !hasContext;
  if (!hasContext) return;

  const brief = window.electronAPI.buildInterviewBrief(values);
  focusAreas.replaceChildren();
  const appendSection = (title, items) => {
    const heading = document.createElement('div');
    heading.className = 'focus-areas-title';
    heading.textContent = title;
    focusAreas.appendChild(heading);
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'focus-area-item';
      row.textContent = item;
      focusAreas.appendChild(row);
    }
  };
  appendSection('Readiness brief', [brief.readinessSummary]);
  appendSection('Focus areas', brief.focusAreas);
  appendSection('Checklist', brief.checklist);
}

async function syncSessionForm(session = null) {
  if (!activeSessionId) return;
  const currentSession = session || await window.electronAPI.getActiveSession();
  if (!currentSession) return;
  sessionNameInput.value = currentSession.name || '';
  sessionRoleInput.value = currentSession.role || '';
  sessionCompanyInput.value = currentSession.company || '';
  sessionModeInput.value = currentSession.mode || 'general';
  sessionBackgroundInput.value = currentSession.background || currentSession.description || '';
  sessionJobDescriptionInput.value = currentSession.jobDescription || '';
  const summary = document.getElementById('session-details-summary');
  if (summary) {
    const contextLabel = [currentSession.role, currentSession.company].filter(Boolean).join(' · ');
    summary.textContent = contextLabel ? `Interview details · ${contextLabel}` : 'Interview details · Add role context';
  }
  renderSuggestions(currentSession);
  renderFocusAreas(currentSession);
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
  await syncSessionForm(updatedSession);
  document.getElementById('session-config-panel').open = false;
}

async function createSessionFromUI() {
  const createdSession = await window.electronAPI.createSession({
    name: `Interview ${Date.now().toString().slice(-5)}`,
    interviewType: 'general',
    mode: 'general',
  });
  const session = await window.electronAPI.setActiveSession(createdSession.id);
  activeSessionId = session.id;
  const sessions = await window.electronAPI.listSessions();
  renderSessionOptions(sessions);
  await syncSessionForm(session);
  document.getElementById('session-config-panel').open = true;
  resetChat();
}

async function handleManualScreenshotUpload(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    addErrorMessage('Choose an image file to analyze.');
    event.target.value = '';
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    addErrorMessage('Choose an image smaller than 20 MB.');
    event.target.value = '';
    return;
  }

  let assistantMessage = null;
  let requestStarted = false;
  try {
    const savedPath = await window.electronAPI.saveUploadedScreenshot({
      fileName: file.name,
      buffer: new Uint8Array(await file.arrayBuffer()),
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

    assistantMessage = createPendingAssistantMessage();
    const history = getConversationHistory();
    const activeSession = await window.electronAPI.getActiveSession();
    setRequestPending(true);
    requestStarted = true;
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
    if (assistantMessage) removePendingAssistantMessage(assistantMessage);
    addErrorMessage(error.message);
  } finally {
    if (requestStarted) setRequestPending(false);
    event.target.value = '';
  }
  scrollToBottom();
}

async function renderSessionMessages(session = null) {
  if (!activeSessionId) return;
  const currentSession = session || await window.electronAPI.getActiveSession();
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

function updateMicStatus(message, state = "") {
  if (!micStatus) return;
  micStatus.textContent = message;
  micStatus.dataset.state = state || (listening ? "ready" : "");
}

function setMicrophoneButtonState({ recording = false, disabled = false } = {}) {
  startListeningButton.classList.toggle("is-recording", recording);
  startListeningButton.setAttribute("aria-pressed", String(recording));
  startListeningButton.setAttribute(
    "aria-label",
    recording ? "Stop recording" : "Start recording"
  );
  startListeningButton.title = recording
    ? "Stop recording and transcribe"
    : "Record a spoken question";
  startListeningButton.disabled = disabled;
}

async function startListening() {
  if (listening) return;
  if (!window.MediaRecorder) {
    updateMicStatus("Audio recording is not supported", "error");
    addErrorMessage("This app cannot record audio in the current environment. You can still type your question.");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    updateMicStatus("Microphone capture is unavailable", "error");
    addErrorMessage("Microphone access is not available. Check your browser or OS permission settings.");
    return;
  }

  setMicrophoneButtonState({ disabled: true });
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    listening = false;
    setMicrophoneButtonState();
    const message = await window.electronAPI.getMicrophoneErrorMessage(error.name);
    updateMicStatus(message, "error");
    addErrorMessage(message);
    return;
  }

  activeMicStream = stream;
  audioChunks = [];
  audioBytesRecorded = 0;
  audioLimitExceeded = false;
  recordingDraft = questionInput.value.trim();
  const mimeType = typeof MediaRecorder.isTypeSupported === "function"
    ? [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate))
    : undefined;

  try {
    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    activeMicStream = null;
    setMicrophoneButtonState();
    updateMicStatus("Could not start microphone recording", "error");
    addErrorMessage(`Microphone recording failed: ${error.message}`);
    return;
  }

  listening = true;
  setMicrophoneButtonState({ recording: true });
  updateMicStatus("Recording… click the microphone again to transcribe", "ready");
  mediaRecorder.ondataavailable = (event) => {
    if (!event.data || event.data.size === 0) return;
    audioBytesRecorded += event.data.size;
    if (audioBytesRecorded > 20 * 1024 * 1024) {
      audioLimitExceeded = true;
      stopListening();
      return;
    }
    audioChunks.push(event.data);
  };
  mediaRecorder.onerror = (event) => {
    stopRecordingTracks();
    listening = false;
    setMicrophoneButtonState();
    updateMicStatus("Audio recording failed", "error");
    addErrorMessage(`Audio recording failed: ${event.error?.message || "unknown recorder error"}`);
  };
  mediaRecorder.onstop = transcribeRecording;
  for (const track of stream.getAudioTracks()) {
    track.addEventListener("ended", () => {
      if (!listening) return;
      stopListening();
      addErrorMessage("The microphone was disconnected while recording.");
    }, { once: true });
  }
  try {
    mediaRecorder.start(250);
  } catch (error) {
    stopRecordingTracks();
    listening = false;
    setMicrophoneButtonState();
    updateMicStatus("Could not start microphone recording", "error");
    addErrorMessage(`Microphone recording failed: ${error.message}`);
  }
}

function stopListening() {
  if (!mediaRecorder || mediaRecorder.state !== "recording") return;
  listening = false;
  setMicrophoneButtonState({ disabled: true });
  updateMicStatus("Preparing audio for transcription…", "ready");
  try {
    mediaRecorder.stop();
  } catch (error) {
    stopRecordingTracks();
    setMicrophoneButtonState();
    updateMicStatus("Could not stop microphone recording", "error");
    addErrorMessage(`Could not finish the microphone recording: ${error.message}`);
  }
}

async function transcribeRecording() {
  listening = false;
  setMicrophoneButtonState({ disabled: true });
  stopRecordingTracks();
  const mimeType = mediaRecorder?.mimeType || audioChunks[0]?.type || "audio/webm";
  const blob = new Blob(audioChunks, { type: mimeType });
  audioChunks = [];

  if (audioLimitExceeded) {
    audioLimitExceeded = false;
    setMicrophoneButtonState();
    updateMicStatus("Recording is too large", "error");
    addErrorMessage("Audio recordings must be smaller than 20 MB. Record a shorter clip and retry.");
    return;
  }

  if (!blob.size) {
    setMicrophoneButtonState();
    updateMicStatus("No audio captured", "error");
    addErrorMessage("No audio was captured. Check the selected microphone and try again.");
    return;
  }

  if (blob.size > 20 * 1024 * 1024) {
    setMicrophoneButtonState();
    updateMicStatus("Recording is too large", "error");
    addErrorMessage("Audio recordings must be smaller than 20 MB. Record a shorter clip and retry.");
    return;
  }

  updateMicStatus("Transcribing audio…", "ready");
  setRequestPending(true);
  try {
    const result = await window.electronAPI.transcribeAudio({
      audio: new Uint8Array(await blob.arrayBuffer()),
      mimeType: blob.type || mimeType,
    });
    const transcript = result.transcript.trim();
    questionInput.value = [recordingDraft, transcript].filter(Boolean).join(" ");
    questionInput.focus();
    updateMicStatus(
      transcript ? `Transcript ready · ${result.provider} · review, then Send` : "No speech detected",
      transcript ? "ready" : "error"
    );
    if (!transcript) {
      addErrorMessage("No speech was detected. Try a longer recording or check your microphone input level.");
    }
  } catch (error) {
    updateMicStatus("Transcription failed", "error");
    addErrorMessage(error.message);
  } finally {
    setMicrophoneButtonState();
    setRequestPending(false);
  }
}

function stopRecordingTracks() {
  if (activeMicStream) {
    activeMicStream.getTracks().forEach((track) => track.stop());
    activeMicStream = null;
  }
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

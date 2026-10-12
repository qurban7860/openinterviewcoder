const chatHistory = document.getElementById("chat-history");
const typingIndicator = document.getElementById("typing-indicator");
const questionInput = document.getElementById("question-input");
const questionForm = document.getElementById("question-form");

let messages = [];
let pendingRequests = 0;
const pendingMessageIds = new Set();

if (typeof marked !== "undefined") {
  marked.setOptions({ breaks: true, gfm: true });
}

document.addEventListener("DOMContentLoaded", setupEventListeners);

function setupEventListeners() {
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
  window.electronAPI.onScrollChat((direction) => {
    const chatContainer = document.querySelector(".chat-container");
    if (chatContainer) {
      chatContainer.scrollTop += direction === "up" ? -100 : 100;
    }
  });
  questionForm.addEventListener("submit", handleQuestion);
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
  questionForm.querySelector("button").disabled = pendingRequests > 0;
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
    messageEl.style.display = "block";
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
  setRequestPending(true);
  try {
    const result = await window.electronAPI.analyzeScreenshot({
      filePath: data.filePath,
      history,
      messageId: assistantMessage.messageId,
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
  setRequestPending(true);
  scrollToBottom();
  try {
    const result = await window.electronAPI.testResponse({
      prompt,
      history,
      messageId: assistantMessage.messageId,
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
    nullState.style.display = messages.length === 0 ? "flex" : "none";
  }
}

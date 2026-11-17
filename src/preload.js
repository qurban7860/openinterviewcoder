const { contextBridge, ipcRenderer, shell } = require("electron");
const { pathToFileURL } = require("url");
const interviewOrchestration = require("./interview-orchestration");
const microphoneErrors = require("./microphone-errors");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  // Get settings
  getSettings: () => ipcRenderer.invoke("get-settings"),

  // Save settings
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),

  // Show settings window
  showSettings: () => ipcRenderer.invoke("show-settings"),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("minimize-window"),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  quitApp: () => ipcRenderer.invoke("quit-app"),

  // Context menu
  buildContextMenu: () => ipcRenderer.invoke("build-context-menu"),

  // Screenshot handling
  onScreenshotCaptured: (callback) =>
    ipcRenderer.on("screenshot-captured", (event, value) => callback(value)),
  onAssistantQuestion: (callback) =>
    ipcRenderer.on("assistant-question", (event, value) => callback(value)),
  onSettingsUpdated: (callback) =>
    ipcRenderer.on("settings-updated", (event, value) => callback(value)),
  analyzeScreenshot: (data) => ipcRenderer.invoke("analyze-screenshot", data),
  onStreamUpdate: (callback) =>
    ipcRenderer.on("stream-update", (event, value) => callback(value)),
  getScreenshotsDirectory: () =>
    ipcRenderer.invoke("get-screenshots-directory"),
  getRecentScreenshots: () => ipcRenderer.invoke("get-recent-screenshots"),
  saveUploadedScreenshot: (payload) =>
    ipcRenderer.invoke("save-uploaded-screenshot", payload),

  // Test response
  testResponse: (prompt) => ipcRenderer.invoke("test-response", prompt),

  // File handling
  openFile: (path) => shell.openPath(path),
  toFileUrl: (path) => pathToFileURL(path).href,

  // Chat reset
  onResetChat: (callback) =>
    ipcRenderer.on("reset-chat", (event) => callback()),

  createSession: (payload) => ipcRenderer.invoke("create-session", payload),
  listSessions: () => ipcRenderer.invoke("list-sessions"),
  setActiveSession: (sessionId) => ipcRenderer.invoke("set-active-session", sessionId),
  getActiveSession: () => ipcRenderer.invoke("get-active-session"),
  updateSessionMeta: (sessionId, updates) => ipcRenderer.invoke("update-session-meta", sessionId, updates),
  buildInterviewBrief: (values) => ({
    suggestions: interviewOrchestration.buildInterviewSuggestions(values),
    focusAreas: interviewOrchestration.buildInterviewFocusAreas(values),
    readinessSummary: interviewOrchestration.buildInterviewReadinessSummary(values),
    checklist: interviewOrchestration.buildInterviewChecklist(values),
  }),
  getMicrophoneErrorMessage: microphoneErrors.getMicrophoneErrorMessage,
  getSpeechRecognitionErrorMessage: microphoneErrors.getSpeechRecognitionErrorMessage,

  // Window position
  onWindowPositionChanged: (callback) =>
    ipcRenderer.on("window-position-changed", (event, value) =>
      callback(value)
    ),
  updatePosition: (position) => ipcRenderer.invoke("update-position", position),

  // Scroll chat
  onScrollChat: (callback) =>
    ipcRenderer.on("scroll-chat", (event, direction) => callback(direction)),

  // Click-through mode
  onToggleMouseIgnore: (callback) =>
    ipcRenderer.on("toggle-mouse-ignore", (event, value) => callback(value)),
});

// No need for additional electron context bridge since we're handling everything through electronAPI

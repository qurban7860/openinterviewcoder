require("dotenv").config();
const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  desktopCapturer,
  Menu,
  Tray,
} = require("electron");
const path = require("path");
const {
  ensureScreenRecordingPermission,
  captureFullScreen,
  getRecentScreenshots,
} = require("./screenshot");
const { initializeLLMService } = require("./llm-service");
const config = require("./config");

// IPC handlers for settings
ipcMain.handle("get-settings", () => {
  return {
    openaiKey: config.getOpenAIKey(),
  };
});

// IPC handler for scrolling chat
ipcMain.handle("scroll-chat", (event, direction) => {
  if (invisibleWindow) {
    invisibleWindow.webContents.send("scroll-chat", direction);
  }
  return true;
});

ipcMain.handle("save-settings", async (event, settings) => {
  if (typeof settings.openaiKey === "string") {
    config.setOpenAIKey(settings.openaiKey);
  }
  return true;
});

// IPC handler for settings window visibility
ipcMain.handle("show-settings", () => {
  createSettingsWindow();
});

// IPC handler for chat reset
ipcMain.handle("reset-chat", (event) => {
  if (invisibleWindow) {
    invisibleWindow.webContents.send("reset-chat");
  }
  return true;
});

// IPC handler for context menu
ipcMain.handle("build-context-menu", (event) => {
  const menu = Menu.buildFromTemplate([
    { role: "cut" },
    { role: "copy" },
    { role: "paste" },
    { type: "separator" },
    { role: "selectAll" },
  ]);
  return menu;
});

// IPC handlers for screenshots
ipcMain.handle("get-screenshots-directory", () => {
  const { ensureScreenshotsDirectory } = require("./screenshot");
  return ensureScreenshotsDirectory();
});

ipcMain.handle("get-recent-screenshots", () => {
  return getRecentScreenshots();
});

// IPC handlers for window controls
ipcMain.handle("minimize-window", () => {
  if (invisibleWindow) {
    invisibleWindow.minimize();
  }
});

ipcMain.handle("hide-window", () => {
  if (invisibleWindow) {
    invisibleWindow.hide();
  }
});

let invisibleWindow;
let settingsWindow = null;
let tray = null;

// Create shared menu template
function createMenuTemplate() {
  return [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              {
                label: "Preferences...",
                accelerator: "Command+,",
                click: () => createSettingsWindow(),
              },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Developer Tools",
          accelerator:
            process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
          click: (_, window) => {
            if (window) {
              window.webContents.toggleDevTools();
            }
          },
        },
      ],
    },
  ];
}

function createInvisibleWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 500;
  const height = 700;
  invisibleWindow = new BrowserWindow({
    width,
    height,
    x: Math.max(workArea.x, workArea.x + workArea.width - width - 24),
    y: workArea.y + 24,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Set window type to utility on macOS
  if (process.platform === "darwin") {
    invisibleWindow.setAlwaysOnTop(true, "utility", 1);
    // Hide window buttons but keep functionality
    invisibleWindow.setWindowButtonVisibility(false);
  }

  // Set content protection to prevent screen capture
  invisibleWindow.setContentProtection(true);

  // Always ignore mouse events to prevent interaction with screen sharing
  invisibleWindow.setIgnoreMouseEvents(false);

  invisibleWindow.loadFile(path.join(app.getAppPath(), "index.html"));

  // Open DevTools in development
  if (process.argv.includes("--debug")) {
    invisibleWindow.webContents.openDevTools();
  }

  // Handle window visibility without recursively triggering the show event
  invisibleWindow.on("show", () => {
    if (!invisibleWindow.isVisible()) {
      invisibleWindow.showInactive();
    }
  });

  // Prevent the window from being closed with mouse
  invisibleWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      invisibleWindow.hide();
    }
    return false;
  });

  // Set the menu for the invisible window
  const menu = Menu.buildFromTemplate(createMenuTemplate());
  Menu.setApplicationMenu(menu);

  // Show window initially
  invisibleWindow.showInactive();
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.show();
    return;
  }

  settingsWindow = new BrowserWindow({
    resizable: true,
    minimizable: true,
    maximizable: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  settingsWindow.loadFile(path.join(app.getAppPath(), "settings.html"));

  // Open DevTools in development
  if (process.argv.includes("--debug")) {
    settingsWindow.webContents.openDevTools();
  }

  settingsWindow.once("ready-to-show", () => {
    settingsWindow.show();
  });

  // Handle window close
  settingsWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
    return false;
  });
}

function registerShortcut(accelerator, callback) {
  if (!globalShortcut.register(accelerator, callback)) {
    console.warn(`Unable to register global shortcut: ${accelerator}`);
  }
}

function toggleAssistantVisibility() {
  if (!invisibleWindow || invisibleWindow.isDestroyed()) return;
  if (invisibleWindow.isVisible()) {
    invisibleWindow.hide();
  } else {
    invisibleWindow.showInactive();
  }
}

async function takeScreenshot() {
  const wasVisible = invisibleWindow && invisibleWindow.isVisible();
  try {
    if (wasVisible) invisibleWindow.hide();
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!(await ensureScreenRecordingPermission())) return;

    const screenshotPath = await captureFullScreen(desktopCapturer, screen);
    if (screenshotPath && invisibleWindow && !invisibleWindow.isDestroyed()) {
      invisibleWindow.webContents.send("screenshot-captured", {
        filePath: screenshotPath,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    console.error("Screenshot failed:", error);
  } finally {
    if (wasVisible && invisibleWindow && !invisibleWindow.isDestroyed()) {
      invisibleWindow.showInactive();
    }
  }
}

function moveAssistant(xOffset, yOffset) {
  if (!invisibleWindow || invisibleWindow.isDestroyed()) return;
  const display = screen.getDisplayMatching(invisibleWindow.getBounds());
  const workArea = display.workArea;
  const [x, y] = invisibleWindow.getPosition();
  const [width, height] = invisibleWindow.getSize();
  const newX = Math.min(
    Math.max(x + xOffset, workArea.x),
    workArea.x + workArea.width - width
  );
  const newY = Math.min(
    Math.max(y + yOffset, workArea.y),
    workArea.y + workArea.height - height
  );
  invisibleWindow.setPosition(newX, newY);
}

function registerShortcuts() {
  registerShortcut("CommandOrControl+Shift+S", takeScreenshot);
  registerShortcut("CommandOrControl+Shift+H", toggleAssistantVisibility);
  registerShortcut("CommandOrControl+B", toggleAssistantVisibility);
  registerShortcut("CommandOrControl+,", createSettingsWindow);

  // Test response shortcut (Command/Ctrl + Shift + T)
  registerShortcut("CommandOrControl+Shift+T", () => {
    if (invisibleWindow && !invisibleWindow.isDestroyed()) {
      invisibleWindow.webContents.send(
        "assistant-question",
        "Write Python code to print 'Hello, world!'"
      );
    }
  });

  const NUDGE_AMOUNT = 50;
  registerShortcut("CommandOrControl+Left", () =>
    moveAssistant(-NUDGE_AMOUNT, 0)
  );
  registerShortcut("CommandOrControl+Right", () =>
    moveAssistant(NUDGE_AMOUNT, 0)
  );
  registerShortcut("CommandOrControl+Up", () =>
    moveAssistant(0, -NUDGE_AMOUNT)
  );
  registerShortcut("CommandOrControl+Down", () =>
    moveAssistant(0, NUDGE_AMOUNT)
  );
  registerShortcut("CommandOrControl+Shift+Left", () =>
    moveAssistant(-10000, -10000)
  );
  registerShortcut("CommandOrControl+Shift+Right", () => {
    if (!invisibleWindow || invisibleWindow.isDestroyed()) return;
    const { workArea } = screen.getDisplayMatching(
      invisibleWindow.getBounds()
    );
    const [, y] = invisibleWindow.getPosition();
    const [width] = invisibleWindow.getSize();
    invisibleWindow.setPosition(workArea.x + workArea.width - width, y);
  });
  registerShortcut("CommandOrControl+Shift+Up", () =>
    moveAssistant(-10000, -10000)
  );
  registerShortcut("CommandOrControl+Shift+Down", () => {
    if (!invisibleWindow || invisibleWindow.isDestroyed()) return;
    const { workArea } = screen.getDisplayMatching(
      invisibleWindow.getBounds()
    );
    const [, height] = invisibleWindow.getSize();
    invisibleWindow.setPosition(
      workArea.x,
      workArea.y + workArea.height - height
    );
  });
  registerShortcut("CommandOrControl+Shift+R", () => {
    if (invisibleWindow && !invisibleWindow.isDestroyed()) {
      invisibleWindow.webContents.send("reset-chat");
    }
  });
  registerShortcut("Alt+Up", () => {
    if (invisibleWindow) {
      invisibleWindow.webContents.send("scroll-chat", "up");
    }
  });
  registerShortcut("Alt+Down", () => {
    if (invisibleWindow) {
      invisibleWindow.webContents.send("scroll-chat", "down");
    }
  });
}

// When app is ready
app.whenReady().then(async () => {
  createInvisibleWindow();
  initializeLLMService();
  registerShortcuts();

  // Create tray icon for Windows
  if (process.platform === "win32") {
    tray = new Tray(path.join(app.getAppPath(), "assets", "OCTO.png"));
    const contextMenu = Menu.buildFromTemplate([
      { label: "Show", click: () => invisibleWindow.show() },
      { label: "Hide", click: () => invisibleWindow.hide() },
      { label: "Settings", click: () => createSettingsWindow() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]);
    tray.setToolTip("Open Interview Coder");
    tray.setContextMenu(contextMenu);
  }

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createInvisibleWindow();
    }
  });
});

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Clean up on app quit
app.on("before-quit", () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
});

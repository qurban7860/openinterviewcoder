const axios = require("axios");
const { app, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const config = require("./config");

const SYSTEM_PROMPT = `You are an interview coding assistant. Answer the user's question directly and accurately.
For coding problems, explain the approach briefly, then provide a correct, readable solution and its complexity when useful. Ask a clarifying question only when essential. Keep responses concise and use Markdown.`;
const MAX_PROMPT_LENGTH = 20000;
const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;

let isInitialized = false;

function initializeLLMService() {
  if (isInitialized) return;

  ipcMain.handle("analyze-screenshot", async (event, data) => {
    try {
      return await makeLLMRequest(event, data);
    } catch (error) {
      throw new Error(`Failed to analyze screenshot: ${error.message}`);
    }
  });

  ipcMain.handle("test-response", async (event, request) => {
    try {
      const data =
        typeof request === "string" ? { prompt: request } : request || {};
      return await makeLLMRequest(event, data);
    } catch (error) {
      throw new Error(`Failed to get assistant response: ${error.message}`);
    }
  });

  isInitialized = true;
}

async function readScreenshot(filePath) {
  const screenshotDirectory = path.resolve(
    app.getPath("userData"),
    "screenshots"
  );
  const screenshotPath = path.resolve(filePath);
  const relativePath = path.relative(screenshotDirectory, screenshotPath);
  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    !fs.existsSync(screenshotPath)
  ) {
    throw new Error("Screenshot file not found in the app screenshots folder.");
  }

  const stats = await fs.promises.stat(screenshotPath);
  if (!stats.isFile() || stats.size > MAX_SCREENSHOT_BYTES) {
    throw new Error("Screenshot must be a file smaller than 20 MB.");
  }
  return fs.promises.readFile(screenshotPath);
}

function getHistory(data) {
  if (!Array.isArray(data.history)) return [];
  return data.history
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, MAX_PROMPT_LENGTH),
    }));
}

function createOpenAIInput(history, prompt, image) {
  const input = history.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const content = [{ type: "input_text", text: prompt }];
  if (image) {
    content.push({
      type: "input_image",
      image_url: `data:image/png;base64,${image.toString("base64")}`,
    });
  }
  input.push({ role: "user", content });
  return input;
}

function createGeminiContents(history, prompt, image) {
  const contents = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const parts = [{ text: prompt }];
  if (image) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: image.toString("base64"),
      },
    });
  }
  contents.push({ role: "user", parts });
  return contents;
}

function createAnthropicMessages(history, prompt, image) {
  const messages = history.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const content = [{ type: "text", text: prompt }];
  if (image) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: image.toString("base64"),
      },
    });
  }
  messages.push({ role: "user", content });
  return messages;
}

async function callProvider(provider, apiKey, history, prompt, image) {
  if (provider === "openai") {
    const response = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: "gpt-4o-mini",
        instructions: SYSTEM_PROMPT,
        input: createOpenAIInput(history, prompt, image),
        max_output_tokens: 1200,
      },
      {
        timeout: 60000,
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    const text =
      response.data.output_text ||
      (response.data.output || [])
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("\n");
    return { text, model: "gpt-4o-mini" };
  }

  if (provider === "gemini") {
    const model = "gemini-2.5-flash";
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: createGeminiContents(history, prompt, image),
        generationConfig: { maxOutputTokens: 1200 },
      },
      { timeout: 60000, headers: { "x-goog-api-key": apiKey } }
    );
    const text = (response.data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("\n")
      .trim();
    return { text, model };
  }

  if (provider === "anthropic") {
    const model = "claude-haiku-5-5";
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model,
        system: SYSTEM_PROMPT,
        messages: createAnthropicMessages(history, prompt, image),
        max_tokens: 1200,
      },
      {
        timeout: 60000,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      }
    );
    const text = (response.data.content || [])
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    return { text, model };
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

async function makeLLMRequest(event, data = {}) {
  const { provider } = config.getSettings();
  const apiKey = config.getApiKey(provider);
  if (!apiKey) {
    throw new Error(
      `No ${provider} API key configured. Open Settings and add your key.`
    );
  }

  const prompt =
    typeof data.prompt === "string" && data.prompt.trim()
      ? data.prompt.trim()
      : "Analyze this screenshot and provide concise, actionable insights.";
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error("Question is too long. Keep it under 20,000 characters.");
  }

  const image = data.filePath ? await readScreenshot(data.filePath) : null;
  const history = getHistory(data);
  const messageId = data.messageId || randomUUID();
  try {
    const { text, model } = await callProvider(
      provider,
      apiKey,
      history,
      prompt,
      image
    );
    if (!text) {
      throw new Error("The assistant returned an empty response.");
    }

    const result = {
      success: true,
      messageId,
      content: text,
      provider,
      model,
      status: "completed",
    };
    if (!event.sender.isDestroyed()) {
      event.sender.send("stream-update", {
        messageId,
        content: text,
        isComplete: true,
        status: "completed",
      });
    }
    return result;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401 || error.response.status === 403) {
        throw new Error(
          `The ${provider} API rejected the key. Check it in Settings and try again.`
        );
      }
      const apiMessage =
        error.response.data?.error?.message ||
        error.response.data?.message ||
        error.message;
      throw new Error(
        `${provider} API error (${error.response.status}): ${apiMessage}`
      );
    }
    if (error.request) {
      throw new Error(
        `No response received from ${provider}. Check your internet connection and try again.`
      );
    }
    throw error;
  }
}

module.exports = {
  initializeLLMService,
};
